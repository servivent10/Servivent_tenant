-- =============================================================================
-- REVERT SCRIPT FOR: PUBLIC MODULES FOR REGISTRATION (V1)
-- =============================================================================
-- This script reverts the changes made by `87_FEATURE_public_modules.md`.
-- =============================================================================

-- Step 1: Drop the `get_public_modules` RPC function
DROP FUNCTION IF EXISTS public.get_public_modules();

-- Step 2: Revert the RLS policy on `modulos` to its previous state
-- This removes public read access and restricts it to authenticated users again.
DROP POLICY IF EXISTS "Enable public read access for all users" ON public.modulos;
CREATE POLICY "Enable read access for authenticated users" ON public.modulos FOR SELECT USING (auth.role() = 'authenticated');


-- =============================================================================
-- End of revert script.
-- =============================================================================