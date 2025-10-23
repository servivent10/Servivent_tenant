-- =============================================================================
-- DATABASE HARDENING SCRIPT: FIX TRASPASOS & PROFORMAS CASCADE DELETE (V1)
-- =============================================================================
-- This script fixes a "violates foreign key constraint" error that occurs when
-- deleting a company that has a history of inventory transfers (traspasos) or
-- proformas.
--
-- PROBLEM:
-- The `traspaso_items` and `proforma_items` tables had a foreign key to
-- `productos(id)` with an `ON DELETE RESTRICT` rule. This prevented the
-- `productos` table from being deleted during a company deletion cascade if
-- any transfers or proformas had been made.
--
-- SOLUTION:
-- This script changes the foreign key constraints to use `ON DELETE CASCADE`.
-- Now, when a product is deleted as part of the company deletion process,
-- all associated transfer and proforma item records will also be deleted
-- automatically, allowing the full cascade to complete successfully.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- It is safe to run multiple times.
-- =============================================================================

-- Step 1: Fix the `traspaso_items` foreign key constraint.
-- The name 'traspaso_items_producto_id_fkey' is the default name Supabase creates.
ALTER TABLE public.traspaso_items
DROP CONSTRAINT IF EXISTS traspaso_items_producto_id_fkey;

ALTER TABLE public.traspaso_items
ADD CONSTRAINT traspaso_items_producto_id_fkey
FOREIGN KEY (producto_id)
REFERENCES public.productos(id)
ON DELETE CASCADE;

-- Step 2: Fix the `proforma_items` foreign key constraint.
ALTER TABLE public.proforma_items
DROP CONSTRAINT IF EXISTS proforma_items_producto_id_fkey;

ALTER TABLE public.proforma_items
ADD CONSTRAINT proforma_items_producto_id_fkey
FOREIGN KEY (producto_id)
REFERENCES public.productos(id)
ON DELETE CASCADE;


-- =============================================================================
-- End of script. The company deletion process is now fully hardened for the
-- traspasos and proformas modules.
-- =============================================================================