-- =============================================================================
-- PUBLIC MODULES FOR REGISTRATION - DATABASE SETUP (V1)
-- =============================================================================
-- This script implements the backend infrastructure for allowing prospective
-- customers to see and select add-on modules during the company registration flow.
--
-- WHAT IT DOES:
-- 1. Creates `get_public_modules`: A new RPC function that securely exposes
--    the list of available add-on modules.
-- 2. Applies a new RLS policy to the `modulos` table that allows anonymous
--    users to read from it, which is necessary for the registration page.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create the `get_public_modules` RPC function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_modules()
RETURNS TABLE (
    id uuid,
    nombre_visible text,
    descripcion text,
    precio_mensual numeric
)
LANGUAGE plpgsql
-- This function is intended for public access and does not require elevated privileges.
-- We use SECURITY INVOKER (the default) and rely on the RLS policy for access control.
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.nombre_visible,
        m.descripcion,
        m.precio_mensual
    FROM public.modulos m
    ORDER BY m.nombre_visible;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 2: Update RLS policy on `modulos` table for public access
-- -----------------------------------------------------------------------------
-- Drop the old policy which restricted access to authenticated users.
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.modulos;

-- Create a new, more permissive policy that allows ANYONE to read the modules.
-- This is safe because the table does not contain sensitive company-specific data.
CREATE POLICY "Enable public read access for all users" ON public.modulos
FOR SELECT USING (true);


-- =============================================================================
-- End of script.
-- =============================================================================