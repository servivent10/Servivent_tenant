-- =============================================================================
-- REVERT SCRIPT FOR: MANAGE ADD-ON MODULES (V1)
-- =============================================================================
-- This script reverts the changes made by `65_FEATURE_manage_modules.md`.
-- It drops the RPC functions used by the SuperAdmin to manage modules.
--
-- INSTRUCTIONS:
-- Execute this script to roll back the changes.
-- =============================================================================

-- Step 1: Drop the function to get all modules for management.
DROP FUNCTION IF EXISTS public.get_all_modulos_management();

-- Step 2: Drop the function to create or update a module.
DROP FUNCTION IF EXISTS public.upsert_modulo(jsonb);


-- =============================================================================
-- End of revert script.
-- =============================================================================