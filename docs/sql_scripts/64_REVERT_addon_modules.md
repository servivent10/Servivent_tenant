-- =============================================================================
-- REVERT SCRIPT FOR: ADD-ON MODULES FEATURE (V1)
-- =============================================================================
-- This script reverts the changes made by `63_FEATURE_addon_modules.md`.
-- It drops the new tables and functions, and restores the previous state
-- of `get_user_profile_data`.
--
-- WARNING: This will delete the `modulos` and `empresa_modulos` tables
-- and all associated data.
--
-- INSTRUCTIONS:
-- Execute this script to roll back the changes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Drop the new RPC functions
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_company_modules_status(uuid);
DROP FUNCTION IF EXISTS public.toggle_company_module(uuid, uuid, boolean);


-- -----------------------------------------------------------------------------
-- Step 2: Drop the new tables
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.empresa_modulos;
DROP TABLE IF EXISTS public.modulos;


-- -----------------------------------------------------------------------------
-- Step 3: Restore `get_user_profile_data` to its previous version
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
        SELECT jsonb_build_object(
            'id', p.id,
            'title', p.nombre,
            'limits', (
                SELECT jsonb_object_agg(
                    lower(regexp_replace(c.codigo_interno, '_([a-z])', '\U\1', 'g')),
                    pc.valor::numeric
                )
                FROM plan_caracteristicas pc
                JOIN caracteristicas c ON pc.caracteristica_id = c.id
                WHERE pc.plan_id = l.plan_id AND c.tipo = 'LIMIT'
            ),
            'features', (
                SELECT jsonb_object_agg(
                    lower(regexp_replace(c.codigo_interno, '_([a-z])', '\U\1', 'g')),
                    pc.valor::boolean
                )
                FROM plan_caracteristicas pc
                JOIN caracteristicas c ON pc.caracteristica_id = c.id
                WHERE pc.plan_id = l.plan_id AND c.tipo = 'BOOLEAN'
            )
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
-- Step 4: Restore 'CATALOGO_WEB' as a plan characteristic (optional, for full rollback)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    plan_profesional_id uuid := 'a1d3d8d6-4e5c-4a37-9d7a-7b5b5b5b5b5b';
    plan_corporativo_id uuid := 'c1b2b1b0-3e4d-4c36-8d6a-6b4b4b4b4b4b';
    feat_catalogo_web_id uuid;
BEGIN
    RAISE NOTICE '--- Restaurando CATALOGO_WEB como característica de plan ---';

    INSERT INTO public.caracteristicas (codigo_interno, nombre_visible, descripcion, tipo)
    VALUES ('CATALOGO_WEB', 'Catálogo Web para Clientes', 'Habilita el catálogo web público.', 'BOOLEAN')
    ON CONFLICT (codigo_interno) DO NOTHING
    RETURNING id INTO feat_catalogo_web_id;

    IF feat_catalogo_web_id IS NULL THEN
        SELECT id INTO feat_catalogo_web_id FROM public.caracteristicas WHERE codigo_interno = 'CATALOGO_WEB';
    END IF;

    -- Add back to Profesional plan
    INSERT INTO public.plan_caracteristicas (plan_id, caracteristica_id, valor)
    VALUES (plan_profesional_id, feat_catalogo_web_id, 'true')
    ON CONFLICT DO NOTHING;

    -- Add back to Corporativo plan
    INSERT INTO public.plan_caracteristicas (plan_id, caracteristica_id, valor)
    VALUES (plan_corporativo_id, feat_catalogo_web_id, 'true')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE '--- Restauración de característica completada. ---';
END;
$$;


-- =============================================================================
-- End of revert script.
-- =============================================================================