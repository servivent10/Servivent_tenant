-- =============================================================================
-- CUSTOMER PORTAL & EMAIL/PASSWORD LOGIN - DATABASE SETUP (V3 - Security & Notifications Fix)
-- =============================================================================
-- This script implements the backend infrastructure for the customer-facing
-- web catalog's authentication and account management features using a robust
-- email and password system.
-- VERSION 3:
--  - Adds `SECURITY DEFINER` to RPCs to bypass RLS, fixing infinite loading.
--  - Adds a new trigger on `clientes` to notify of new web sign-ups.
--
-- WHAT IT DOES:
-- 1.  Adds an `auth_user_id` column to `clientes`.
-- 2.  Creates a trigger to auto-create client profiles on new sign-ups.
-- 3.  Creates `validate_client_email_status` for the "smart" registration form.
-- 4.  Creates secure `get_my_web_orders` and `get_my_client_profile` RPCs.
-- 5.  Adds RLS policies on `clientes` for self-management.
-- 6.  Adds a trigger to `clientes` to generate notifications on new web sign-ups.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Add the link column to the `clientes` table
-- -----------------------------------------------------------------------------
-- This column will store the UUID from auth.users, linking the two.
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;


-- -----------------------------------------------------------------------------
-- Step 2: Trigger to create a client profile on new user sign-up (FIXED)
-- -----------------------------------------------------------------------------
-- When a user signs up via the catalog, this trigger automatically creates their
-- corresponding profile in the `clientes` table.
CREATE OR REPLACE FUNCTION public.create_client_profile_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_slug text;
BEGIN
    -- The frontend must pass 'slug', 'nombre', and 'telefono' in the `options.data` of the signUp call.
    -- **FIX**: Read 'slug' from `raw_user_meta_data`, not `raw_app_meta_data`.
    v_slug := NEW.raw_user_meta_data ->> 'slug';

    IF v_slug IS NOT NULL THEN
        SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = v_slug;

        -- Only insert if the client doesn't already exist for that company
        IF v_empresa_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.clientes WHERE correo = NEW.email AND empresa_id = v_empresa_id) THEN
            INSERT INTO public.clientes (empresa_id, nombre, correo, telefono, auth_user_id)
            VALUES (
                v_empresa_id,
                NEW.raw_user_meta_data ->> 'nombre',
                NEW.email,
                NEW.raw_user_meta_data ->> 'telefono',
                NEW.id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_auth_user_create_client_profile ON auth.users;
CREATE TRIGGER on_new_auth_user_create_client_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_client_profile_for_new_user();


-- -----------------------------------------------------------------------------
-- Step 3: RPC for the "smart" registration form
-- -----------------------------------------------------------------------------
-- This function checks an email's status to determine the registration flow.
CREATE OR REPLACE FUNCTION public.validate_client_email_status(p_slug text, p_correo text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    client_record record;
BEGIN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = p_slug;
    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Catálogo no encontrado.';
    END IF;

    SELECT nombre, auth_user_id INTO client_record
    FROM public.clientes
    WHERE correo = p_correo AND empresa_id = v_empresa_id;

    IF NOT FOUND THEN
        -- The email is not in the system for this company at all.
        RETURN json_build_object('status', 'new', 'nombre', null);
    ELSIF client_record.auth_user_id IS NULL THEN
        -- The email exists as a client, but has no web account yet.
        RETURN json_build_object('status', 'exists_unlinked', 'nombre', client_record.nombre);
    ELSE
        -- The client already has a web account.
        RETURN json_build_object('status', 'exists_linked', 'nombre', client_record.nombre);
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 4: RPCs for the Customer Portal (FIXED WITH SECURITY DEFINER)
-- -----------------------------------------------------------------------------

-- Get the currently logged-in customer's profile
DROP FUNCTION IF EXISTS public.get_public_client_profile(text, text);
CREATE OR REPLACE FUNCTION get_my_client_profile(p_slug text)
RETURNS SETOF public.clientes
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.clientes c
    WHERE c.auth_user_id = auth.uid()
      AND c.empresa_id = (SELECT e.id FROM public.empresas e WHERE e.slug = p_slug);
END;
$$;

-- Get the currently logged-in customer's order history
DROP FUNCTION IF EXISTS public.get_my_web_orders(text);
CREATE OR REPLACE FUNCTION get_my_web_orders(p_slug text)
RETURNS SETOF public.ventas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_cliente_id uuid;
BEGIN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = p_slug;
    IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Catálogo no encontrado.'; END IF;

    SELECT id INTO v_cliente_id FROM public.clientes WHERE auth_user_id = auth.uid() AND empresa_id = v_empresa_id;
    IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Perfil de cliente no encontrado para esta empresa.'; END IF;

    RETURN QUERY
    SELECT * FROM public.ventas v WHERE v.cliente_id = v_cliente_id ORDER BY v.fecha DESC;
END;
$$;

-- -----------------------------------------------------------------------------
-- Step 5: Update RLS policies for `clientes` for self-management
-- -----------------------------------------------------------------------------
-- Allows customers to view their own profile. Combines with the employee policy.
DROP POLICY IF EXISTS "Customers can view their own profile" ON public.clientes;
CREATE POLICY "Customers can view their own profile"
ON public.clientes FOR SELECT
USING (auth_user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- Step 6: Trigger to generate a notification on new web client sign-up
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_new_web_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- This trigger fires AFTER a new client is inserted.
    -- We check if `auth_user_id` is NOT NULL, which indicates it's a signup from the web catalog
    -- (as opposed to manual creation by an employee, where this field would be null).
    IF TG_OP = 'INSERT' AND NEW.auth_user_id IS NOT NULL THEN
        INSERT INTO public.notificaciones (
            empresa_id,
            usuario_generador_id,
            usuario_generador_nombre,
            mensaje,
            tipo_evento,
            entidad_id,
            sucursales_destino_ids
        ) VALUES (
            NEW.empresa_id,
            NULL, -- No specific user, it's a system event
            'Catálogo Web',
            'Un cliente nuevo <b>' || NEW.nombre || '</b> (' || NEW.telefono || ') se registró desde el catálogo web.',
            'NUEVO_CLIENTE',
            NEW.id, -- The ID of the new client record
            NULL -- Global notification for the owner/admins
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_client_from_web ON public.clientes;
CREATE TRIGGER on_new_client_from_web
AFTER INSERT ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_new_web_client();


-- =============================================================================
-- End of script.
-- =============================================================================