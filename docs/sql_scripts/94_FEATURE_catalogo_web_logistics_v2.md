-- =============================================================================
-- WEB CATALOG LOGISTICS & ORDER CONFIRMATION - V2
-- =============================================================================
-- This script implements the complete backend infrastructure for the new,
-- robust web catalog logistics flow.
-- VERSION 2 adds the `verificar_stock_para_venta` function.
--
-- WHAT IT DOES:
-- 1. Updates `get_public_catalog_data` to include stock per branch for each
--    product (`all_branch_stock`) and branch coordinates.
-- 2. Updates `registrar_pedido_web` to require a `p_sucursal_id` for both
--    home delivery (dispatch branch) and store pickup.
-- 3. Creates `verificar_stock_para_venta`, a new RPC for the internal UI to
--    check real-time stock before confirming a web order.
-- 4. Creates `confirmar_pedido_web`, the main RPC for the internal UI to
--    finalize a web order, deduct stock, and update its status.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Update `get_public_catalog_data`
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_public_catalog_data(text);
CREATE OR REPLACE FUNCTION get_public_catalog_data(p_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_empresa_id uuid; sucursales_list json; company_data json; products_list json; categories_list json; brands_list json;
BEGIN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = p_slug;
    IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Catálogo no encontrado.'; END IF;
    
    -- Add lat/lng to the sucursales query
    SELECT json_agg(s_info) INTO sucursales_list FROM (
        SELECT id, nombre, direccion, telefono, latitud, longitud FROM public.sucursales
        WHERE empresa_id = v_empresa_id AND tipo = 'Sucursal' ORDER BY nombre
    ) AS s_info;
    
    -- The rest of the function fetches other data...
    SELECT to_jsonb(e) into company_data FROM empresas e WHERE id = v_empresa_id;

    SELECT json_agg(p_info) INTO products_list FROM (
        SELECT
            p.id, p.nombre, p.sku, p.marca, p.modelo, p.descripcion, p.categoria_id, p.created_at,
            (
                SELECT json_agg(json_build_object('id', s.id, 'nombre', s.nombre, 'cantidad', COALESCE(i.cantidad, 0)))
                FROM public.sucursales s
                LEFT JOIN public.inventarios i ON s.id = i.sucursal_id AND i.producto_id = p.id
                WHERE s.empresa_id = v_empresa_id AND s.tipo != 'Depósito'
            ) as all_branch_stock,
            -- Other fields like price, images, etc.
            COALESCE((SELECT pp.precio FROM public.precios_productos pp JOIN public.listas_precios lp ON pp.lista_precio_id = lp.id WHERE pp.producto_id = p.id AND lp.es_predeterminada = true), 0) as precio_base,
            COALESCE((SELECT pp.precio FROM public.precios_productos pp JOIN public.listas_precios lp ON pp.lista_precio_id = lp.id WHERE pp.producto_id = p.id AND lp.nombre = 'Ofertas Web' AND pp.ganancia_maxima > 0), 0) as precio_oferta,
            (SELECT img.imagen_url FROM public.imagenes_productos img WHERE img.producto_id = p.id ORDER BY img.orden LIMIT 1) as imagen_principal
        FROM public.productos p
        WHERE p.empresa_id = v_empresa_id
    ) AS p_info;

    SELECT json_agg(c) into categories_list FROM categorias c WHERE empresa_id = v_empresa_id;
    SELECT json_agg(b) into brands_list FROM (SELECT DISTINCT marca as nombre FROM productos WHERE empresa_id = v_empresa_id AND marca IS NOT NULL) b;

    RETURN json_build_object('company', company_data, 'products', products_list, 'categories', categories_list, 'brands', brands_list, 'sucursales', sucursales_list);
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 2: Update `registrar_pedido_web`
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.registrar_pedido_web(text, web_order_item_input[], uuid, uuid);
CREATE OR REPLACE FUNCTION registrar_pedido_web(
    p_slug text,
    p_items web_order_item_input[],
    p_direccion_id uuid,
    p_sucursal_id uuid -- NOW REQUIRED for both delivery and pickup
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid; v_cliente_id uuid; v_cliente_nombre text; v_total numeric := 0; v_subtotal numeric := 0; item web_order_item_input; new_venta_id uuid; next_folio_number integer; v_folio text; v_notif_mensaje text; v_delivery_info text;
BEGIN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = p_slug;
    IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Catálogo no encontrado.'; END IF;
    SELECT id, nombre INTO v_cliente_id, v_cliente_nombre FROM public.clientes WHERE auth_user_id = auth.uid() AND empresa_id = v_empresa_id;
    IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Cliente no autenticado.'; END IF;

    IF p_direccion_id IS NOT NULL THEN
        v_delivery_info := 'para envío a domicilio.';
    ELSE
        v_delivery_info := 'para recojo en <b>' || (SELECT nombre FROM sucursales WHERE id = p_sucursal_id) || '</b>.';
    END IF;

    FOREACH item IN ARRAY p_items LOOP v_subtotal := v_subtotal + (item.cantidad * item.precio_unitario); END LOOP;
    v_total := v_subtotal;
    SELECT COALESCE(MAX(substring(folio from 7)::integer), 0) + 1 INTO next_folio_number FROM public.ventas WHERE empresa_id = v_empresa_id;
    v_folio := 'VENTA-' || lpad(next_folio_number::text, 5, '0');

    INSERT INTO public.ventas (empresa_id, sucursal_id, cliente_id, usuario_id, folio, fecha, total, subtotal, metodo_pago, tipo_venta, estado_pago, saldo_pendiente, direccion_entrega_id)
    VALUES (v_empresa_id, p_sucursal_id, v_cliente_id, NULL, v_folio, now(), v_total, v_subtotal, 'Pedido Web', 'Contado', 'Pedido Web Pendiente', v_total, p_direccion_id)
    RETURNING id INTO new_venta_id;

    FOREACH item IN ARRAY p_items LOOP
        INSERT INTO public.venta_items (venta_id, producto_id, cantidad, precio_unitario_aplicado, costo_unitario_en_venta)
        VALUES (new_venta_id, item.producto_id, item.cantidad, item.precio_unitario, COALESCE((SELECT precio_compra FROM public.productos WHERE id = item.producto_id), 0));
    END LOOP;
    
    v_notif_mensaje := format('Nuevo pedido <b>%s</b> de <b>%s</b>, %s', v_folio, v_cliente_nombre, v_delivery_info);

    INSERT INTO public.notificaciones (empresa_id, usuario_generador_nombre, mensaje, tipo_evento, entidad_id, sucursales_destino_ids)
    VALUES (v_empresa_id, 'Catálogo Web', v_notif_mensaje, 'NUEVA_VENTA', new_venta_id, ARRAY[p_sucursal_id]);
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 3: Create `verificar_stock_para_venta`
-- -----------------------------------------------------------------------------
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


-- -----------------------------------------------------------------------------
-- Step 4: Create `confirmar_pedido_web`
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

    -- 4. Update sale status
    UPDATE public.ventas SET estado_pago = 'Pagada' WHERE id = p_venta_id;
END;
$$;

-- =============================================================================
-- End of script.
-- =============================================================================--- START OF FILE docs/sql_scripts/94_REVERT_catalogo_web_logistics_v2.md ---

-- =============================================================================
-- REVERT SCRIPT FOR: WEB CATALOG LOGISTICS & ORDER CONFIRMATION (V2)
-- =============================================================================
-- This script reverts all changes made by `94_FEATURE_catalogo_web_logistics_v2.md`.
-- =============================================================================

-- Step 1: Drop new RPC functions
DROP FUNCTION IF EXISTS public.confirmar_pedido_web(uuid);
DROP FUNCTION IF EXISTS public.verificar_stock_para_venta(uuid);

-- Step 2: Revert `get_public_catalog_data`
DROP FUNCTION IF EXISTS public.get_public_catalog_data(text);
CREATE OR REPLACE FUNCTION get_public_catalog_data(p_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_empresa_id uuid; sucursales_list json; company_data json; products_list json; categories_list json; brands_list json;
BEGIN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = p_slug;
    IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Catálogo no encontrado.'; END IF;
    
    SELECT json_agg(s_info) INTO sucursales_list FROM (
        SELECT id, nombre, direccion, telefono FROM public.sucursales
        WHERE empresa_id = v_empresa_id AND tipo = 'Sucursal' ORDER BY nombre
    ) AS s_info;
    
    SELECT to_jsonb(e) into company_data FROM empresas e WHERE id = v_empresa_id;
    SELECT json_agg(p) into products_list FROM productos p WHERE empresa_id = v_empresa_id;
    SELECT json_agg(c) into categories_list FROM categorias c WHERE empresa_id = v_empresa_id;
    SELECT json_agg(b) into brands_list FROM (SELECT DISTINCT marca as nombre FROM productos WHERE empresa_id = v_empresa_id AND marca IS NOT NULL) b;

    RETURN json_build_object('company', company_data, 'products', products_list, 'categories', categories_list, 'brands', brands_list, 'sucursales', sucursales_list);
END;
$$;


-- Step 3: Revert `registrar_pedido_web`
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
AS $$
DECLARE
    v_empresa_id uuid; v_cliente_id uuid; v_cliente_nombre text; v_sucursal_id_for_sale uuid; v_sucursal_ids_for_notif uuid[]; v_total numeric := 0; v_subtotal numeric := 0; item web_order_item_input; new_venta_id uuid; next_folio_number integer; v_folio text; v_notif_mensaje text; v_delivery_info text;
BEGIN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = p_slug;
    IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Catálogo no encontrado.'; END IF;
    SELECT id, nombre INTO v_cliente_id, v_cliente_nombre FROM public.clientes WHERE auth_user_id = auth.uid() AND empresa_id = v_empresa_id;
    IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Cliente no autenticado.'; END IF;
    
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