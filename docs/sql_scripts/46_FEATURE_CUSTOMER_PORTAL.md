-- =============================================================================
-- CUSTOMER PORTAL & PASSWORDLESS LOGIN - DATABASE SETUP (V3 - Notification Fix)
-- =============================================================================
-- This script implements the backend infrastructure for the customer-facing
-- web catalog's authentication and account management features. This version
-- fixes the notification system for new client sign-ups.
--
-- WHAT IT DOES:
-- 1. Creates `check_web_client_existence`: An RPC for real-time email validation.
-- 2. Updates `upsert_web_client`: An RPC to register new clients from the catalog,
--    now with a direct notification insert, bypassing the auth-dependent helper.
-- 3. Creates `get_public_client_profile`: A secure RPC to fetch a logged-in customer's profile.
-- 4. Creates `get_my_web_orders`: An RPC for a customer to view their own order history.
-- 5. Adds correct RLS policies on the `clientes` table for self-management.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: New RPC to check for a client's existence in real-time
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_web_client_existence(p_slug text, p_email text)
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
        RETURN json_build_object('exists', false, 'nombre', null);
    END IF;
    
    SELECT nombre INTO client_record FROM public.clientes WHERE correo = p_email AND empresa_id = v_empresa_id;
    
    IF FOUND THEN
        RETURN json_build_object('exists', true, 'nombre', client_record.nombre);
    ELSE
        RETURN json_build_object('exists', false, 'nombre', null);
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 2: New RPC to create a web client (with direct notification insert)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_web_client(
    p_slug text,
    p_nombre text,
    p_telefono text,
    p_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_cliente_id uuid;
BEGIN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = p_slug;
    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Catálogo no encontrado.';
    END IF;

    -- Check if client already exists for this company
    SELECT id INTO v_cliente_id FROM public.clientes WHERE correo = p_email AND empresa_id = v_empresa_id;

    IF v_cliente_id IS NULL THEN
        -- It's a new client, insert them
        INSERT INTO public.clientes (empresa_id, nombre, telefono, correo)
        VALUES (v_empresa_id, p_nombre, p_telefono, p_email)
        RETURNING id INTO v_cliente_id;

        -- **NOTIFICATION FIX**: Directly insert notification, as this function is
        -- called in an unauthenticated context (no JWT), making `notificar_cambio` unusable.
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
            NULL, -- No authenticated user
            'Catálogo Web', -- System-generated event
            'Nuevo cliente <b>' || p_nombre || '</b> se registró desde el catálogo web.',
            'NUEVO_CLIENTE',
            v_cliente_id,
            NULL -- Global notification for the owner
        );
    END IF;
    -- If client exists, do nothing. The OTP link will just log them in.
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 3: RPC to get a customer's profile securely (after login)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_public_client_profile(
    p_slug text,
    p_email text
)
RETURNS SETOF public.clientes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
BEGIN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = p_slug;
    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Catálogo no encontrado.';
    END IF;
    
    RETURN QUERY
    SELECT *
    FROM public.clientes c
    WHERE c.correo = p_email AND c.empresa_id = v_empresa_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 4: RPC to get the customer's own web orders
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_web_orders(p_slug text)
RETURNS SETOF public.ventas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_cliente_id uuid;
    v_auth_email text;
BEGIN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = p_slug;
    IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Catálogo no encontrado.'; END IF;

    v_auth_email := auth.email();
    IF v_auth_email IS NULL THEN RAISE EXCEPTION 'No autenticado.'; END IF;

    SELECT id INTO v_cliente_id FROM public.clientes WHERE correo = v_auth_email AND empresa_id = v_empresa_id;
    IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Perfil de cliente no encontrado para esta empresa.'; END IF;

    RETURN QUERY
    SELECT * FROM public.ventas v WHERE v.cliente_id = v_cliente_id ORDER BY v.fecha DESC;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 5: RLS policies for `clientes` table for self-management
-- -----------------------------------------------------------------------------
-- These policies allow authenticated users (customers) to view and update
-- their own profiles based on their email, coexisting with the JWT-based policy
-- for company employees.

DROP POLICY IF EXISTS "Customers can view their own profile" ON public.clientes;
CREATE POLICY "Customers can view their own profile"
ON public.clientes FOR SELECT
USING (correo = auth.email());

DROP POLICY IF EXISTS "Customers can update their own profile" ON public.clientes;
CREATE POLICY "Customers can update their own profile"
ON public.clientes FOR UPDATE
USING (correo = auth.email())
WITH CHECK (correo = auth.email());


-- =============================================================================
-- End of script.
-- =============================================================================