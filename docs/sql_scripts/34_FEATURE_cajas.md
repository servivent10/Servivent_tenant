-- =============================================================================
-- CASH REGISTER (CAJAS) MODULE - DATABASE SETUP (V3 - Calculation Fix)
-- =============================================================================
-- This script fixes an error in the `get_resumen_sesion_activa` function. The
-- previous version incorrectly tried to query a non-existent `abono_inicial`
-- column from the `ventas` table. This version corrects the logic to properly
-- calculate total cash income by summing amounts from the `pagos_ventas` table.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create the `sesiones_caja` table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sesiones_caja (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    sucursal_id uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
    usuario_apertura_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    usuario_cierre_id uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    fecha_apertura timestamptz DEFAULT now() NOT NULL,
    fecha_cierre timestamptz,
    estado text NOT NULL, -- 'ABIERTA' or 'CERRADA'
    saldo_inicial numeric(10, 2) NOT NULL,
    total_ventas_efectivo numeric(10, 2),
    total_gastos_efectivo numeric(10, 2),
    saldo_final_teorico_efectivo numeric(10, 2),
    saldo_final_real_efectivo numeric(10, 2),
    diferencia_efectivo numeric(10, 2),
    total_ventas_tarjeta numeric(10, 2),
    total_ventas_qr numeric(10, 2),
    total_ventas_transferencia numeric(10, 2),
    total_ventas numeric(10, 2),
    notas text,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- -----------------------------------------------------------------------------
-- Step 2: RLS Policies and Realtime Publication
-- -----------------------------------------------------------------------------
ALTER TABLE public.sesiones_caja ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.sesiones_caja;
CREATE POLICY "Enable all for own company" ON public.sesiones_caja
FOR ALL USING (empresa_id = public.get_empresa_id_from_jwt());

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sesiones_caja;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Table "sesiones_caja" is already in the publication.';
END;
$$;

-- -----------------------------------------------------------------------------
-- Step 3: RPC Functions
-- -----------------------------------------------------------------------------

-- Function to get the current active session for the user's branch
DROP FUNCTION IF EXISTS public.get_sesion_activa();
CREATE OR REPLACE FUNCTION get_sesion_activa()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_sucursal_id uuid;
    session_data json;
BEGIN
    SELECT sucursal_id INTO caller_sucursal_id FROM public.usuarios WHERE id = auth.uid();

    SELECT to_json(sc)
    INTO session_data
    FROM (
        SELECT sc.id, sc.fecha_apertura, sc.saldo_inicial, u.nombre_completo as usuario_apertura_nombre
        FROM public.sesiones_caja sc
        JOIN public.usuarios u ON sc.usuario_apertura_id = u.id
        WHERE sc.sucursal_id = caller_sucursal_id
          AND sc.estado = 'ABIERTA'
        LIMIT 1
    ) sc;

    RETURN session_data;
END;
$$;

-- Function to open a new session
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
    caller_sucursal_id uuid := (SELECT u.sucursal_id FROM public.usuarios u WHERE u.id = caller_user_id);
    new_session_id uuid;
BEGIN
    IF EXISTS (SELECT 1 FROM public.sesiones_caja WHERE sucursal_id = caller_sucursal_id AND estado = 'ABIERTA') THEN
        RAISE EXCEPTION 'Ya existe una sesión de caja abierta para esta sucursal.';
    END IF;

    INSERT INTO public.sesiones_caja (
        empresa_id, sucursal_id, usuario_apertura_id, fecha_apertura, estado, saldo_inicial
    ) VALUES (
        caller_empresa_id, caller_sucursal_id, caller_user_id, now(), 'ABIERTA', p_saldo_inicial
    ) RETURNING id INTO new_session_id;

    RETURN new_session_id;
END;
$$;

-- Function to get the summary for the active session (FIXED)
DROP FUNCTION IF EXISTS public.get_resumen_sesion_activa();
CREATE OR REPLACE FUNCTION get_resumen_sesion_activa()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_sucursal_id uuid := (SELECT u.sucursal_id FROM public.usuarios u WHERE u.id = auth.uid());
    active_session record;
    summary json;
BEGIN
    SELECT * INTO active_session FROM public.sesiones_caja 
    WHERE sucursal_id = caller_sucursal_id AND estado = 'ABIERTA' LIMIT 1;

    IF active_session IS NULL THEN
        RAISE EXCEPTION 'No hay una sesión de caja activa.';
    END IF;

    SELECT json_build_object(
        'id', active_session.id,
        'fecha_apertura', active_session.fecha_apertura,
        'saldo_inicial', active_session.saldo_inicial,
        
        -- **FIXED LOGIC**: Calculate total cash income by summing all cash payments
        -- from `pagos_ventas` that belong to sales made during the active session.
        -- This correctly handles both full cash sales and initial cash payments on credit sales.
        'total_ventas_efectivo', COALESCE((
            SELECT SUM(pv.monto)
            FROM public.pagos_ventas pv
            JOIN public.ventas v ON pv.venta_id = v.id
            WHERE v.sucursal_id = caller_sucursal_id
              AND v.fecha >= active_session.fecha_apertura
              AND pv.metodo_pago = 'Efectivo'
        ), 0),
        
        'total_gastos_efectivo', COALESCE((SELECT SUM(monto) FROM gastos WHERE sucursal_id = caller_sucursal_id AND fecha >= active_session.fecha_apertura::date), 0),
        
        -- The logic for non-cash payments remains the same as it correctly reflects the total transaction value.
        'total_ventas_tarjeta', COALESCE((SELECT SUM(total) FROM ventas WHERE sucursal_id = caller_sucursal_id AND fecha >= active_session.fecha_apertura AND metodo_pago = 'Tarjeta'), 0),
        'total_ventas_qr', COALESCE((SELECT SUM(total) FROM ventas WHERE sucursal_id = caller_sucursal_id AND fecha >= active_session.fecha_apertura AND metodo_pago = 'QR'), 0),
        'total_ventas_transferencia', COALESCE((SELECT SUM(total) FROM ventas WHERE sucursal_id = caller_sucursal_id AND fecha >= active_session.fecha_apertura AND metodo_pago = 'Transferencia Bancaria'), 0)
    ) INTO summary;
    
    RETURN summary;
END;
$$;


-- Function to close a session
DROP FUNCTION IF EXISTS public.cerrar_caja(uuid, numeric, jsonb);
CREATE OR REPLACE FUNCTION cerrar_caja(
    p_sesion_id uuid,
    p_saldo_final_real_efectivo numeric,
    p_totales jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_user_id uuid := auth.uid();
    v_saldo_inicial numeric;
    v_saldo_final_teorico_efectivo numeric;
BEGIN
    SELECT saldo_inicial INTO v_saldo_inicial FROM public.sesiones_caja WHERE id = p_sesion_id;

    v_saldo_final_teorico_efectivo := v_saldo_inicial 
        + (p_totales->>'total_ventas_efectivo')::numeric
        - (p_totales->>'total_gastos_efectivo')::numeric;

    UPDATE public.sesiones_caja
    SET
        estado = 'CERRADA',
        fecha_cierre = now(),
        usuario_cierre_id = caller_user_id,
        total_ventas_efectivo = (p_totales->>'total_ventas_efectivo')::numeric,
        total_gastos_efectivo = (p_totales->>'total_gastos_efectivo')::numeric,
        saldo_final_teorico_efectivo = v_saldo_final_teorico_efectivo,
        saldo_final_real_efectivo = p_saldo_final_real_efectivo,
        diferencia_efectivo = p_saldo_final_real_efectivo - v_saldo_final_teorico_efectivo,
        total_ventas_tarjeta = (p_totales->>'total_ventas_tarjeta')::numeric,
        total_ventas_qr = (p_totales->>'total_ventas_qr')::numeric,
        total_ventas_transferencia = (p_totales->>'total_ventas_transferencia')::numeric,
        total_ventas = (p_totales->>'total_ventas_efectivo')::numeric 
                     + (p_totales->>'total_ventas_tarjeta')::numeric 
                     + (p_totales->>'total_ventas_qr')::numeric 
                     + (p_totales->>'total_ventas_transferencia')::numeric
    WHERE id = p_sesion_id;
END;
$$;

-- =============================================================================
-- End of script.
-- =============================================================================