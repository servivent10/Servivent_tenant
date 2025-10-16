-- =============================================================================
-- TENANT FEATURE: VIEW ADD-ON MODULES STATUS (V1)
-- =============================================================================
-- This script creates a new RPC function that allows a tenant (Propietario or
-- Administrador) to view the status of all available add-on modules for their
-- own company.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_my_company_modules_status()
RETURNS TABLE (
    id uuid,
    codigo_interno text,
    nombre_visible text,
    descripcion text,
    precio_mensual numeric,
    is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid := public.get_empresa_id_from_jwt();
BEGIN
    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo determinar la empresa del usuario.';
    END IF;

    RETURN QUERY
    SELECT
        m.id,
        m.codigo_interno,
        m.nombre_visible,
        m.descripcion,
        m.precio_mensual,
        COALESCE(em.estado = 'activo', false) as is_active
    FROM
        public.modulos m
    LEFT JOIN
        public.empresa_modulos em ON m.id = em.modulo_id AND em.empresa_id = v_empresa_id
    ORDER BY
        m.nombre_visible;
END;
$$;

-- =============================================================================
-- End of script.
-- =============================================================================