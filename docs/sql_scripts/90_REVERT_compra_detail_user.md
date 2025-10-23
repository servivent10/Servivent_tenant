-- =============================================================================
-- REVERT SCRIPT FOR: PURCHASE DETAILS ENHANCEMENT - ADD USER NAME (V1)
-- =============================================================================
-- This script reverts the changes made by `90_FEATURE_compra_detail_user.md`.
-- It restores the previous version of the `get_purchase_details` function.
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
    SELECT to_jsonb(c) || jsonb_build_object('proveedor_nombre', p.nombre)
    INTO purchase_details
    FROM public.compras c
    JOIN public.proveedores p ON c.proveedor_id = p.id
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
-- End of revert script.
-- =============================================================================
