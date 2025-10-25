-- =============================================================================
-- REVERT SCRIPT FOR: HOTFIX - ENSURE `verificar_stock_para_venta` FUNCTION EXISTS (V1)
-- =============================================================================
-- This script reverts the changes made by `97_HOTFIX_verify_stock_function.md`.
-- It drops the `verificar_stock_para_venta` function.
--
-- WARNING:
-- Running this script will re-introduce the "function not found" error on the
-- sale detail page for web orders.
-- =============================================================================

DROP FUNCTION IF EXISTS public.verificar_stock_para_venta(uuid);

-- =============================================================================
-- End of revert script.
-- =============================================================================