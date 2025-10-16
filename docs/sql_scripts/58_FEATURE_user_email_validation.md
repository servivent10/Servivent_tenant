-- =============================================================================
-- USER EMAIL VALIDATION FEATURE (V1)
-- =============================================================================
-- This script creates the backend RPC function needed for real-time email
-- validation in the "Add User" form. It mirrors the logic from the client
-- validation but targets the `auth.users` table.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.validate_user_email(p_correo text, p_user_id_to_exclude uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- If the email is null or empty, it's valid (it's required by the form, but this is a safeguard)
    IF p_correo IS NULL OR TRIM(p_correo) = '' THEN
        RETURN '{"valid": true}'::json;
    END IF;

    -- Validate email format and provider with a regular expression
    -- Accepts common domains like gmail, hotmail, outlook, yahoo, icloud.
    IF NOT (p_correo ~* '^[a-zA-Z0-9._%+-]+@(gmail|hotmail|outlook|yahoo|icloud)\.(com|es|net|org)$') THEN
        RETURN json_build_object('valid', false, 'reason', 'format');
    END IF;

    -- Validate uniqueness if the format is correct
    -- **CRITICAL**: This check MUST be on `auth.users`, not `public.usuarios`, as `auth.users` is the source of truth for email uniqueness.
    IF EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.email = p_correo
          AND (p_user_id_to_exclude IS NULL OR u.id != p_user_id_to_exclude)
    ) THEN
        RETURN json_build_object('valid', false, 'reason', 'exists');
    END IF;

    -- If all validations pass
    RETURN '{"valid": true}'::json;
END;
$$;
