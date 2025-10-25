-- =============================================================================
-- REVERT SCRIPT FOR: HOTFIX - ENSURE `confirmar_pedido_web` FUNCTION EXISTS (V1)
-- =============================================================================
-- This script reverts the changes made by `98_HOTFIX_confirm_order_function.md`.
-- It drops the `confirmar_pedido_web` function.
--
-- WARNING:
-- Running this script will re-introduce the "function not found" error when
-- confirming a web order.
-- =============================================================================

DROP FUNCTION IF EXISTS public.confirmar_pedido_web(uuid);

-- =============================================================================
-- End of revert script.
-- =============================================================================