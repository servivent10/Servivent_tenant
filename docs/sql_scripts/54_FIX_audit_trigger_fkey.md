-- =============================================================================
-- AUDIT TRIGGER FOREIGN KEY FIX (V1)
-- =============================================================================
-- This script fixes a critical "violates foreign key constraint" error on the
-- `historial_cambios` table that occurs when an action is performed by a
-- non-tenant user, such as a customer placing a web order.
--
-- PROBLEM:
-- The `historial_cambios.usuario_id` column had a foreign key constraint
-- referencing `public.usuarios(id)`. However, web customers have an ID in
-- `auth.users` but do NOT have a profile in `public.usuarios`. When a customer
-- action (like creating a 'venta') triggered the audit log, the trigger tried
-- to insert the customer's `auth.uid()`, which doesn't exist in `public.usuarios`,
-- causing the entire transaction to fail.
--
-- SOLUTION:
-- The foreign key constraint on `historial_cambios.usuario_id` is removed.
-- The `usuario_id` column is preserved as a `uuid` to continue storing the
-- actor's ID, but the database no longer enforces that this ID must exist
-- in the `public.usuarios` table. This makes the audit system compatible with
-- multiple actor types (tenants, customers, system processes).
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- Step 1: Drop the foreign key constraint from the `historial_cambios` table.
ALTER TABLE public.historial_cambios
DROP CONSTRAINT IF EXISTS historial_cambios_usuario_id_fkey;

-- NOTE: The trigger function `registrar_cambio` does not need to be modified.
-- It will continue to correctly log the `auth.uid()` of the actor, and the
-- INSERT will now succeed without the constraint.

-- =============================================================================
-- End of script.
-- =============================================================================
