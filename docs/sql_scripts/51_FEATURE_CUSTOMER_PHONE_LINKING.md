-- =============================================================================
-- CUSTOMER PORTAL: PHONE LINKING & REGISTRATION FLOW ENHANCEMENT (V1)
-- =============================================================================
-- This script enhances the customer registration flow by allowing existing clients
-- (without a web account) to link their profile using their phone number when
-- signing up with a new email address.
--
-- WHAT IT DOES:
-- 1. Creates `find_client_by_phone`: A new RPC to check if a phone number
--    already exists for a client without a web account.
-- 2. Updates `create_client_profile_for_new_user`: The trigger function that
--    runs on new user sign-up is enhanced to handle an optional `existingClientId`
--    parameter, allowing it to link the new auth account to an existing client
--    profile instead of creating a new one.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create the RPC function `find_client_by_phone`
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_client_by_phone(p_slug text, p_telefono text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_empresa_id uuid;
    client_record record;
BEGIN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = p_slug;
    IF v_empresa_id IS NULL THEN
        RETURN json_build_object('found', false, 'client', null);
    END IF;
    
    -- Find a client with the given phone number for the specific company,
    -- but only if they don't already have a web account linked.
    SELECT id, nombre INTO client_record 
    FROM public.clientes 
    WHERE telefono = p_telefono 
      AND empresa_id = v_empresa_id
      AND auth_user_id IS NULL
    LIMIT 1;
    
    IF FOUND THEN
        RETURN json_build_object('found', true, 'client', row_to_json(client_record));
    ELSE
        RETURN json_build_object('found', false, 'client', null);
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Step 2: Update the `create_client_profile_for_new_user` trigger function
-- -----------------------------------------------------------------------------
-- This adds the logic to check for `existingClientId` in the user metadata.
CREATE OR REPLACE FUNCTION public.create_client_profile_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_slug text;
    v_existing_client_id uuid;
BEGIN
    -- Extract metadata passed from the frontend signUp call.
    v_slug := NEW.raw_user_meta_data ->> 'slug';
    v_existing_client_id := (NEW.raw_user_meta_data ->> 'existingClientId')::uuid;

    IF v_slug IS NOT NULL THEN
        SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = v_slug;

        IF v_empresa_id IS NOT NULL THEN
            IF v_existing_client_id IS NOT NULL THEN
                -- An existing client was found via phone number. Link this new auth user to them.
                UPDATE public.clientes
                SET 
                    auth_user_id = NEW.id,
                    correo = NEW.email, -- Update their email to the new one
                    nombre = NEW.raw_user_meta_data ->> 'nombre', -- Also update name and phone if provided
                    telefono = NEW.raw_user_meta_data ->> 'telefono'
                WHERE id = v_existing_client_id AND empresa_id = v_empresa_id;
            ELSE
                -- Standard flow: create a new client profile if one doesn't exist for this email.
                IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE correo = NEW.email AND empresa_id = v_empresa_id) THEN
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
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================
