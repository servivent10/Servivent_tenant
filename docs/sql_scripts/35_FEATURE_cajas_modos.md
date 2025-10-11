-- =============================================================================
-- CASH REGISTER MODES FEATURE SCRIPT
-- =============================================================================
-- This script implements the logic for selectable cash register modes:
-- 1. Adds a `modo_caja` column to the `empresas` table.
-- 2. Updates all relevant RPC functions to handle both 'por_sucursal' and
--    'por_usuario' modes, ensuring correct session management.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Alter `empresas` table to add the cash register mode setting
-- -----------------------------------------------------------------------------
ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS modo_caja TEXT NOT NULL DEFAULT 'por_sucursal';


-- -----------------------------------------------------------------------------
-- Step 2: Update `get_user_profile_data` to return the new setting
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_profile_data();
CREATE OR REPLACE FUNCTION get_user_profile_data()
RETURNS table (
    empresa_id uuid,
    empresa_nombre text,
    empresa_logo text,
    empresa_nit text,
    empresa_timezone text,
    empresa_moneda text,
    empresa_modo_caja text, -- **NUEVO CAMPO**
    plan_actual text,
    estado_licencia text,
    fecha_fin_licencia date,
    nombre_completo text,
    rol text,
    avatar text,
    sucursal_id uuid,
    sucursal_principal_nombre text,
    historial_pagos json
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH user_payments AS (
        SELECT
            p.empresa_id,
            json_agg(
                json_build_object(
                    'id', p.id,
                    'monto', p.monto,
                    'fecha_pago', p.fecha_pago,
                    'metodo_pago', p.metodo_pago,
                    'notas', p.notas
                ) ORDER BY p.fecha_pago DESC
            ) AS historial
        FROM
            pagos_licencia p
        WHERE
            p.empresa_id = (SELECT u.empresa_id FROM usuarios u WHERE u.id = auth.uid())
        GROUP BY
            p.empresa_id
    )
    SELECT
        u.empresa_id,
        e.nombre AS empresa_nombre,
        e.logo AS empresa_logo,
        e.nit AS empresa_nit,
        e.timezone AS empresa_timezone,
        e.moneda AS empresa_moneda,
        e.modo_caja AS empresa_modo_caja, -- **SE AÑADE EL MODO DE CAJA**
        l.tipo_licencia AS plan_actual,
        l.estado AS estado_licencia,
        l.fecha_fin AS fecha_fin_licencia,
        u.nombre_completo,
        u.rol,
        u.avatar,
        u.sucursal_id,
        s.nombre AS sucursal_principal_nombre,
        up.historial AS historial_pagos
    FROM
        usuarios u
    LEFT JOIN
        empresas e ON u.empresa_id = e.id
    LEFT JOIN
        licencias l ON u.empresa_id = l.empresa_id
    LEFT JOIN
        sucursales s ON u.sucursal_id = s.id
    LEFT JOIN
        user_payments up ON u.empresa_id = up.empresa_id
    WHERE
        u.id = auth.uid();
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 3: Update `update_company_info` to save the new setting
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_company_info(text, text, text);
CREATE OR REPLACE FUNCTION update_company_info(
    p_nombre text,
    p_nit text,
    p_logo text,
    p_modo_caja text -- **NUEVO PARÁMETRO**
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
BEGIN
    SELECT empresa_id, rol INTO caller_empresa_id, caller_rol
    FROM public.usuarios WHERE id = auth.uid();

    IF caller_rol != 'Propietario' THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de Propietario.';
    END IF;

    UPDATE public.empresas
    SET
        nombre = p_nombre,
        nit = p_nit,
        logo = p_logo,
        modo_caja = p_modo_caja -- **SE AÑADE LA ACTUALIZACIÓN**
    WHERE id = caller_empresa_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 4: Update `get_sesion_activa` to check mode
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_sesion_activa();
CREATE OR REPLACE FUNCTION get_sesion_activa()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_user_id uuid := auth.uid();
    caller_sucursal_id uuid;
    v_modo_caja text;
    session_data json;
BEGIN
    SELECT u.sucursal_id, e.modo_caja 
    INTO caller_sucursal_id, v_modo_caja
    FROM public.usuarios u
    JOIN public.empresas e ON u.empresa_id = e.id
    WHERE u.id = caller_user_id;

    IF v_modo_caja = 'por_usuario' THEN
        -- Find session by user
        SELECT to_json(sc) INTO session_data
        FROM (
            SELECT sc.id, sc.fecha_apertura, sc.saldo_inicial, u.nombre_completo as usuario_apertura_nombre
            FROM public.sesiones_caja sc
            JOIN public.usuarios u ON sc.usuario_apertura_id = u.id
            WHERE sc.usuario_apertura_id = caller_user_id AND sc.estado = 'ABIERTA'
            LIMIT 1
        ) sc;
    ELSE -- Default to 'por_sucursal'
        -- Find session by branch
        SELECT to_json(sc) INTO session_data
        FROM (
            SELECT sc.id, sc.fecha_apertura, sc.saldo_inicial, u.nombre_completo as usuario_apertura_nombre
            FROM public.sesiones_caja sc
            JOIN public.usuarios u ON sc.usuario_apertura_id = u.id
            WHERE sc.sucursal_id = caller_sucursal_id AND sc.estado = 'ABIERTA'
            LIMIT 1
        ) sc;
    END IF;

    RETURN session_data;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 5: Update `abrir_caja` to check mode
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.abrir_caja(numeric);
CREATE OR REPLACE FUNCTION abrir_caja(p_saldo_inicial numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    caller_user_id uuid := auth.uid();
    caller_sucursal_id uuid;
    v_modo_caja text;
    new_session_id uuid;
BEGIN
    SELECT u.sucursal_id, e.modo_caja 
    INTO caller_sucursal_id, v_modo_caja
    FROM public.usuarios u
    JOIN public.empresas e ON u.empresa_id = e.id
    WHERE u.id = caller_user_id;

    IF v_modo_caja = 'por_usuario' THEN
        IF EXISTS (SELECT 1 FROM public.sesiones_caja WHERE usuario_apertura_id = caller_user_id AND estado = 'ABIERTA') THEN
            RAISE EXCEPTION 'Ya tienes una sesión de caja abierta.';
        END IF;
    ELSE -- 'por_sucursal'
        IF EXISTS (SELECT 1 FROM public.sesiones_caja WHERE sucursal_id = caller_sucursal_id AND estado = 'ABIERTA') THEN
            RAISE EXCEPTION 'Ya existe una sesión de caja abierta para esta sucursal.';
        END IF;
    END IF;

    INSERT INTO public.sesiones_caja (empresa_id, sucursal_id, usuario_apertura_id, fecha_apertura, estado, saldo_inicial)
    VALUES (caller_empresa_id, caller_sucursal_id, caller_user_id, now(), 'ABIERTA', p_saldo_inicial)
    RETURNING id INTO new_session_id;

    RETURN new_session_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 6: Update `get_resumen_sesion_activa` to check mode and filter correctly
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_resumen_sesion_activa();
CREATE OR REPLACE FUNCTION get_resumen_sesion_activa()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_user_id uuid := auth.uid();
    caller_sucursal_id uuid;
    v_modo_caja text;
    active_session record;
    summary json;
BEGIN
    SELECT u.sucursal_id, e.modo_caja 
    INTO caller_sucursal_id, v_modo_caja
    FROM public.usuarios u
    JOIN public.empresas e ON u.empresa_id = e.id
    WHERE u.id = caller_user_id;

    IF v_modo_caja = 'por_usuario' THEN
        SELECT * INTO active_session FROM public.sesiones_caja 
        WHERE usuario_apertura_id = caller_user_id AND estado = 'ABIERTA' LIMIT 1;
    ELSE -- 'por_sucursal'
        SELECT * INTO active_session FROM public.sesiones_caja 
        WHERE sucursal_id = caller_sucursal_id AND estado = 'ABIERTA' LIMIT 1;
    END IF;

    IF active_session IS NULL THEN
        RAISE EXCEPTION 'No hay una sesión de caja activa.';
    END IF;

    SELECT json_build_object(
        'id', active_session.id,
        'fecha_apertura', active_session.fecha_apertura,
        'saldo_inicial', active_session.saldo_inicial,
        
        'total_ventas_efectivo', COALESCE((
            SELECT SUM(pv.monto)
            FROM public.pagos_ventas pv
            JOIN public.ventas v ON pv.venta_id = v.id
            WHERE v.fecha >= active_session.fecha_apertura AND pv.metodo_pago = 'Efectivo'
              AND ( (v_modo_caja = 'por_sucursal' AND v.sucursal_id = caller_sucursal_id) OR
                    (v_modo_caja = 'por_usuario' AND v.usuario_id = caller_user_id) )
        ), 0),
        
        'total_gastos_efectivo', COALESCE((
            SELECT SUM(monto) FROM gastos 
            WHERE fecha >= active_session.fecha_apertura::date
              AND ( (v_modo_caja = 'por_sucursal' AND sucursal_id = caller_sucursal_id) OR
                    (v_modo_caja = 'por_usuario' AND usuario_id = caller_user_id) )
        ), 0),
        
        'total_ventas_tarjeta', COALESCE((
            SELECT SUM(total) FROM ventas 
            WHERE fecha >= active_session.fecha_apertura AND metodo_pago = 'Tarjeta'
              AND ( (v_modo_caja = 'por_sucursal' AND sucursal_id = caller_sucursal_id) OR
                    (v_modo_caja = 'por_usuario' AND usuario_id = caller_user_id) )
        ), 0),
        'total_ventas_qr', COALESCE((
            SELECT SUM(total) FROM ventas 
            WHERE fecha >= active_session.fecha_apertura AND metodo_pago = 'QR'
              AND ( (v_modo_caja = 'por_sucursal' AND sucursal_id = caller_sucursal_id) OR
                    (v_modo_caja = 'por_usuario' AND usuario_id = caller_user_id) )
        ), 0),
        'total_ventas_transferencia', COALESCE((
            SELECT SUM(total) FROM ventas 
            WHERE fecha >= active_session.fecha_apertura AND metodo_pago = 'Transferencia Bancaria'
              AND ( (v_modo_caja = 'por_sucursal' AND sucursal_id = caller_sucursal_id) OR
                    (v_modo_caja = 'por_usuario' AND usuario_id = caller_user_id) )
        ), 0)
    ) INTO summary;
    
    RETURN summary;
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================