-- =============================================================================
-- REVERT SCRIPT FOR: FIX TRASPASOS CASCADE DELETE (V1)
-- =============================================================================
-- This script REVERTS the changes made by `57_FIX_traspasos_cascade_delete.md`.
-- It changes the foreign key constraint on `traspaso_items.producto_id` back
-- to `ON DELETE RESTRICT`.
--
-- INSTRUCTIONS:
-- Execute this script to restore the original schema constraint.
-- =============================================================================

ALTER TABLE public.traspaso_items
DROP CONSTRAINT IF EXISTS traspaso_items_producto_id_fkey;

ALTER TABLE public.traspaso_items
ADD CONSTRAINT traspaso_items_producto_id_fkey
FOREIGN KEY (producto_id)
REFERENCES public.productos(id)
ON DELETE RESTRICT;

-- =============================================================================
-- End of revert script.
-- =============================================================================