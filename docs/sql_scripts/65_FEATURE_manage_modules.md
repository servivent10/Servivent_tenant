-- =============================================================================
-- SUPERADMIN FEATURE: MANAGE ADD-ON MODULES (V1)
-- =============================================================================
-- This script creates the backend RPC functions necessary for the SuperAdmin
-- to create and edit the available Add-on Modules from a dedicated UI.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Function 1: Get all modules for the management page
-- -----------------------------------------------------------------------------
-- Fetches a complete list of all modules in the system for the SuperAdmin to manage.
CREATE OR REPLACE FUNCTION get_all_modulos_management()
RETURNS TABLE (
    id uuid,
    codigo_interno text,
    nombre_visible text,
    descripcion text,
    precio_mensual numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.rol = 'SuperAdmin') THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de SuperAdmin.';
    END IF;

    RETURN QUERY
    SELECT
        m.id,
        m.codigo_interno,
        m.nombre_visible,
        m.descripcion,
        m.precio_mensual
    FROM public.modulos m
    ORDER BY m.nombre_visible;
END;
$$;


-- -----------------------------------------------------------------------------
-- Function 2: Create or update (upsert) a module
-- -----------------------------------------------------------------------------
-- Allows the SuperAdmin to create a new module or update an existing one's
-- details (except for the `codigo_interno`, which is immutable after creation).
CREATE OR REPLACE FUNCTION upsert_modulo(p_modulo jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_modulo_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.rol = 'SuperAdmin') THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de SuperAdmin.';
    END IF;
    
    v_modulo_id := (p_modulo->>'id')::uuid;

    IF v_modulo_id IS NULL OR v_modulo_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
        -- INSERT a new module
        INSERT INTO public.modulos (codigo_interno, nombre_visible, descripcion, precio_mensual)
        VALUES (
            p_modulo->>'codigo_interno',
            p_modulo->>'nombre_visible',
            p_modulo->>'descripcion',
            (p_modulo->>'precio_mensual')::numeric
        ) RETURNING id INTO v_modulo_id;
    ELSE
        -- UPDATE an existing module
        UPDATE public.modulos SET
            nombre_visible = p_modulo->>'nombre_visible',
            descripcion = p_modulo->>'descripcion',
            precio_mensual = (p_modulo->>'precio_mensual')::numeric
            -- The 'codigo_interno' is intentionally not updatable to prevent breaking logic
        WHERE id = v_modulo_id;
    END IF;

    RETURN v_modulo_id;
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================