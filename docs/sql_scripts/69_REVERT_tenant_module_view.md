-- =============================================================================
-- REVERT SCRIPT FOR: TENANT FEATURE - VIEW ADD-ON MODULES STATUS (V1)
-- =============================================================================
-- This script reverts the changes made by `69_FEATURE_tenant_module_view.md`.
-- It drops the RPC function `get_my_company_modules_status`.
--
-- INSTRUCTIONS:
-- Execute this script to roll back the changes.
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_my_company_modules_status();

-- =============================================================================
-- End of revert script.
-- =============================================================================