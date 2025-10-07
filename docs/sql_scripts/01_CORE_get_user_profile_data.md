-- =============================================================================
-- DATABASE UPDATE SCRIPT (v6 - Timezone & Currency)
-- =============================================================================
-- Este script actualiza la función principal que carga los datos del perfil
-- de usuario para que devuelva la zona horaria y la moneda de la empresa,
-- datos cruciales para el nuevo sistema de localización.
--
-- **INSTRUCCIONES:**
-- Por favor, ejecuta este script completo en el Editor SQL de tu proyecto de
-- Supabase para aplicar la corrección.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Eliminar la función antigua
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_profile_data();


-- -----------------------------------------------------------------------------
-- Paso 2: Crear la nueva función `get_user_profile_data` (v6)
-- -----------------------------------------------------------------------------
-- Descripción:
-- Se añaden `empresa_timezone` y `empresa_moneda` a la definición de la
-- tabla de retorno y a la sentencia SELECT principal.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_profile_data()
RETURNS table (
    empresa_id uuid,
    empresa_nombre text,
    empresa_logo text,
    empresa_nit text,
    empresa_timezone text, -- **NUEVO CAMPO**
    empresa_moneda text,   -- **NUEVO CAMPO**
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
        e.timezone AS empresa_timezone, -- **SE AÑADE LA ZONA HORARIA**
        e.moneda AS empresa_moneda,     -- **SE AÑADE LA MONEDA**
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


-- =============================================================================
-- Fin del script.
-- =============================================================================