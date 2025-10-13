-- =============================================================================
-- DATABASE FIX SCRIPT: Resolve Client Creation Trigger Error (V2 - Syntax Fix)
-- =============================================================================
-- This script fixes the error `record "new" has no field "correo"` that occurs
-- when creating a new client. Version 2 corrects a syntax error with RAISE NOTICE.
--
-- PROBLEM:
-- The error indicates that a trigger function being executed on the `clientes`
-- table is attempting to access a `correo` column, but the correct column name
-- is `email`. This likely happened if an incorrect version of the generic audit
-- trigger function (`registrar_cambio`) was applied.
--
-- SOLUTION:
-- This script safely and idempotently resolves the issue by:
-- 1. Re-defining the generic `registrar_cambio()` function to ensure it's the
--    correct, non-specific version.
-- 2. Explicitly dropping and recreating the trigger on the `clientes` table
--    to ensure it points to the correct, generic function.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor. It's safe to run
-- multiple times.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Re-define the generic `registrar_cambio` function to ensure correctness
-- -----------------------------------------------------------------------------
-- This function is designed to be generic and work with any table. It does not
-- access columns by specific names like `correo` or `email`.
CREATE OR REPLACE FUNCTION public.registrar_cambio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_usuario_nombre text;
    v_registro_id text;
BEGIN
    -- Get user and company info from JWT to prevent RLS recursion
    v_usuario_id := auth.uid();
    v_empresa_id := public.get_empresa_id_from_jwt();
    v_usuario_nombre := (auth.jwt() -> 'app_metadata' ->> 'nombre_completo')::text;

    -- Determine which row's ID to use (works for INSERT, UPDATE, DELETE)
    IF TG_OP = 'DELETE' THEN
        v_registro_id := OLD.id::text;
    ELSE
        v_registro_id := NEW.id::text;
    END IF;

    -- Insert the generic audit record
    INSERT INTO public.historial_cambios (
        usuario_id,
        usuario_nombre,
        accion,
        tabla_afectada,
        registro_id,
        datos_anteriores,
        datos_nuevos,
        empresa_id
    )
    VALUES (
        v_usuario_id,
        v_usuario_nombre,
        TG_OP,
        TG_TABLE_NAME,
        v_registro_id,
        to_jsonb(OLD),
        to_jsonb(NEW),
        v_empresa_id
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 2: Explicitly drop and recreate the trigger on the `clientes` table
-- -----------------------------------------------------------------------------
-- This block ensures the `clientes` table is using the correct trigger function
-- and allows the use of RAISE NOTICE.
DO $$
BEGIN
    RAISE NOTICE 'Paso 1/2: Función de auditoría "registrar_cambio" redefinida a su versión correcta y genérica.';

    DROP TRIGGER IF EXISTS on_clientes_change ON public.clientes;

    CREATE TRIGGER on_clientes_change
    AFTER INSERT OR UPDATE OR DELETE ON public.clientes
    FOR EACH ROW EXECUTE FUNCTION public.registrar_cambio();

    RAISE NOTICE 'Paso 2/2: Trigger de auditoría para la tabla "clientes" reinstalado correctamente.';
END;
$$;

-- =============================================================================
-- End of script. The error when creating clients should now be resolved.
-- =============================================================================
