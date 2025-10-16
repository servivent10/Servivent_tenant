-- =============================================================================
-- PLAN LIMITS ENFORCEMENT FIX (V1)
-- =============================================================================
-- This script fixes the backend logic that validates user and branch limits
-- according to the company's subscription plan.
--
-- PROBLEM SOLVED:
-- 1. `get_caller_profile_safely` was returning plan limits with snake_case keys
--    (e.g., `max_users`), but the Edge Function for user creation expected
--    camelCase keys (e.g., `maxUsers`), causing the validation to fail.
-- 2. `create_sucursal` could fail silently if a company's license was not
--    correctly linked to a plan.
--
-- SOLUTION:
-- 1. The `get_caller_profile_safely` function is updated to correctly format
--    the keys of the `planLimits` object into camelCase.
-- 2. The `create_sucursal` function is hardened with an explicit check to ensure
--    a `plan_id` exists before checking limits.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Update `get_caller_profile_safely` with camelCase fix
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

    -- Dynamically build the planLimits object with camelCase keys
    SELECT jsonb_object_agg(
        -- Converts 'MAX_USERS' to 'maxUsers'
        lower(substring(replace(initcap(lower(replace(c.codigo_interno, '_', ' '))), ' ', '') from 1 for 1)) || 
        substring(replace(initcap(lower(replace(c.codigo_interno, '_', ' '))), ' ', '') from 2),
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


-- -----------------------------------------------------------------------------
-- Step 2: Update `create_sucursal` with robust plan_id check
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

    -- **ROBUSTNESS FIX**: Add a check for a missing plan_id
    IF plan_id_from_license IS NULL THEN
        RAISE EXCEPTION 'Error de consistencia de datos: La licencia de la empresa no está vinculada a un plan. Ejecute el script de reparación de datos.';
    END IF;

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

-- =============================================================================
-- End of script.
-- =============================================================================