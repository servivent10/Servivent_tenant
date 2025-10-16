-- =============================================================================
-- DATABASE HARDENING SCRIPT: FIX TRASPASOS CASCADE DELETE (V1)
-- =============================================================================
-- This script fixes a "violates foreign key constraint" error that occurs when
-- deleting a company that has a history of inventory transfers (traspasos).
--
-- PROBLEM:
-- The `traspaso_items` table had a foreign key to `productos(id)` with an
-- `ON DELETE RESTRICT` rule. This prevented the `productos` table from being
-- deleted during a company deletion cascade if any transfers had been made.
--
-- SOLUTION:
-- This script changes the foreign key constraint to use `ON DELETE CASCADE`.
-- Now, when a product is deleted as part of the company deletion process,
-- all associated transfer item records will also be deleted automatically,
-- allowing the full cascade to complete successfully.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- It is safe to run multiple times.
-- =============================================================================

-- Step 1: Drop the old restrictive constraint and add the new cascading one.
-- The name 'traspaso_items_producto_id_fkey' is the default name Supabase creates.
ALTER TABLE public.traspaso_items
DROP CONSTRAINT IF EXISTS traspaso_items_producto_id_fkey;

ALTER TABLE public.traspaso_items
ADD CONSTRAINT traspaso_items_producto_id_fkey
FOREIGN KEY (producto_id)
REFERENCES public.productos(id)
ON DELETE CASCADE;

-- =============================================================================
-- End of script. The company deletion process is now fully hardened for the
-- traspasos module.
-- =============================================================================