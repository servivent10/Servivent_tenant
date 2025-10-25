-- =============================================================================
-- REVERT SCRIPT FOR: WEB CATALOG ORDER CREATION SIGNATURE HOTFIX (V1)
-- =============================================================================
-- This script reverts the changes made by `96_HOTFIX_web_order_signature.md`.
-- It restores the previous (buggy) version of the `registrar_pedido_web` function.
-- =============================================================================

DROP FUNCTION IF EXISTS public.registrar_pedido_web(text, web_order_item_input[], uuid, uuid);

CREATE OR REPLACE FUNCTION registrar_pedido_web(
    p_slug text,
    p_items web_order_item_input[],
    p_direccion_id uuid DEFAULT NULL,
    p_sucursal_id_retiro uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid; v_cliente_id uuid; v_cliente_nombre text; v_total numeric := 0; v_subtotal numeric := 0; item web_order_item_input; new_venta_id uuid; next_folio_number integer; v_folio text; v_notif_mensaje text; v_delivery_info text; v_sucursal_id_for_sale uuid; v_sucursal_ids_for_notif uuid[];
BEGIN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = p_slug;
    IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Catálogo no encontrado.'; END IF;

    SELECT id, nombre INTO v_cliente_id, v_cliente_nombre FROM public.clientes WHERE auth_user_id = auth.uid() AND empresa_id = v_empresa_id;
    IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Cliente no autenticado o no encontrado para esta empresa.'; END IF;
    
    IF p_direccion_id IS NOT NULL THEN
        v_sucursal_id_for_sale := NULL;
        v_sucursal_ids_for_notif := NULL;
        v_delivery_info := 'para envío a domicilio.';
    ELSIF p_sucursal_id_retiro IS NOT NULL THEN
        v_sucursal_id_for_sale := p_sucursal_id_retiro;
        v_sucursal_ids_for_notif := ARRAY[p_sucursal_id_retiro];
        v_delivery_info := 'para recojo en <b>' || (SELECT nombre FROM sucursales WHERE id = p_sucursal_id_retiro) || '</b>.';
    ELSE
        RAISE EXCEPTION 'El pedido debe ser para envío a domicilio o para retiro en sucursal.';
    END IF;

    FOREACH item IN ARRAY p_items LOOP v_subtotal := v_subtotal + (item.cantidad * item.precio_unitario); END LOOP;
    v_total := v_subtotal;
    SELECT COALESCE(MAX(substring(folio from 7)::integer), 0) + 1 INTO next_folio_number FROM public.ventas WHERE empresa_id = v_empresa_id;
    v_folio := 'VENTA-' || lpad(next_folio_number::text, 5, '0');
    
    INSERT INTO public.ventas (empresa_id, sucursal_id, cliente_id, usuario_id, folio, fecha, total, subtotal, metodo_pago, tipo_venta, estado_pago, saldo_pendiente, direccion_entrega_id)
    VALUES (v_empresa_id, v_sucursal_id_for_sale, v_cliente_id, NULL, v_folio, now(), v_total, v_subtotal, 'Pedido Web', 'Contado', 'Pedido Web Pendiente', v_total, p_direccion_id)
    RETURNING id INTO new_venta_id;

    FOREACH item IN ARRAY p_items LOOP
        INSERT INTO public.venta_items (venta_id, producto_id, cantidad, precio_unitario_aplicado, costo_unitario_en_venta)
        VALUES (new_venta_id, item.producto_id, item.cantidad, item.precio_unitario, COALESCE((SELECT precio_compra FROM public.productos WHERE id = item.producto_id), 0));
    END LOOP;
    
    v_notif_mensaje := format('Nuevo pedido <b>%s</b> de <b>%s</b>, %s', v_folio, v_cliente_nombre, v_delivery_info);

    INSERT INTO public.notificaciones (empresa_id, usuario_generador_nombre, mensaje, tipo_evento, entidad_id, sucursales_destino_ids)
    VALUES (v_empresa_id, 'Catálogo Web', v_notif_mensaje, 'NUEVA_VENTA', new_venta_id, v_sucursal_ids_for_notif);
END;
$$;


-- =============================================================================
-- End of revert script.
-- =============================================================================