-- =============================================================================
-- REVERT SCRIPT FOR: PLAN LIMITS ENFORCEMENT FIX (V1)
-- =============================================================================
-- This script reverts the changes made by `71_FIX_plan_limit_enforcement.md`.
-- It restores the previous (buggy) versions of `get_caller_profile_safely` and
-- `create_sucursal`.
--
-- WARNING: Running this script will re-introduce the bug that prevents the
-- correct enforcement of user and branch limits.
--
-- INSTRUCTIONS:
-- Execute this script to roll back the changes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Restore the previous version of `get_caller_profile_safely`
-- -----------------------------------------------------------------------------
-- This version incorrectly returns snake_case keys for plan limits.
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
        lower(c.codigo_interno),
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
-- Step 2: Restore the previous version of `create_sucursal`
-- -----------------------------------------------------------------------------
-- This version lacks the robust check for a null plan_id.
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

-- =============================================================================
-- End of revert script.
-- =============================================================================