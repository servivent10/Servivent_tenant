-- =============================================================================
-- CUSTOMER PORTAL: PHONE LINKING NOTIFICATION FIX (V1)
-- =============================================================================
-- This script fixes an issue where a system notification was not being generated
-- when an existing client (without an email) links their web account for the
-- first time using their phone number.
--
-- WHAT IT DOES:
-- 1. Updates `create_client_profile_for_new_user`: The trigger function that
--    runs on new user sign-up is enhanced. When it detects it's linking an
--    existing client (`existingClientId` is present), it now manually inserts
--    a notification into the `public.notificaciones` table.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Update the `create_client_profile_for_new_user` trigger function
-- -----------------------------------------------------------------------------
-- This adds the logic to manually insert a notification during the linking process.
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

                -- **NEW LOGIC**: Manually insert notification because this is an UPDATE, not an INSERT.
                INSERT INTO public.notificaciones (
                    empresa_id,
                    usuario_generador_id,
                    usuario_generador_nombre,
                    mensaje,
                    tipo_evento,
                    entidad_id,
                    sucursales_destino_ids
                ) VALUES (
                    v_empresa_id,
                    NULL, -- System event, no specific user
                    'Catálogo Web',
                    'El cliente existente <b>' || (NEW.raw_user_meta_data ->> 'nombre') || '</b> (' || (NEW.raw_user_meta_data ->> 'telefono') || ') vinculó su cuenta web.',
                    'NUEVO_CLIENTE', -- Using the same event type is fine for UI consistency
                    v_existing_client_id, -- Link to the client's profile
                    NULL -- Global notification for the owner/admins
                );
            ELSE
                -- Standard flow: create a new client profile if one doesn't exist for this email.
                -- The `on_new_client_from_web` trigger will handle the notification for this INSERT case.
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
