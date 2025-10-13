-- =============================================================================
-- DATABASE HOTFIX SCRIPT: Add 'correo' Field to 'clientes' Table
-- =============================================================================
-- This script is a hotfix to resolve a persistent error: `record "new" has no
-- field "correo"` when creating a new client.
--
-- PROBLEM:
-- Despite previous attempts to fix the audit trigger, the error suggests that
-- some trigger or rule on the `clientes` table is incorrectly trying to
-- access a `correo` column, which does not exist (the correct name is `email`).
-- This indicates a persistent schema inconsistency or a faulty, undiscovered trigger.
--
-- SOLUTION (HOTFIX):
-- This script applies a direct and robust patch by making the `clientes` table
-- conform to what the faulty code expects, thus neutralizing the error.
-- 1. It adds the missing `correo` column to the `clientes` table.
-- 2. It creates a new trigger that automatically synchronizes the value from
--    the `email` column to the new `correo` column whenever a client is
--    created or updated.
--
-- This ensures that any code looking for `NEW.correo` will now find it,
-- resolving the error without needing to find the exact source of the fault.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

DO $$
BEGIN
    -- Step 1: Add the 'correo' column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='correo') THEN
        ALTER TABLE public.clientes ADD COLUMN correo text;
        RAISE NOTICE 'Paso 1/3: Columna "correo" añadida a la tabla "clientes".';
    ELSE
        RAISE NOTICE 'Paso 1/3: La columna "correo" ya existe en la tabla "clientes".';
    END IF;

    -- Step 2: Create the synchronization function
    CREATE OR REPLACE FUNCTION public.sync_cliente_email_to_correo()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $function$
    BEGIN
        -- Copy the value from the 'email' column to the 'correo' column
        NEW.correo := NEW.email;
        RETURN NEW;
    END;
    $function$;
    RAISE NOTICE 'Paso 2/3: Función de sincronización "sync_cliente_email_to_correo" creada/actualizada.';

    -- Step 3: Apply the trigger to the 'clientes' table
    DROP TRIGGER IF EXISTS before_cliente_insert_update_sync_email ON public.clientes;
    CREATE TRIGGER before_cliente_insert_update_sync_email
    BEFORE INSERT OR UPDATE ON public.clientes
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_cliente_email_to_correo();
    RAISE NOTICE 'Paso 3/3: Trigger de sincronización aplicado a la tabla "clientes".';

    RAISE NOTICE 'HOTFIX COMPLETADO: El problema al crear clientes debería estar resuelto.';
END;
$$;
