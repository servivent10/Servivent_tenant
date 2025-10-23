-- =============================================================================
-- PURCHASE DETAILS ENHANCEMENT: ADD USER NAME (V1)
-- =============================================================================
-- This script enhances the purchase detail view by including the name of the
-- user who created the purchase.
--
-- WHAT IT DOES:
-- 1. Updates `get_purchase_details` to perform a LEFT JOIN with the `usuarios`
--    table and include `usuario_nombre` in the returned JSON object.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_purchase_details(uuid);
CREATE OR REPLACE FUNCTION get_purchase_details(p_compra_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    purchase_details jsonb;
    items_list json;
    payments_list json;
BEGIN
    SELECT to_jsonb(c) || jsonb_build_object(
        'proveedor_nombre', p.nombre,
        'usuario_nombre', u.nombre_completo -- ADDED: User's full name
    )
    INTO purchase_details
    FROM public.compras c
    JOIN public.proveedores p ON c.proveedor_id = p.id
    LEFT JOIN public.usuarios u ON c.usuario_id = u.id -- ADDED: Join to get user name
    WHERE c.id = p_compra_id AND c.empresa_id = public.get_empresa_id_from_jwt();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Compra no encontrada o no pertenece a tu empresa.';
    END IF;

    SELECT json_agg(i) INTO items_list
    FROM (
        SELECT ci.*, p.nombre as producto_nombre
        FROM public.compra_items ci
        JOIN public.productos p ON ci.producto_id = p.id
        WHERE ci.compra_id = p_compra_id
    ) i;

    SELECT json_agg(p) INTO payments_list
    FROM (
        SELECT * FROM public.pagos_compras
        WHERE compra_id = p_compra_id
        ORDER BY fecha_pago
    ) p;

    RETURN purchase_details || jsonb_build_object(
        'items', COALESCE(items_list, '[]'::json),
        'pagos', COALESCE(payments_list, '[]'::json)
    );
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================
