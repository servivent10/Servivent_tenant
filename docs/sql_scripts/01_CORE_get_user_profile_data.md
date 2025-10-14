-- =============================================================================
-- DATABASE CORE SCRIPT (v9 - Definitive Fix)
-- =============================================================================
-- This script provides the definitive, robust version of `get_user_profile_data`.
--
-- PROBLEM: The previous version introduced an IF/ELSE structure that caused
-- RLS policies to trigger recursively even with SECURITY DEFINER, breaking login
-- for all non-SuperAdmin users.
--
-- SOLUTION: This version refactors the logic entirely. It fetches the user's
-- complete profile record ONCE at the very beginning. It then uses the `rol`
-- and `empresa_id` from that record to execute the rest of the logic, WITHOUT
-- ever querying the `usuarios` table again. This completely breaks the recursion
-- cycle and provides a much cleaner, more reliable, and performant function.
--
-- INSTRUCTIONS:
-- Execute this script in your Supabase SQL Editor to apply the definitive fix.
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_user_profile_data();

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
DECLARE
    -- Use a record variable to store the user's full profile in one go.
    user_profile record;
BEGIN
    -- Step 1: Fetch the entire user profile ONCE.
    SELECT * INTO user_profile FROM public.usuarios WHERE id = auth.uid();

    -- Step 2: If no profile is found, the user data is inconsistent. Return empty.
    -- The frontend's `.single()` call will correctly fail.
    IF user_profile IS NULL THEN
        RETURN;
    END IF;

    -- Step 3: Use the data from the 'user_profile' record to decide the logic path.
    IF user_profile.rol = 'SuperAdmin' THEN
        -- SuperAdmin Path: Return a constructed profile with nulls for company data.
        RETURN QUERY
        SELECT
            NULL::uuid,
            NULL::text,
            NULL::text,
            NULL::text,
            NULL::text,
            NULL::text,
            NULL::text,
            NULL::text,
            'SuperAdmin Plan'::text,
            'Activa'::text,
            (now() + interval '10 year')::date,
            user_profile.nombre_completo,
            user_profile.rol,
            user_profile.avatar,
            NULL::uuid,
            'Global'::text,
            '[]'::json;
    ELSE
        -- Tenant User Path: Use the `empresa_id` from the fetched profile.
        -- **CRITICAL**: This query no longer references the `usuarios` table,
        -- thus completely avoiding any chance of recursion.
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
                p.empresa_id = user_profile.empresa_id -- Use ID from variable
            GROUP BY
                p.empresa_id
        )
        SELECT
            user_profile.empresa_id,
            e.nombre,
            e.logo,
            e.nit,
            e.timezone,
            e.moneda,
            e.modo_caja,
            e.slug,
            l.tipo_licencia,
            l.estado,
            l.fecha_fin,
            user_profile.nombre_completo,
            user_profile.rol,
            user_profile.avatar,
            user_profile.sucursal_id,
            s.nombre,
            up.historial
        FROM
            empresas e
        LEFT JOIN
            licencias l ON e.id = l.empresa_id
        LEFT JOIN
            sucursales s ON user_profile.sucursal_id = s.id
        LEFT JOIN
            user_payments up ON e.id = up.empresa_id
        WHERE
            e.id = user_profile.empresa_id; -- The main driving condition
    END IF;
END;
$$;

-- =============================================================================
-- End of script.
-- =============================================================================