-- =============================================================================
-- HOTFIX: WEB CATALOG ORDER CREATION SIGNATURE (V1)
-- =============================================================================
-- This script fixes a critical "Could not find the function" error that occurs
-- when a customer finalizes a web order.
--
-- PROBLEM:
-- The Supabase client library can reorder named parameters alphabetically. The
-- frontend was calling `registrar_pedido_web` with a parameter `p_sucursal_id`,
-- but the database function was defined with `p_sucursal_id_retiro`. This
-- mismatch caused the RPC call to fail because the function signature did not
-- match.
--
-- SOLUTION:
-- This script updates the `registrar_pedido_web` function to use the more generic
-- and expected parameter name `p_sucursal_id`. It also refactors the internal
-- logic to correctly handle this single, unified branch ID for both home
-- delivery (dispatch branch) and store pickup scenarios, making the function
-- more robust and fixing the bug.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- Step 1: Drop the old function with the incorrect signature
DROP FUNCTION IF EXISTS public.registrar_pedido_web(text, web_order_item_input[], uuid, uuid);

-- Step 2: Create the function with the corrected signature and logic
CREATE OR REPLACE FUNCTION registrar_pedido_web(
    p_slug text,
    p_items web_order_item_input[],
    p_direccion_id uuid,
    p_sucursal_id uuid -- NOW a single, unified parameter
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_cliente_id uuid;
    v_cliente_nombre text;
    v_total numeric := 0;
    v_subtotal numeric := 0;
    item web_order_item_input;
    new_venta_id uuid;
    next_folio_number integer;
    v_folio text;
    v_notif_mensaje text;
    v_delivery_info text;
BEGIN
    -- 1. Get company and authenticated client
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = p_slug;
    IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Catálogo no encontrado.'; END IF;

    SELECT id, nombre INTO v_cliente_id, v_cliente_nombre FROM public.clientes WHERE auth_user_id = auth.uid() AND empresa_id = v_empresa_id;
    IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Cliente no autenticado o no encontrado para esta empresa.'; END IF;
    
    -- CRITICAL FIX: p_sucursal_id is now always required.
    IF p_sucursal_id IS NULL THEN
        RAISE EXCEPTION 'Se debe especificar una sucursal para el pedido (sea para despacho o retiro).';
    END IF;

    -- 2. Determine delivery info for the notification message
    IF p_direccion_id IS NOT NULL THEN
        v_delivery_info := 'para envío a domicilio desde <b>' || (SELECT nombre FROM sucursales WHERE id = p_sucursal_id) || '</b>.';
    ELSE
        v_delivery_info := 'para recojo en <b>' || (SELECT nombre FROM sucursales WHERE id = p_sucursal_id) || '</b>.';
    END IF;

    -- 3. Calculate totals
    FOREACH item IN ARRAY p_items LOOP
        v_subtotal := v_subtotal + (item.cantidad * item.precio_unitario);
    END LOOP;
    v_total := v_subtotal;

    -- 4. Get next folio number
    SELECT COALESCE(MAX(substring(folio from 7)::integer), 0) + 1 
    INTO next_folio_number 
    FROM public.ventas WHERE empresa_id = v_empresa_id;
    v_folio := 'VENTA-' || lpad(next_folio_number::text, 5, '0');

    -- 5. Create the 'venta' record. p_sucursal_id is now always used.
    INSERT INTO public.ventas (empresa_id, sucursal_id, cliente_id, usuario_id, folio, fecha, total, subtotal, metodo_pago, tipo_venta, estado_pago, saldo_pendiente, direccion_entrega_id)
    VALUES (v_empresa_id, p_sucursal_id, v_cliente_id, NULL, v_folio, now(), v_total, v_subtotal, 'Pedido Web', 'Contado', 'Pedido Web Pendiente', v_total, p_direccion_id)
    RETURNING id INTO new_venta_id;

    -- 6. Insert sale items
    FOREACH item IN ARRAY p_items LOOP
        INSERT INTO public.venta_items (venta_id, producto_id, cantidad, precio_unitario_aplicado, costo_unitario_en_venta)
        VALUES (new_venta_id, item.producto_id, item.cantidad, item.precio_unitario, COALESCE((SELECT precio_compra FROM public.productos WHERE id = item.producto_id), 0));
    END LOOP;
    
    -- 7. Generate context-aware notification DIRECTLY
    v_notif_mensaje := format(
        'Nuevo pedido <b>%s</b> de <b>%s</b>, %s',
        v_folio,
        v_cliente_nombre,
        v_delivery_info
    );

    INSERT INTO public.notificaciones (empresa_id, usuario_generador_nombre, mensaje, tipo_evento, entidad_id, sucursales_destino_ids)
    VALUES (v_empresa_id, 'Catálogo Web', v_notif_mensaje, 'NUEVA_VENTA', new_venta_id, ARRAY[p_sucursal_id]);
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================