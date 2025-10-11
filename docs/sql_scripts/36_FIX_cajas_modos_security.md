-- =============================================================================
-- CASH REGISTER MODES SECURITY FIX SCRIPT
-- =============================================================================
-- This script enhances the cash register modes feature with a critical security
-- layer and a helper function for the UI.
--
-- WHAT IT DOES:
-- 1. Creates `check_any_open_sessions()`: A new RPC function that allows the
--    frontend to quickly check if any cash sessions are open across the company.
-- 2. Updates `update_company_info`: This function now prevents a change in
--    `modo_caja` if any cash sessions are currently 'ABIERTA', preventing
--    data inconsistencies.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create a helper function to check for any open sessions in the company
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_any_open_sessions()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.sesiones_caja
        WHERE empresa_id = caller_empresa_id AND estado = 'ABIERTA'
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 2: Update `update_company_info` to prevent mode change with open sessions
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_company_info(text, text, text, text);
CREATE OR REPLACE FUNCTION update_company_info(
    p_nombre text,
    p_nit text,
    p_logo text,
    p_modo_caja text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
    current_modo_caja text;
    open_sessions_count integer;
BEGIN
    SELECT empresa_id, rol INTO caller_empresa_id, caller_rol
    FROM public.usuarios WHERE id = auth.uid();

    IF caller_rol != 'Propietario' THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de Propietario.';
    END IF;

    -- Check if the modo_caja is actually being changed
    SELECT modo_caja INTO current_modo_caja FROM public.empresas WHERE id = caller_empresa_id;

    IF p_modo_caja != current_modo_caja THEN
        -- If it is changing, check for any open sessions in the entire company
        SELECT COUNT(*) INTO open_sessions_count
        FROM public.sesiones_caja
        WHERE empresa_id = caller_empresa_id AND estado = 'ABIERTA';

        IF open_sessions_count > 0 THEN
            RAISE EXCEPTION 'No se puede cambiar el modo de operación mientras haya cajas abiertas en la empresa. Cierre todas las sesiones primero.';
        END IF;
    END IF;

    -- Proceed with the update
    UPDATE public.empresas
    SET
        nombre = p_nombre,
        nit = p_nit,
        logo = p_logo,
        modo_caja = p_modo_caja
    WHERE id = caller_empresa_id;
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================