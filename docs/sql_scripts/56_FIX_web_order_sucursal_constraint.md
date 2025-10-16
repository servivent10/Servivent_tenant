-- =============================================================================
-- WEB ORDER SUCURSAL CONSTRAINT FIX (V1)
-- =============================================================================
-- This script fixes a critical "violates not-null constraint" error that occurs
-- when a customer places a web order for home delivery.
--
-- PROBLEM:
-- The business logic dictates that home delivery orders should not be assigned
-- to a specific branch (sucursal_id should be NULL) to be visible to all
-- relevant staff. However, the `ventas` table had a `NOT NULL` constraint
-- on the `sucursal_id` column, making it impossible to insert these orders.
--
-- SOLUTION:
-- This script removes the `NOT NULL` constraint from the `ventas.sucursal_id`
-- column, allowing it to accept NULL values. This aligns the database schema
-- with the application's intended logic for handling global, company-wide orders.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- Step 1: Remove the NOT NULL constraint from the sucursal_id column in the ventas table.
ALTER TABLE public.ventas
ALTER COLUMN sucursal_id DROP NOT NULL;

-- =============================================================================
-- End of script.
-- =============================================================================