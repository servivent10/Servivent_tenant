-- =============================================================================
-- HOTFIX: ENSURE `confirmar_pedido_web` FUNCTION EXISTS (V1)
-- =============================================================================
-- This script provides a critical hotfix for the sale detail page, which was
-- failing with a "Could not find the function" error when trying to confirm and
-- process a web order.
--
-- PROBLEM:
-- The RPC function `confirmar_pedido_web`, which is essential for finalizing
-- web orders and deducting stock, appears to be missing or have an incorrect
-- signature in some database environments.
--
-- SOLUTION:
-- This script explicitly recreates the `confirmar_pedido_web` function
-- with the correct signature and logic. Using `CREATE OR REPLACE` ensures that
-- this operation is idempotent: it will create the function if it's missing or
-- replace any incorrect version with the correct one.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor. This will
-- immediately resolve the error when confirming web orders.
-- =============================================================================

CREATE OR REPLACE FUNCTION confirmar_pedido_web(p_venta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_venta record;
    item record;
    stock_actual numeric;
BEGIN
    -- 1. Get sale and validate status
    SELECT * INTO v_venta FROM public.ventas WHERE id = p_venta_id AND empresa_id = public.get_empresa_id_from_jwt();
    IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada.'; END IF;
    IF v_venta.estado_pago != 'Pedido Web Pendiente' THEN RAISE EXCEPTION 'Esta venta no es un pedido web pendiente.'; END IF;
    IF v_venta.sucursal_id IS NULL THEN RAISE EXCEPTION 'Esta venta no tiene una sucursal de despacho asignada.'; END IF;

    -- 2. Loop through items to perform final stock check
    FOR item IN SELECT * FROM public.venta_items WHERE venta_id = p_venta_id LOOP
        SELECT cantidad INTO stock_actual FROM public.inventarios WHERE producto_id = item.producto_id AND sucursal_id = v_venta.sucursal_id;
        IF COALESCE(stock_actual, 0) < item.cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente para el producto: %.', (SELECT nombre FROM productos WHERE id = item.producto_id);
        END IF;
    END LOOP;

    -- 3. If all checks pass, loop again to update inventory
    FOR item IN SELECT * FROM public.venta_items WHERE venta_id = p_venta_id LOOP
        SELECT cantidad INTO stock_actual FROM public.inventarios WHERE producto_id = item.producto_id AND sucursal_id = v_venta.sucursal_id;
        
        UPDATE public.inventarios
        SET cantidad = cantidad - item.cantidad, updated_at = now()
        WHERE producto_id = item.producto_id AND sucursal_id = v_venta.sucursal_id;
        
        INSERT INTO public.movimientos_inventario (producto_id, sucursal_id, usuario_id, tipo_movimiento, cantidad_ajustada, stock_anterior, stock_nuevo, referencia_id)
        VALUES (item.producto_id, v_venta.sucursal_id, auth.uid(), 'Venta', -item.cantidad, stock_actual, stock_actual - item.cantidad, p_venta_id);
    END LOOP;

    -- 4. Update sale status
    UPDATE public.ventas SET estado_pago = 'Pagada' WHERE id = p_venta_id;
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================