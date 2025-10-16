-- =============================================================================
-- DYNAMIC PLANS & MODULES ENFORCEMENT - DATABASE SETUP (V2)
-- =============================================================================
-- This script provides the definitive logic for fetching a consolidated set of
-- permissions and limits for a company, combining their base plan features
-- with any active add-on modules.
--
-- WHAT IT DOES:
-- 1. Redefines `get_user_profile_data`: The function is updated to return a
--    `planDetails` object with a clean structure: `limits` (for numeric values
--    like max_users) and `features` (for boolean flags like modulo_traspasos).
--    This object is built by combining data from `plan_caracteristicas` and
--    `empresa_modulos`, using snake_case for all keys as requested.
-- 2. Hardens `update_company_info`: This function now includes logic to
--    automatically set the company's `slug` to NULL if the `CATALOGO_WEB`
--    module is not active, ensuring business rules are enforced at the
--    database level.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor. It is idempotent
-- and safe to run multiple times. After execution, you MUST log out and log
-- back into the application to receive a fresh profile with the new structure.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Update `get_user_profile_data` with the new `planDetails` structure
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_profile_data();
CREATE OR REPLACE FUNCTION get_user_profile_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_profile record;
    plan_details_json jsonb;
BEGIN
    SELECT * INTO user_profile FROM public.usuarios WHERE id = auth.uid();

    IF user_profile IS NULL THEN
        RETURN '{}'::json;
    END IF;
    
    IF user_profile.rol = 'SuperAdmin' THEN
        RETURN json_build_object(
            'nombre_completo', user_profile.nombre_completo,
            'rol', user_profile.rol,
            'avatar', user_profile.avatar,
            'sucursal_principal_nombre', 'Global'
        );
    ELSE
        -- Dynamically build planDetails from the new tables with separate objects for limits and features
        SELECT jsonb_build_object(
            'id', p.id,
            'title', p.nombre,
            'limits', COALESCE((
                SELECT jsonb_object_agg(lower(c.codigo_interno), pc.valor::numeric)
                FROM plan_caracteristicas pc JOIN caracteristicas c ON pc.caracteristica_id = c.id
                WHERE pc.plan_id = p.id AND c.tipo = 'LIMIT'
            ), '{}'::jsonb),
            'features', COALESCE((
                SELECT jsonb_object_agg(feature_code, is_active)
                FROM (
                    -- 1. Get boolean features from the base plan
                    SELECT 
                        lower(c.codigo_interno) as feature_code,
                        CASE WHEN lower(pc.valor) = 'true' THEN true ELSE false END as is_active
                    FROM caracteristicas c
                    LEFT JOIN plan_caracteristicas pc ON c.id = pc.caracteristica_id AND pc.plan_id = p.id
                    WHERE c.tipo = 'BOOLEAN'
                    
                    UNION ALL
                    
                    -- 2. Get active/inactive status of ALL add-on modules
                    SELECT
                        lower(m.codigo_interno) as feature_code,
                        COALESCE(em.estado = 'activo', false) as is_active
                    FROM modulos m
                    LEFT JOIN empresa_modulos em ON m.id = em.modulo_id AND em.empresa_id = user_profile.empresa_id
                ) as all_features
            ), '{}'::jsonb)
        ) INTO plan_details_json
        FROM licencias l
        JOIN planes p ON l.plan_id = p.id
        WHERE l.empresa_id = user_profile.empresa_id;
        
        RETURN (
            SELECT json_build_object(
                'empresa_id', e.id,
                'empresa_nombre', e.nombre,
                'empresa_logo', e.logo,
                'empresa_nit', e.nit,
                'empresa_timezone', e.timezone,
                'empresa_moneda', e.moneda,
                'empresa_modo_caja', e.modo_caja,
                'empresa_slug', e.slug,
                'plan_actual', l.tipo_licencia,
                'estado_licencia', l.estado,
                'fecha_fin_licencia', l.fecha_fin,
                'nombre_completo', user_profile.nombre_completo,
                'rol', user_profile.rol,
                'avatar', user_profile.avatar,
                'sucursal_id', user_profile.sucursal_id,
                'sucursal_principal_nombre', s.nombre,
                'historial_pagos', (
                    SELECT json_agg(p ORDER BY p.fecha_pago DESC) FROM pagos_licencia p WHERE p.empresa_id = e.id
                ),
                'planDetails', plan_details_json
            )
            FROM empresas e
            LEFT JOIN licencias l ON e.id = l.empresa_id
            LEFT JOIN sucursales s ON user_profile.sucursal_id = s.id
            WHERE e.id = user_profile.empresa_id
        );
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 2: Update `update_company_info` to enforce slug removal
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_company_info(text, text, text, text, text);
CREATE OR REPLACE FUNCTION update_company_info(
    p_nombre text,
    p_nit text,
    p_logo text,
    p_modo_caja text,
    p_slug text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
    v_has_catalog_module boolean;
BEGIN
    SELECT empresa_id, rol INTO caller_empresa_id, caller_rol
    FROM public.usuarios WHERE id = auth.uid();

    IF caller_rol != 'Propietario' THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de Propietario.';
    END IF;

    -- Check if the company has the web catalog module active
    SELECT EXISTS (
        SELECT 1 FROM public.empresa_modulos em
        JOIN public.modulos m ON em.modulo_id = m.id
        WHERE em.empresa_id = caller_empresa_id
          AND m.codigo_interno = 'CATALOGO_WEB'
          AND em.estado = 'activo'
    ) INTO v_has_catalog_module;

    UPDATE public.empresas
    SET
        nombre = p_nombre,
        nit = p_nit,
        logo = p_logo,
        modo_caja = p_modo_caja,
        -- Enforce slug is NULL if the module is not active
        slug = CASE WHEN v_has_catalog_module THEN p_slug ELSE NULL END
    WHERE id = caller_empresa_id;
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================
