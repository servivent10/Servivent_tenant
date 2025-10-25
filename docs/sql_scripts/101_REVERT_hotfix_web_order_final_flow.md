-- =============================================================================
-- REVERT SCRIPT FOR: WEB ORDER FINAL CONFIRMATION FLOW HOTFIX (V1)
-- =============================================================================
-- This script reverts the changes made by `101_HOTFIX_web_order_final_flow.md`.
-- It restores the previous versions of `registrar_pago_venta` and
-- `confirmar_pedido_web`.
--
-- WARNING:
-- Running this script will re-introduce the bug that prevents the confirmation
-- of fully paid web orders.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Revert `registrar_pago_venta`
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_pago_venta(p_venta_id uuid, p_monto numeric, p_metodo_pago text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_venta public.ventas;
    v_nuevo_saldo numeric;
BEGIN
    SELECT * INTO v_venta FROM public.ventas WHERE id = p_venta_id FOR UPDATE;

    IF v_venta IS NULL THEN RAISE EXCEPTION 'Venta no encontrada.'; END IF;
    IF p_monto <= 0 THEN RAISE EXCEPTION 'El monto del pago debe ser positivo.'; END IF;
    IF p_monto > v_venta.saldo_pendiente THEN RAISE EXCEPTION 'El monto del pago no puede ser mayor al saldo pendiente.'; END IF;

    INSERT INTO public.pagos_ventas (venta_id, monto, metodo_pago)
    VALUES (p_venta_id, p_monto, p_metodo_pago);

    v_nuevo_saldo := v_venta.saldo_pendiente - p_monto;
    UPDATE public.ventas
    SET
        saldo_pendiente = v_nuevo_saldo,
        estado_pago = CASE
            WHEN v_nuevo_saldo <= 0.005 THEN 'Pagada'
            ELSE 'Abono Parcial'
        END
    WHERE id = p_venta_id;

    IF v_venta.cliente_id IS NOT NULL THEN
        UPDATE public.clientes
        SET saldo_pendiente = saldo_pendiente - p_monto
        WHERE id = v_venta.cliente_id;
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 2: Revert `confirmar_pedido_web`
-- -----------------------------------------------------------------------------
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

    -- 4. Update sale status (without assigning the user)
    UPDATE public.ventas SET estado_pago = 'Pagada' WHERE id = p_venta_id;
END;
$$;


-- =============================================================================
-- End of revert script.
-- =============================================================================