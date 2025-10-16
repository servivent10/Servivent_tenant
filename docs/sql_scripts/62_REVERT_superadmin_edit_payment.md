-- =============================================================================
-- REVERT SCRIPT FOR: SUPERADMIN FEATURE - EDIT PAYMENT AND LICENSE DATE (V1)
-- =============================================================================
-- This script REVERTS the changes made by `61_FEATURE_superadmin_edit_payment.md`.
-- It drops the functions related to editing payments and license dates from
-- the SuperAdmin panel.
--
-- INSTRUCTIONS:
-- Execute this script to roll back the changes.
-- =============================================================================

-- Step 1: Drop the function to update the license end date.
DROP FUNCTION IF EXISTS public.update_license_end_date_as_superadmin(uuid, date);

-- Step 2: Drop the function to update both a payment and the license end date.
DROP FUNCTION IF EXISTS public.update_payment_and_license_as_superadmin(uuid, timestamptz, text, numeric, text, date, uuid);


-- =============================================================================
-- End of revert script.
-- =============================================================================