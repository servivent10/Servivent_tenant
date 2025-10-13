-- =============================================================================
-- DATABASE CORE SCRIPT (v7 - Fully Featured)
-- =============================================================================
-- This script defines the most up-to-date and complete version of the crucial
-- `get_user_profile_data` function. It includes all necessary fields for a
-- complete user session initialization, such as `modo_caja` and `slug`.
--
-- This file should be considered the canonical source for this function.
--
-- INSTRUCTIONS:
-- Execute this script in your Supabase SQL Editor to apply the latest version.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Drop the old function to ensure a clean update
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_profile_data();


-- -----------------------------------------------------------------------------
-- Step 2: Create the new, fully-featured `get_user_profile_data` function (v7)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_profile_data()
RETURNS table (
    empresa_id uuid,
    empresa_nombre text,
    empresa_logo text,
    empresa_nit text,
    empresa_timezone text,
    empresa_moneda text,
    empresa_modo_caja text,
    empresa_slug text,
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
        e.modo_caja AS empresa_modo_caja,
        e.slug AS empresa_slug,
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
-- End of script.
-- =============================================================================