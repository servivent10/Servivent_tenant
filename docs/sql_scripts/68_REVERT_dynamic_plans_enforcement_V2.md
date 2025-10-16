-- =============================================================================
-- REVERT SCRIPT FOR: DYNAMIC PLANS & MODULES ENFORCEMENT (V2)
-- =============================================================================
-- This script reverts the changes made by `68_FEATURE_dynamic_plans_enforcement_V2.md`.
-- It restores the previous versions of the `get_user_profile_data` and
-- `update_company_info` functions from script `63`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Restore the previous version of `get_user_profile_data`
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
    historial_pagos json,
    "planDetails" jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_rol text;
BEGIN
    SELECT u.rol INTO v_user_rol FROM public.usuarios u WHERE u.id = auth.uid();
    IF v_user_rol IS NULL THEN RETURN; END IF;
    
    IF v_user_rol = 'SuperAdmin' THEN
        RETURN QUERY
        SELECT
            NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text,
            NULL::text, NULL::text, 'SuperAdmin Plan'::text, 'Activa'::text,
            (now() + interval '10 year')::date,
            (SELECT u.nombre_completo FROM public.usuarios u WHERE u.id = auth.uid()),
            'SuperAdmin'::text,
            (SELECT u.avatar FROM public.usuarios u WHERE u.id = auth.uid()),
            NULL::uuid,
            'Global'::text,
            '[]'::json,
            '{}'::jsonb;
    ELSE
        RETURN QUERY
        SELECT
            u.empresa_id,
            e.nombre, e.logo, e.nit, e.timezone, e.moneda, e.modo_caja, e.slug,
            l.tipo_licencia, l.estado, l.fecha_fin,
            u.nombre_completo, u.rol, u.avatar, u.sucursal_id, s.nombre,
            (SELECT COALESCE(json_agg(pay ORDER BY pay.fecha_pago DESC), '[]'::json) FROM pagos_licencia pay WHERE pay.empresa_id = u.empresa_id),
            COALESCE(
                jsonb_build_object(
                    'id', p.id,
                    'title', p.nombre,
                    'limits', COALESCE((
                        SELECT jsonb_object_agg(lower(regexp_replace(c.codigo_interno, '_([a-z])', '\U\1', 'g')), pc.valor::numeric)
                        FROM plan_caracteristicas pc JOIN caracteristicas c ON pc.caracteristica_id = c.id
                        WHERE pc.plan_id = p.id AND c.tipo = 'LIMIT'
                    ), '{}'::jsonb),
                    'features', COALESCE((
                        SELECT jsonb_object_agg(
                            lower(regexp_replace(c.codigo_interno, '_([a-z])', '\U\1', 'g')),
                            CASE WHEN lower(pc.valor) = 'true' THEN true ELSE false END
                        )
                        FROM plan_caracteristicas pc
                        JOIN caracteristicas c ON pc.caracteristica_id = c.id
                        WHERE pc.plan_id = p.id AND c.tipo = 'BOOLEAN'
                    ), '{}'::jsonb) || COALESCE((
                        SELECT jsonb_object_agg(lower(regexp_replace(m.codigo_interno, '_([a-z])', '\U\1', 'g')), 'true'::jsonb)
                        FROM empresa_modulos em
                        JOIN modulos m ON em.modulo_id = m.id
                        WHERE em.empresa_id = u.empresa_id AND em.estado = 'activo'
                    ), '{}'::jsonb)
                ),
                '{}'::jsonb
            ) as "planDetails"
        FROM
            public.usuarios u
        JOIN public.empresas e ON u.empresa_id = e.id
        LEFT JOIN public.licencias l ON u.empresa_id = l.empresa_id
        LEFT JOIN public.planes p ON l.plan_id = p.id
        LEFT JOIN public.sucursales s ON u.sucursal_id = s.id
        WHERE
            u.id = auth.uid();
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 2: Restore the previous version of `update_company_info`
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
        modo_caja = p_modo_caja,
        slug = p_slug
    WHERE id = caller_empresa_id;
END;
$$;

-- =============================================================================
-- End of revert script.
-- =============================================================================
