-- =============================================================================
-- HOTFIX: ENSURE `verificar_stock_para_venta` FUNCTION EXISTS (V1)
-- =============================================================================
-- This script provides a critical hotfix for the sale detail page, which was
-- failing with a "Could not find the function" error when trying to view a
-- web order.
--
-- PROBLEM:
-- The RPC function `verificar_stock_para_venta`, which is essential for checking
-- stock levels for pending web orders, appears to be missing or have an
-- incorrect signature in some database environments, preventing the sale detail
-- page from loading correctly.
--
-- SOLUTION:
-- This script explicitly recreates the `verificar_stock_para_venta` function
-- with the correct signature and logic. Using `CREATE OR REPLACE` ensures that
-- this operation is idempotent: it will create the function if it's missing or
-- replace any incorrect version with the correct one.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor. This will
-- immediately resolve the error on the sale detail page for web orders.
-- =============================================================================

CREATE OR REPLACE FUNCTION verificar_stock_para_venta(p_venta_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sucursal_id uuid;
BEGIN
    SELECT sucursal_id INTO v_sucursal_id FROM public.ventas WHERE id = p_venta_id;
    IF v_sucursal_id IS NULL THEN
        RAISE EXCEPTION 'Esta venta no tiene una sucursal de despacho asignada.';
    END IF;

    RETURN (SELECT json_agg(s_info) FROM (
        SELECT
            p.nombre as producto_nombre,
            vi.cantidad as cantidad_requerida,
            COALESCE(i.cantidad, 0) as cantidad_disponible
        FROM public.venta_items vi
        JOIN public.productos p ON vi.producto_id = p.id
        LEFT JOIN public.inventarios i ON vi.producto_id = i.producto_id AND i.sucursal_id = v_sucursal_id
        WHERE vi.venta_id = p_venta_id
    ) AS s_info);
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================