-- =============================================================================
-- REALTIME UPDATES FOR CASH REGISTER & COMPANY SETTINGS
-- =============================================================================
-- This script enables real-time updates for cash register operations and
-- company-wide settings like the cash register mode.
--
-- WHAT IT DOES:
-- 1. Adds the `empresas` table to the `supabase_realtime` publication, so
--    changes to company settings are broadcasted.
-- 2. Updates the `get_sesion_activa` RPC function to return not only the active
--    session but also the current `modo_caja`, allowing clients to update their
--    UI in real-time when the mode changes.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Add `empresas` table to the realtime publication
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.empresas;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Table "empresas" is already in the publication.';
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 2: Update `get_sesion_activa` to return `modo_caja`
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_sesion_activa();
CREATE OR REPLACE FUNCTION get_sesion_activa()
RETURNS json -- Returns a JSON object with session details and the current mode
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_user_id uuid := auth.uid();
    caller_sucursal_id uuid;
    v_modo_caja text;
    session_data json;
BEGIN
    -- Get the user's branch and the company's cash register mode in one query
    SELECT u.sucursal_id, e.modo_caja 
    INTO caller_sucursal_id, v_modo_caja
    FROM public.usuarios u
    JOIN public.empresas e ON u.empresa_id = e.id
    WHERE u.id = caller_user_id;

    -- Find the active session based on the current mode
    IF v_modo_caja = 'por_usuario' THEN
        SELECT to_json(sc) INTO session_data
        FROM (
            SELECT sc.id, sc.fecha_apertura, sc.saldo_inicial, u.nombre_completo as usuario_apertura_nombre
            FROM public.sesiones_caja sc
            JOIN public.usuarios u ON sc.usuario_apertura_id = u.id
            WHERE sc.usuario_apertura_id = caller_user_id AND sc.estado = 'ABIERTA'
            LIMIT 1
        ) sc;
    ELSE -- Default to 'por_sucursal'
        SELECT to_json(sc) INTO session_data
        FROM (
            SELECT sc.id, sc.fecha_apertura, sc.saldo_inicial, u.nombre_completo as usuario_apertura_nombre
            FROM public.sesiones_caja sc
            JOIN public.usuarios u ON sc.usuario_apertura_id = u.id
            WHERE sc.sucursal_id = caller_sucursal_id AND sc.estado = 'ABIERTA'
            LIMIT 1
        ) sc;
    END IF;

    -- Return a structured object containing both the session and the mode
    RETURN json_build_object(
        'session', session_data,
        'modo_caja', v_modo_caja
    );
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================
