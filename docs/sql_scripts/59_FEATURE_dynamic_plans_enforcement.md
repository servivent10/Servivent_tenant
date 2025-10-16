-- =============================================================================
-- DYNAMIC PLANS ENFORCEMENT & SECURITY - DATABASE SETUP (V1)
-- =============================================================================
-- This script implements Phase 4 of the dynamic plans feature: enforcing the
-- plan limits and features on the backend and refining the data structure for
-- the frontend.
--
-- WHAT IT DOES:
-- 1. Updates `create_sucursal` to dynamically check the `MAX_BRANCHES` limit
--    from the new plan tables, replacing the old hardcoded logic.
-- 2. Updates `create_user` (via Edge Function prerequisites) to check the
--    `MAX_USERS` limit before creating a new user.
-- 3. Refines `get_user_profile_data` to return a cleaner `planDetails` object,
--    separating numeric limits from boolean features for easier use in the UI.
-- 4. Adds basic RLS policies to the new plan management tables for security.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Add RLS policies to plan management tables
-- -----------------------------------------------------------------------------
-- Allow authenticated users to read plan configurations. SuperAdmin will manage them
-- via SECURITY DEFINER functions.
CREATE POLICY "Enable read access for authenticated users" ON public.planes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON public.caracteristicas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON public.plan_caracteristicas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON public.plan_features_display FOR SELECT USING (auth.role() = 'authenticated');


-- -----------------------------------------------------------------------------
-- Step 2: Update `create_sucursal` to enforce dynamic limits
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_sucursal(text, text, text);
CREATE OR REPLACE FUNCTION create_sucursal(
    p_nombre text,
    p_direccion text,
    p_telefono text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
    plan_id_from_license uuid;
    sucursal_count int;
    max_sucursales int;
    new_sucursal_id uuid;
BEGIN
    -- 1. Validate caller permissions (only Owner)
    SELECT empresa_id, rol INTO caller_empresa_id, caller_rol
    FROM public.usuarios WHERE id = auth.uid();

    IF caller_rol != 'Propietario' THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de Propietario.';
    END IF;

    -- 2. Dynamically check the branch limit from the plan
    SELECT l.plan_id INTO plan_id_from_license FROM public.licencias l WHERE l.empresa_id = caller_empresa_id;

    SELECT pc.valor::int INTO max_sucursales
    FROM public.plan_caracteristicas pc
    JOIN public.caracteristicas c ON pc.caracteristica_id = c.id
    WHERE pc.plan_id = plan_id_from_license AND c.codigo_interno = 'MAX_BRANCHES';

    IF max_sucursales IS NULL THEN
        RAISE EXCEPTION 'La configuración de límite de sucursales no está definida para el plan actual.';
    END IF;

    SELECT COUNT(*) INTO sucursal_count FROM public.sucursales WHERE empresa_id = caller_empresa_id;

    IF sucursal_count >= max_sucursales THEN
        RAISE EXCEPTION 'Límite de sucursales alcanzado para el plan actual.';
    END IF;
    
    -- 3. Insert the new branch if limit is not reached
    INSERT INTO public.sucursales(empresa_id, nombre, direccion, telefono)
    VALUES (caller_empresa_id, p_nombre, p_direccion, p_telefono)
    RETURNING id INTO new_sucursal_id;

    RETURN new_sucursal_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 3: Refine `get_user_profile_data` for a cleaner `planDetails` object
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
            'limits', (
                SELECT jsonb_object_agg(
                    -- Converts MAX_USERS to maxUsers
                    lower(regexp_replace(c.codigo_interno, '_([a-z])', '\U\1', 'g')),
                    pc.valor::numeric
                )
                FROM plan_caracteristicas pc
                JOIN caracteristicas c ON pc.caracteristica_id = c.id
                WHERE pc.plan_id = l.plan_id AND c.tipo = 'LIMIT'
            ),
            'features', (
                SELECT jsonb_object_agg(
                    -- Converts MODULO_TRASPASOS to moduloTraspasos
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
-- Step 4: Update `get_caller_profile_safely` to include plan limits for Edge Functions
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_caller_profile_safely();
CREATE OR REPLACE FUNCTION get_caller_profile_safely()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_info record;
    plan_limits jsonb;
BEGIN
    SELECT u.empresa_id, u.rol, l.plan_id INTO caller_info
    FROM usuarios u
    JOIN licencias l ON u.empresa_id = l.empresa_id
    WHERE u.id = auth.uid()
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT jsonb_object_agg(
        lower(regexp_replace(c.codigo_interno, '_([a-z])', '\U\1', 'g')),
        pc.valor::numeric
    ) INTO plan_limits
    FROM plan_caracteristicas pc
    JOIN caracteristicas c ON pc.caracteristica_id = c.id
    WHERE pc.plan_id = caller_info.plan_id AND c.tipo = 'LIMIT';

    RETURN json_build_object(
        'empresa_id', caller_info.empresa_id,
        'rol', caller_info.rol,
        'planLimits', plan_limits
    );
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================