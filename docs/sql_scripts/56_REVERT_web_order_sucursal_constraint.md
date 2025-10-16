-- =============================================================================
-- REVERT SCRIPT FOR: WEB ORDER SUCURSAL CONSTRAINT FIX (V1)
-- =============================================================================
-- This script REVERTS the changes made by `56_FIX_web_order_sucursal_constraint.md`.
-- It re-adds the `NOT NULL` constraint to the `ventas.sucursal_id` column.
--
-- WARNING:
-- This will fail if there are any existing rows in the `ventas` table where
-- `sucursal_id` is NULL. Before running this, you must ensure all sales records
-- have a valid `sucursal_id` assigned.
--
-- INSTRUCTIONS:
-- Execute this script to restore the original schema constraint.
-- =============================================================================

-- Step 1: Add back the NOT NULL constraint to the sucursal_id column.
ALTER TABLE public.ventas
ALTER COLUMN sucursal_id SET NOT NULL;

-- =============================================================================
-- End of revert script.
-- =============================================================================