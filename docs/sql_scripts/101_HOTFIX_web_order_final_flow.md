-- =============================================================================
-- HOTFIX: WEB ORDER FINAL CONFIRMATION FLOW (V1)
-- =============================================================================
-- This script provides a definitive fix for the web order processing flow,
-- ensuring that an order's status remains "Pedido Web Pendiente" until it is
-- manually confirmed by staff, even if it has been fully paid.
--
-- PROBLEM:
-- The `registrar_pago_venta` function automatically changed a web order's status
-- to 'Pagada' once the balance was zero. This prevented the `confirmar_pedido_web`
-- function from running, as it specifically checks for a 'Pedido Web Pendiente'
-- status, thus blocking the final stock deduction.
--
-- SOLUTION:
-- 1. `registrar_pago_venta` is updated with a conditional check. If the sale
--    being paid is a 'Pedido Web Pendiente', its status will NOT be changed
--    to 'Pagada', ensuring it remains pending for confirmation.
-- 2. `confirmar_pedido_web` is updated to not only change the status to 'Pagada'
--    but also to assign the `usuario_id` of the staff member who confirms the
--    order, improving auditability.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Update `registrar_pago_venta` with conditional status change
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
    -- Get sale details and lock the row for the transaction
    SELECT * INTO v_venta FROM public.ventas WHERE id = p_venta_id FOR UPDATE;

    IF v_venta IS NULL THEN RAISE EXCEPTION 'Venta no encontrada.'; END IF;
    IF p_monto <= 0 THEN RAISE EXCEPTION 'El monto del pago debe ser positivo.'; END IF;
    IF p_monto > v_venta.saldo_pendiente THEN RAISE EXCEPTION 'El monto del pago no puede ser mayor al saldo pendiente.'; END IF;

    INSERT INTO public.pagos_ventas (venta_id, monto, metodo_pago) VALUES (p_venta_id, p_monto, p_metodo_pago);

    v_nuevo_saldo := v_venta.saldo_pendiente - p_monto;
    
    UPDATE public.ventas
    SET
        saldo_pendiente = v_nuevo_saldo,
        estado_pago = CASE
            -- **THE FIX**: If it's a web order, NEVER change it to 'Pagada' here. It remains pending.
            WHEN v_venta.estado_pago = 'Pedido Web Pendiente' THEN 'Pedido Web Pendiente'
            -- For all other sales, use the existing logic for credit/partial payments.
            WHEN v_nuevo_saldo <= 0.005 THEN 'Pagada'
            ELSE 'Abono Parcial'
        END
    WHERE id = p_venta_id;

    -- Update the client's total pending balance
    IF v_venta.cliente_id IS NOT NULL THEN
        UPDATE public.clientes SET saldo_pendiente = saldo_pendiente - p_monto WHERE id = v_venta.cliente_id;
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 2: Update `confirmar_pedido_web` to finalize status and assign user
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
    caller_user_id uuid := auth.uid(); -- Get the user confirming the order
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
        VALUES (item.producto_id, v_venta.sucursal_id, caller_user_id, 'Venta', -item.cantidad, stock_actual, stock_actual - item.cantidad, p_venta_id);
    END LOOP;

    -- 4. Final update: change status AND assign the confirming user
    UPDATE public.ventas 
    SET 
        estado_pago = 'Pagada',
        usuario_id = caller_user_id -- Assign the user who processed the order
    WHERE id = p_venta_id;
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================