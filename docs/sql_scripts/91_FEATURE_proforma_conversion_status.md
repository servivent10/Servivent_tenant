-- =============================================================================
-- PROFORMA TO SALE CONVERSION STATUS - V1
-- =============================================================================
-- This script implements the backend logic to finalize the proforma-to-sale
-- conversion process by updating the proforma's status.
--
-- WHAT IT DOES:
-- 1. Adds a `venta_id` column to the `proformas` table to create a link
--    between the original proforma and the resulting sale for traceability.
-- 2. Creates the `convertir_proforma_a_venta` RPC function, which updates the
--    proforma's status to 'Convertida' and sets the `venta_id`.
-- 3. Updates the `registrar_venta` function to return the ID of the newly
--    created sale, which is necessary for the linking process.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Add `venta_id` column to the `proformas` table
-- -----------------------------------------------------------------------------
ALTER TABLE public.proformas
ADD COLUMN IF NOT EXISTS venta_id uuid REFERENCES public.ventas(id) ON DELETE SET NULL;


-- -----------------------------------------------------------------------------
-- Step 2: Create the `convertir_proforma_a_venta` RPC function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION convertir_proforma_a_venta(
    p_proforma_id uuid,
    p_venta_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
BEGIN
    UPDATE public.proformas
    SET 
        estado = 'Convertida',
        venta_id = p_venta_id
    WHERE id = p_proforma_id AND empresa_id = caller_empresa_id;
    
    -- Generate a notification for the conversion
    PERFORM notificar_cambio(
        'PROFORMA_CONVERTIDA', 
        'La proforma <b>' || (SELECT folio FROM proformas WHERE id = p_proforma_id) || '</b> fue convertida en la venta <b>' || (SELECT folio FROM ventas WHERE id = p_venta_id) || '</b>.',
        p_venta_id -- Link to the new sale
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 3: Ensure `registrar_venta` returns the new `venta_id`
-- -----------------------------------------------------------------------------
-- The existing `registrar_venta` function already returns a UUID. This step
-- confirms the function signature is correct and ready for use by the frontend.
-- This version is from script 75, which is the most current.
DROP FUNCTION IF EXISTS public.registrar_venta(venta_input, venta_item_input[], jsonb);
CREATE OR REPLACE FUNCTION registrar_venta(
    p_venta venta_input,
    p_items venta_item_input[],
    p_pagos jsonb
)
RETURNS uuid -- This confirms it returns the required ID.
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_venta_id uuid;
    v_folio text;
    v_cliente_nombre text;
    v_sucursal_nombre text;
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    caller_user_id uuid := auth.uid();
    item venta_item_input;
    saldo_final numeric;
    estado_final text;
    next_folio_number integer;
    stock_sucursal_anterior numeric;
    v_nuevo_stock numeric;
    v_stock_minimo numeric;
    v_sku text;
    v_producto_nombre text;
    low_stock_products low_stock_product_info[] := ARRAY[]::low_stock_product_info[];
    
    v_total_pagado numeric;
    v_abono_inicial numeric;
    v_metodo_pago_principal text;
    pago jsonb;
BEGIN
    SELECT COALESCE(SUM((p ->> 'monto')::numeric), 0) INTO v_total_pagado FROM jsonb_array_elements(p_pagos) p;

    IF jsonb_array_length(p_pagos) > 1 THEN v_metodo_pago_principal := 'Mixto';
    ELSIF jsonb_array_length(p_pagos) = 1 THEN v_metodo_pago_principal := (p_pagos -> 0 ->> 'metodo');
    ELSE v_metodo_pago_principal := 'Crédito'; END IF;

    IF p_venta.tipo_venta = 'Contado' THEN
        IF abs(v_total_pagado - p_venta.total) > 0.005 THEN RAISE EXCEPTION 'El monto pagado no coincide con el total de la venta al contado.'; END IF;
        saldo_final := 0; estado_final := 'Pagada'; v_abono_inicial := v_total_pagado;
    ELSE 
        v_abono_inicial := v_total_pagado;
        saldo_final := p_venta.total - v_abono_inicial;
        IF saldo_final <= 0.005 THEN estado_final := 'Pagada'; saldo_final := 0;
        ELSIF v_abono_inicial > 0 THEN estado_final := 'Abono Parcial';
        ELSE estado_final := 'Pendiente'; END IF;
    END IF;
    
    SELECT COALESCE(MAX(substring(folio from 7)::integer), 0) + 1 INTO next_folio_number FROM public.ventas WHERE empresa_id = caller_empresa_id;
    v_folio := 'VENTA-' || lpad(next_folio_number::text, 5, '0');

    INSERT INTO public.ventas (empresa_id, sucursal_id, cliente_id, usuario_id, folio, total, subtotal, descuento, impuestos, metodo_pago, tipo_venta, estado_pago, saldo_pendiente, fecha_vencimiento)
    VALUES (caller_empresa_id, p_venta.sucursal_id, p_venta.cliente_id, caller_user_id, v_folio, p_venta.total, p_venta.subtotal, p_venta.descuento, p_venta.impuestos, v_metodo_pago_principal, p_venta.tipo_venta, estado_final, saldo_final, p_venta.fecha_vencimiento)
    RETURNING id INTO new_venta_id;

    FOR pago IN SELECT * FROM jsonb_array_elements(p_pagos) LOOP
        INSERT INTO public.pagos_ventas (venta_id, monto, metodo_pago) VALUES (new_venta_id, (pago ->> 'monto')::numeric, pago ->> 'metodo');
    END LOOP;

    FOREACH item IN ARRAY p_items LOOP
        INSERT INTO public.venta_items (venta_id, producto_id, cantidad, precio_unitario_aplicado, costo_unitario_en_venta) VALUES (new_venta_id, item.producto_id, item.cantidad, item.precio_unitario_aplicado, item.costo_unitario_en_venta);
        SELECT i.cantidad, i.stock_minimo, p.sku, p.nombre INTO stock_sucursal_anterior, v_stock_minimo, v_sku, v_producto_nombre FROM public.inventarios i JOIN public.productos p ON i.producto_id = p.id WHERE i.producto_id = item.producto_id AND i.sucursal_id = p_venta.sucursal_id;
        stock_sucursal_anterior := COALESCE(stock_sucursal_anterior, 0);
        v_stock_minimo := COALESCE(v_stock_minimo, 0);
        v_nuevo_stock := stock_sucursal_anterior - item.cantidad;
        UPDATE public.inventarios SET cantidad = v_nuevo_stock, updated_at = now() WHERE producto_id = item.producto_id AND sucursal_id = p_venta.sucursal_id;
        INSERT INTO public.movimientos_inventario (producto_id, sucursal_id, usuario_id, tipo_movimiento, cantidad_ajustada, stock_anterior, stock_nuevo, referencia_id) VALUES (item.producto_id, p_venta.sucursal_id, caller_user_id, 'Venta', -item.cantidad, stock_sucursal_anterior, v_nuevo_stock, new_venta_id);
        IF v_nuevo_stock <= v_stock_minimo AND v_stock_minimo > 0 THEN low_stock_products := array_append(low_stock_products, ROW(item.producto_id, v_producto_nombre, COALESCE(v_sku, 'N/A'), v_nuevo_stock)::low_stock_product_info); END IF;
    END LOOP;

    IF p_venta.tipo_venta = 'Crédito' AND p_venta.cliente_id IS NOT NULL THEN UPDATE public.clientes SET saldo_pendiente = saldo_pendiente + saldo_final WHERE id = p_venta.cliente_id; END IF;

    SELECT nombre INTO v_cliente_nombre FROM clientes WHERE id = p_venta.cliente_id;
    SELECT nombre INTO v_sucursal_nombre FROM sucursales WHERE id = p_venta.sucursal_id;
    PERFORM notificar_cambio('NUEVA_VENTA', 'Venta <b>' || v_folio || '</b> a ' || COALESCE(v_cliente_nombre, 'Consumidor Final') || ' por <b>Bs ' || to_char(p_venta.total, 'FM999G999D00') || '</b> en <b>' || v_sucursal_nombre || '</b>.', new_venta_id, ARRAY[p_venta.sucursal_id]);
    IF array_length(low_stock_products, 1) = 1 THEN PERFORM notificar_cambio('PRODUCTO_STOCK_BAJO', 'El producto <b>' || low_stock_products[1].producto_nombre || ' (SKU: ' || low_stock_products[1].sku || ')</b> tiene stock bajo (' || low_stock_products[1].nuevo_stock || ' unidades) en <b>' || v_sucursal_nombre || '</b>.', low_stock_products[1].producto_id, ARRAY[p_venta.sucursal_id]);
    ELSIF array_length(low_stock_products, 1) > 1 THEN PERFORM notificar_cambio('MULTIPLE_PRODUCTOS_STOCK_BAJO', 'Varios productos con stock bajo en <b>' || v_sucursal_nombre || '</b> tras la venta <b>' || v_folio || '</b>.', new_venta_id, ARRAY[p_venta.sucursal_id]); END IF;
    
    RETURN new_venta_id;
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================