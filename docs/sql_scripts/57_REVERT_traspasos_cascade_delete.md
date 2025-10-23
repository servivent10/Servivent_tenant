-- =============================================================================
-- REVERT SCRIPT FOR: FIX TRASPASOS & PROFORMAS CASCADE DELETE (V1)
-- =============================================================================
-- This script REVERTS the changes made by `57_FIX_traspasos_cascade_delete.md`.
-- It changes the foreign key constraints on `traspaso_items.producto_id` and
-- `proforma_items.producto_id` back to `ON DELETE RESTRICT`.
--
-- INSTRUCTIONS:
-- Execute this script to restore the original schema constraints.
-- =============================================================================

-- Revert traspaso_items
ALTER TABLE public.traspaso_items
DROP CONSTRAINT IF EXISTS traspaso_items_producto_id_fkey;

ALTER TABLE public.traspaso_items
ADD CONSTRAINT traspaso_items_producto_id_fkey
FOREIGN KEY (producto_id)
REFERENCES public.productos(id)
ON DELETE RESTRICT;

-- Revert proforma_items
ALTER TABLE public.proforma_items
DROP CONSTRAINT IF EXISTS proforma_items_producto_id_fkey;

ALTER TABLE public.proforma_items
ADD CONSTRAINT proforma_items_producto_id_fkey
FOREIGN KEY (producto_id)
REFERENCES public.productos(id)
ON DELETE RESTRICT;

-- =============================================================================
-- End of revert script.
-- =============================================================================