-- =============================================================================
-- PROFORMA TEMPLATE DATA FIX (V1)
-- =============================================================================
-- This script fixes an issue where the proforma preview was missing some data.
--
-- WHAT IT DOES:
-- 1. Updates `get_proforma_details`: The function is updated to return
--    the client's NIT/CI and phone number, as well as the branch's address,
--    to be displayed on the proforma template.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_proforma_details(uuid);
CREATE OR REPLACE FUNCTION get_proforma_details(p_proforma_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    proforma_details jsonb;
    items_list jsonb;
BEGIN
    SELECT to_jsonb(pr) || jsonb_build_object(
        'cliente_nombre', c.nombre,
        'cliente_nit_ci', c.nit_ci,
        'cliente_telefono', c.telefono,
        'usuario_nombre', u.nombre_completo,
        'sucursal_nombre', s.nombre,
        'sucursal_direccion', s.direccion
    )
    INTO proforma_details
    FROM public.proformas pr
    LEFT JOIN public.clientes c ON pr.cliente_id = c.id
    JOIN public.usuarios u ON pr.usuario_id = u.id
    JOIN public.sucursales s ON pr.sucursal_id = s.id
    WHERE pr.id = p_proforma_id AND pr.empresa_id = public.get_empresa_id_from_jwt();

    IF NOT FOUND THEN RAISE EXCEPTION 'Proforma no encontrada.'; END IF;

    SELECT jsonb_agg(i) INTO items_list
    FROM (
        SELECT pi.*, p.nombre as producto_nombre
        FROM public.proforma_items pi
        JOIN public.productos p ON pi.producto_id = p.id
        WHERE pi.proforma_id = p_proforma_id
    ) i;

    RETURN proforma_details || jsonb_build_object('items', COALESCE(items_list, '[]'::jsonb));
END;
$$;
