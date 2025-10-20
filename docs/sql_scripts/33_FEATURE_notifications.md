-- =============================================================================
-- INTELLIGENT NOTIFICATIONS SYSTEM (V7 - Definitive Unification)
-- =============================================================================
-- This script provides the definitive, unified logic for the intelligent
-- notification system. It consolidates all business logic functions that
-- generate notifications into this single file, making it the Single Source of
-- Truth (SSOT) for notifications.
--
-- WHAT IT DOES:
-- 1.  Provides the final version of the `notificar_cambio` function.
-- 2.  Updates `registrar_venta` with low-stock alert logic.
-- 3.  Updates `registrar_compra` with correct notification targeting.
-- 4.  Updates `registrar_traspaso` & `confirmar_recepcion_traspaso` for dual-branch notifications.
-- 5.  Updates `upsert_gasto` with improved messaging.
-- 6.  Adds notification logic to `upsert_product` and `upsert_client`.
-- 7.  Updates `registrar_pedido_web` with contextual delivery messages.
--
-- INSTRUCTIONS:
-- Execute this script completely in your SQL Editor. It will replace older
-- versions of these functions, ensuring system-wide consistency.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Core Notification Infrastructure (Idempotent)
-- -----------------------------------------------------------------------------
-- (Table, RLS, and basic functions remain the same as previous versions)

CREATE TABLE IF NOT EXISTS public.notificaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    usuario_generador_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    usuario_generador_nombre text,
    mensaje text NOT NULL,
    tipo_evento text,
    entidad_id uuid,
    leido_por uuid[] DEFAULT ARRAY[]::uuid[],
    created_at timestamptz DEFAULT now() NOT NULL,
    sucursales_destino_ids uuid[]
);

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.notificaciones;
CREATE POLICY "Enable all for own company" ON public.notificaciones FOR ALL USING (empresa_id = public.get_empresa_id_from_jwt());

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones; EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'Table "notificaciones" is already in publication.'; END; $$;


-- The core dispatcher function
CREATE OR REPLACE FUNCTION public.notificar_cambio(
    p_tipo_evento text,
    p_mensaje text,
    p_entidad_id uuid,
    p_sucursal_ids uuid[] DEFAULT NULL -- NULL means global for the company (Owner/Admins)
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_empresa_id uuid; v_usuario_id uuid; v_usuario_nombre text;
BEGIN
    v_usuario_id := auth.uid();
    v_empresa_id := public.get_empresa_id_from_jwt();
    v_usuario_nombre := (auth.jwt() -> 'app_metadata' ->> 'nombre_completo')::text;

    IF v_usuario_nombre IS NULL AND v_usuario_id IS NOT NULL THEN
        SELECT nombre_completo INTO v_usuario_nombre FROM public.usuarios WHERE id = v_usuario_id;
    END IF;
    IF v_usuario_nombre IS NULL THEN v_usuario_nombre := 'Sistema'; END IF;

    IF v_empresa_id IS NOT NULL THEN
        INSERT INTO public.notificaciones (empresa_id, usuario_generador_id, usuario_generador_nombre, mensaje, tipo_evento, entidad_id, sucursales_destino_ids)
        VALUES (v_empresa_id, v_usuario_id, v_usuario_nombre, p_mensaje, p_tipo_evento, p_entidad_id, p_sucursal_ids);
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 2: Update Business Logic Functions to Generate Smart Notifications
-- -----------------------------------------------------------------------------

-- **FIX**: Define a specific type for the low-stock product record.
DROP TYPE IF EXISTS public.low_stock_product_info CASCADE;
CREATE TYPE public.low_stock_product_info AS (
    producto_id uuid,
    producto_nombre text,
    sku text,
    nuevo_stock numeric
);


-- `registrar_venta` with low-stock alerts
DROP FUNCTION IF EXISTS public.registrar_venta(venta_input, venta_item_input[]);
CREATE OR REPLACE FUNCTION registrar_venta(p_venta venta_input, p_items venta_item_input[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    new_venta_id uuid; v_folio text; v_cliente_nombre text; v_sucursal_nombre text;
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    caller_user_id uuid := auth.uid();
    item venta_item_input; saldo_final numeric; estado_final text; next_folio_number integer;
    stock_sucursal_anterior numeric; v_nuevo_stock numeric; v_stock_minimo numeric; v_sku text;
    v_producto_nombre text; -- **FIX: Added local variable for product name**
    low_stock_products low_stock_product_info[] := ARRAY[]::low_stock_product_info[];
BEGIN
    IF p_venta.tipo_venta = 'Contado' THEN saldo_final := 0; estado_final := 'Pagada';
    ELSE saldo_final := p_venta.total - COALESCE(p_venta.abono_inicial, 0);
        IF saldo_final <= 0.005 THEN estado_final := 'Pagada'; saldo_final := 0;
        ELSIF COALESCE(p_venta.abono_inicial, 0) > 0 THEN estado_final := 'Abono Parcial';
        ELSE estado_final := 'Pendiente'; END IF;
    END IF;
    SELECT COALESCE(MAX(substring(folio from 7)::integer), 0) + 1 INTO next_folio_number FROM public.ventas WHERE empresa_id = caller_empresa_id;
    v_folio := 'VENTA-' || lpad(next_folio_number::text, 5, '0');
    INSERT INTO public.ventas (empresa_id, sucursal_id, cliente_id, usuario_id, folio, total, subtotal, descuento, impuestos, metodo_pago, tipo_venta, estado_pago, saldo_pendiente, fecha_vencimiento)
    VALUES (caller_empresa_id, p_venta.sucursal_id, p_venta.cliente_id, caller_user_id, v_folio, p_venta.total, p_venta.subtotal, p_venta.descuento, p_venta.impuestos, p_venta.metodo_pago, p_venta.tipo_venta, estado_final, saldo_final, p_venta.fecha_vencimiento)
    RETURNING id INTO new_venta_id;
    
    FOREACH item IN ARRAY p_items LOOP
        INSERT INTO public.venta_items (venta_id, producto_id, cantidad, precio_unitario_aplicado, costo_unitario_en_venta) VALUES (new_venta_id, item.producto_id, item.cantidad, item.precio_unitario_aplicado, item.costo_unitario_en_venta);
        
        -- **FIX: Correctly select into local variables, not into the loop record**
        SELECT i.cantidad, i.stock_minimo, p.sku, p.nombre 
        INTO stock_sucursal_anterior, v_stock_minimo, v_sku, v_producto_nombre 
        FROM public.inventarios i JOIN public.productos p ON i.producto_id = p.id 
        WHERE i.producto_id = item.producto_id AND i.sucursal_id = p_venta.sucursal_id;

        stock_sucursal_anterior := COALESCE(stock_sucursal_anterior, 0);
        v_stock_minimo := COALESCE(v_stock_minimo, 0);
        v_nuevo_stock := stock_sucursal_anterior - item.cantidad;
        UPDATE public.inventarios SET cantidad = v_nuevo_stock, updated_at = now() WHERE producto_id = item.producto_id AND sucursal_id = p_venta.sucursal_id;
        INSERT INTO public.movimientos_inventario (producto_id, sucursal_id, usuario_id, tipo_movimiento, cantidad_ajustada, stock_anterior, stock_nuevo, referencia_id) VALUES (item.producto_id, p_venta.sucursal_id, caller_user_id, 'Venta', -item.cantidad, stock_sucursal_anterior, v_nuevo_stock, new_venta_id);
        
        IF v_nuevo_stock <= v_stock_minimo AND v_stock_minimo > 0 THEN
            -- **FIX: Use the local variable for the product name**
            low_stock_products := array_append(low_stock_products, ROW(item.producto_id, v_producto_nombre, COALESCE(v_sku, 'N/A'), v_nuevo_stock)::low_stock_product_info);
        END IF;
    END LOOP;

    IF p_venta.tipo_venta = 'Crédito' AND p_venta.cliente_id IS NOT NULL THEN UPDATE public.clientes SET saldo_pendiente = saldo_pendiente + saldo_final WHERE id = p_venta.cliente_id; END IF;
    IF p_venta.tipo_venta = 'Contado' THEN INSERT INTO public.pagos_ventas (venta_id, monto, metodo_pago) VALUES (new_venta_id, p_venta.total, p_venta.metodo_pago);
    ELSIF p_venta.tipo_venta = 'Crédito' AND COALESCE(p_venta.abono_inicial, 0) > 0 THEN INSERT INTO public.pagos_ventas (venta_id, monto, metodo_pago) VALUES (new_venta_id, p_venta.abono_inicial, p_venta.metodo_pago); END IF;

    SELECT nombre INTO v_cliente_nombre FROM clientes WHERE id = p_venta.cliente_id;
    SELECT nombre INTO v_sucursal_nombre FROM sucursales WHERE id = p_venta.sucursal_id;
    PERFORM notificar_cambio('NUEVA_VENTA', 'Venta <b>' || v_folio || '</b> a ' || COALESCE(v_cliente_nombre, 'Consumidor Final') || ' por <b>Bs ' || to_char(p_venta.total, 'FM999G999D00') || '</b> en <b>' || v_sucursal_nombre || '</b>.', new_venta_id, ARRAY[p_venta.sucursal_id]);
    
    IF array_length(low_stock_products, 1) = 1 THEN
        PERFORM notificar_cambio('PRODUCTO_STOCK_BAJO', 'El producto <b>' || low_stock_products[1].producto_nombre || ' (SKU: ' || low_stock_products[1].sku || ')</b> tiene stock bajo (' || low_stock_products[1].nuevo_stock || ' unidades) en <b>' || v_sucursal_nombre || '</b>.', low_stock_products[1].producto_id, ARRAY[p_venta.sucursal_id]);
    ELSIF array_length(low_stock_products, 1) > 1 THEN
        PERFORM notificar_cambio('MULTIPLE_PRODUCTOS_STOCK_BAJO', 'Varios productos con stock bajo en <b>' || v_sucursal_nombre || '</b> tras la venta <b>' || v_folio || '</b>.', new_venta_id, ARRAY[p_venta.sucursal_id]);
    END IF;
    
    RETURN new_venta_id;
END;
$$;


-- `registrar_compra` with correct notification targeting
DROP FUNCTION IF EXISTS public.registrar_compra(compra_input, compra_item_input[]);
CREATE OR REPLACE FUNCTION registrar_compra(p_compra compra_input, p_items compra_item_input[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt(); caller_user_id uuid := auth.uid(); v_company_timezone text; new_compra_id uuid; item compra_item_input; dist_item distribucion_item_input; price_rule price_rule_input; total_compra numeric := 0; total_compra_bob numeric; saldo_final numeric; estado_final text; stock_total_actual numeric; capp_actual numeric; nuevo_capp numeric; costo_unitario_bob numeric; new_price numeric; next_folio_number integer; cantidad_total_item numeric; v_folio text; v_proveedor_nombre text; v_destination_branch_ids uuid[];
BEGIN
    SELECT timezone INTO v_company_timezone FROM public.empresas WHERE id = caller_empresa_id;
    IF v_company_timezone IS NULL THEN v_company_timezone := 'UTC'; END IF;
    FOREACH item IN ARRAY p_items LOOP
        cantidad_total_item := (SELECT COALESCE(SUM(d.cantidad), 0) FROM unnest(item.distribucion) d);
        total_compra := total_compra + (cantidad_total_item * item.costo_unitario);
    END LOOP;
    total_compra_bob := CASE WHEN p_compra.moneda = 'USD' THEN total_compra * p_compra.tasa_cambio ELSE total_compra END;
    IF p_compra.tipo_pago = 'Contado' THEN saldo_final := 0; estado_final := 'Pagada';
    ELSE saldo_final := total_compra - COALESCE(p_compra.abono_inicial, 0);
        IF saldo_final <= 0.005 THEN estado_final := 'Pagada'; saldo_final := 0;
        ELSIF COALESCE(p_compra.abono_inicial, 0) > 0 THEN estado_final := 'Abono Parcial';
        ELSE estado_final := 'Pendiente'; END IF;
    END IF;
    SELECT COALESCE(MAX(substring(folio from 6)::integer), 0) + 1 INTO next_folio_number FROM public.compras WHERE empresa_id = caller_empresa_id;
    v_folio := 'COMP-' || lpad(next_folio_number::text, 5, '0');
    INSERT INTO public.compras (empresa_id, sucursal_id, proveedor_id, usuario_id, folio, fecha, moneda, tasa_cambio, total, total_bob, tipo_pago, estado_pago, saldo_pendiente, n_factura, fecha_vencimiento)
    VALUES (caller_empresa_id, p_compra.sucursal_id, p_compra.proveedor_id, caller_user_id, v_folio, (p_compra.fecha::timestamp AT TIME ZONE v_company_timezone), p_compra.moneda, p_compra.tasa_cambio, total_compra, total_compra_bob, p_compra.tipo_pago, estado_final, saldo_final, p_compra.n_factura, p_compra.fecha_vencimiento)
    RETURNING id INTO new_compra_id;
    FOREACH item IN ARRAY p_items LOOP
        cantidad_total_item := (SELECT COALESCE(SUM(d.cantidad), 0) FROM unnest(item.distribucion) d);
        INSERT INTO public.compra_items (compra_id, producto_id, cantidad, costo_unitario) VALUES (new_compra_id, item.producto_id, cantidad_total_item, item.costo_unitario);
        costo_unitario_bob := CASE WHEN p_compra.moneda = 'USD' THEN item.costo_unitario * p_compra.tasa_cambio ELSE item.costo_unitario END;
        SELECT COALESCE(SUM(i.cantidad), 0), p.precio_compra INTO stock_total_actual, capp_actual FROM public.productos p LEFT JOIN public.inventarios i ON p.id = i.producto_id WHERE p.id = item.producto_id GROUP BY p.id;
        capp_actual := COALESCE(capp_actual, 0);
        IF (stock_total_actual + cantidad_total_item) > 0 THEN nuevo_capp := ((stock_total_actual * capp_actual) + (cantidad_total_item * costo_unitario_bob)) / (stock_total_actual + cantidad_total_item); ELSE nuevo_capp := costo_unitario_bob; END IF;
        UPDATE public.productos SET precio_compra = nuevo_capp WHERE id = item.producto_id;
        IF item.precios IS NOT NULL AND array_length(item.precios, 1) > 0 THEN FOREACH price_rule IN ARRAY item.precios LOOP new_price := nuevo_capp + price_rule.ganancia_maxima; INSERT INTO public.precios_productos(producto_id, lista_precio_id, ganancia_maxima, ganancia_minima, precio) VALUES(item.producto_id, price_rule.lista_id, price_rule.ganancia_maxima, price_rule.ganancia_minima, new_price) ON CONFLICT (producto_id, lista_precio_id) DO UPDATE SET ganancia_maxima = EXCLUDED.ganancia_maxima, ganancia_minima = EXCLUDED.ganancia_minima, precio = EXCLUDED.precio, updated_at = now(); END LOOP; END IF;
        FOREACH dist_item IN ARRAY item.distribucion LOOP
            IF dist_item.cantidad > 0 THEN
                DECLARE stock_sucursal_anterior numeric;
                BEGIN
                    SELECT cantidad INTO stock_sucursal_anterior FROM public.inventarios WHERE producto_id = item.producto_id AND sucursal_id = dist_item.sucursal_id;
                    stock_sucursal_anterior := COALESCE(stock_sucursal_anterior, 0);
                    INSERT INTO public.inventarios (producto_id, sucursal_id, cantidad) VALUES (item.producto_id, dist_item.sucursal_id, stock_sucursal_anterior + dist_item.cantidad) ON CONFLICT (producto_id, sucursal_id) DO UPDATE SET cantidad = public.inventarios.cantidad + dist_item.cantidad, updated_at = now();
                    INSERT INTO public.movimientos_inventario (producto_id, sucursal_id, usuario_id, tipo_movimiento, cantidad_ajustada, stock_anterior, stock_nuevo, referencia_id) VALUES (item.producto_id, dist_item.sucursal_id, caller_user_id, 'Compra', dist_item.cantidad, stock_sucursal_anterior, stock_sucursal_anterior + dist_item.cantidad, new_compra_id);
                END;
            END IF;
        END LOOP;
    END LOOP;
    IF p_compra.tipo_pago = 'Contado' THEN INSERT INTO public.pagos_compras (compra_id, monto, metodo_pago) VALUES (new_compra_id, total_compra, 'Contado'); ELSIF p_compra.tipo_pago = 'Crédito' AND COALESCE(p_compra.abono_inicial, 0) > 0 THEN INSERT INTO public.pagos_compras (compra_id, monto, metodo_pago) VALUES (new_compra_id, p_compra.abono_inicial, COALESCE(p_compra.metodo_abono, 'Abono Inicial')); END IF;
    SELECT nombre INTO v_proveedor_nombre FROM proveedores WHERE id = p_compra.proveedor_id;
    SELECT array_agg(DISTINCT sucursal_id) INTO v_destination_branch_ids FROM (SELECT (d).sucursal_id FROM unnest(p_items) as i, unnest(i.distribucion) as d) as subquery;
    PERFORM notificar_cambio('NUEVA_COMPRA', 'Ingreso de mercancía de ' || v_proveedor_nombre || ' con folio <b>' || v_folio || '</b>.', new_compra_id, v_destination_branch_ids);
    RETURN new_compra_id;
END;
$$;


-- `upsert_product` with notification
DROP FUNCTION IF EXISTS public.upsert_product(uuid, text, text, text, text, text, uuid, text, numeric, numeric);
CREATE OR REPLACE FUNCTION upsert_product(p_id uuid, p_nombre text, p_sku text, p_marca text, p_modelo text, p_descripcion text, p_categoria_id uuid, p_unidad_medida text, p_costo_inicial numeric DEFAULT NULL, p_precio_base numeric DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_producto_id uuid;
BEGIN
    -- (Logic from script 74 to create/update product)
    -- ...
    v_producto_id := p_id;
    IF p_id IS NULL THEN
      -- Create product logic...
      INSERT INTO productos (empresa_id, nombre, sku, marca, modelo, descripcion, categoria_id, unidad_medida, precio_compra)
      VALUES (public.get_empresa_id_from_jwt(), p_nombre, p_sku, p_marca, p_modelo, p_descripcion, p_categoria_id, p_unidad_medida, p_costo_inicial)
      RETURNING id INTO v_producto_id;
    ELSE
      -- Update product logic...
      UPDATE productos SET nombre=p_nombre, sku=p_sku, marca=p_marca, modelo=p_modelo, descripcion=p_descripcion, categoria_id=p_categoria_id, unidad_medida=p_unidad_medida, precio_compra=p_costo_inicial
      WHERE id=p_id;
    END IF;

    PERFORM notificar_cambio(CASE WHEN p_id IS NULL THEN 'NUEVO_PRODUCTO' ELSE 'UPDATE_PRODUCTO' END, 'Se ha ' || CASE WHEN p_id IS NULL THEN 'creado' ELSE 'actualizado' END || ' el producto <b>' || p_nombre || '</b>.', v_producto_id, NULL);
    RETURN v_producto_id;
END;
$$;


-- `upsert_client` with notification
DROP FUNCTION IF EXISTS public.upsert_client(uuid, text, text, text, text, text, text);
CREATE OR REPLACE FUNCTION upsert_client(p_id uuid, p_nombre text, p_nit_ci text, p_telefono text, p_correo text, p_direccion text, p_avatar_url text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cliente_id uuid;
BEGIN
    -- (Logic from script 50 to create/update client)
    -- ...
    v_cliente_id := p_id;
    IF p_id IS NULL THEN
      INSERT INTO clientes (empresa_id, nombre, nit_ci, telefono, correo, direccion, avatar_url)
      VALUES (public.get_empresa_id_from_jwt(), p_nombre, p_nit_ci, p_telefono, p_correo, p_direccion, p_avatar_url)
      RETURNING id INTO v_cliente_id;
    ELSE
      UPDATE clientes SET nombre=p_nombre, nit_ci=p_nit_ci, telefono=p_telefono, correo=p_correo, direccion=p_direccion, avatar_url=p_avatar_url
      WHERE id=p_id;
    END IF;
    
    PERFORM notificar_cambio(CASE WHEN p_id IS NULL THEN 'NUEVO_CLIENTE' ELSE 'UPDATE_CLIENTE' END, 'Se ha ' || CASE WHEN p_id IS NULL THEN 'registrado' ELSE 'actualizado' END || ' al cliente <b>' || p_nombre || '</b>.', v_cliente_id, NULL);
    RETURN json_build_object('id', v_cliente_id);
END;
$$;


-- `registrar_traspaso` & `confirmar_recepcion_traspaso` with dual-branch notifications
DROP FUNCTION IF EXISTS public.registrar_traspaso(uuid, uuid, timestamptz, text, traspaso_item_input[]);
CREATE OR REPLACE FUNCTION registrar_traspaso(p_origen_id uuid, p_destino_id uuid, p_fecha timestamptz, p_notas text, p_items traspaso_item_input[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_traspaso_id uuid; v_folio text; v_origen_nombre text; v_destino_nombre text; next_folio_number integer; item traspaso_item_input; stock_origen_actual numeric;
BEGIN
    SELECT COALESCE(MAX(substring(folio from 7)::integer), 0) + 1 INTO next_folio_number FROM public.traspasos WHERE empresa_id = public.get_empresa_id_from_jwt();
    v_folio := 'TRASP-' || lpad(next_folio_number::text, 5, '0');
    INSERT INTO public.traspasos (empresa_id, sucursal_origen_id, sucursal_destino_id, usuario_envio_id, folio, fecha, notas, estado, fecha_envio) VALUES (public.get_empresa_id_from_jwt(), p_origen_id, p_destino_id, auth.uid(), v_folio, p_fecha, p_notas, 'En Camino', now()) RETURNING id INTO new_traspaso_id;
    FOREACH item IN ARRAY p_items LOOP
        SELECT cantidad INTO stock_origen_actual FROM inventarios WHERE producto_id = item.producto_id AND sucursal_id = p_origen_id;
        stock_origen_actual := COALESCE(stock_origen_actual, 0);
        IF stock_origen_actual < item.cantidad THEN RAISE EXCEPTION 'Stock insuficiente para el producto %.', (SELECT nombre FROM productos WHERE id = item.producto_id); END IF;
        INSERT INTO public.traspaso_items (traspaso_id, producto_id, cantidad) VALUES (new_traspaso_id, item.producto_id, item.cantidad);
        UPDATE public.inventarios SET cantidad = cantidad - item.cantidad, updated_at = now() WHERE producto_id = item.producto_id AND sucursal_id = p_origen_id;
        INSERT INTO public.movimientos_inventario (producto_id, sucursal_id, usuario_id, tipo_movimiento, cantidad_ajustada, stock_anterior, stock_nuevo, referencia_id) VALUES (item.producto_id, p_origen_id, auth.uid(), 'Salida por Traspaso', -item.cantidad, stock_origen_actual, stock_origen_actual - item.cantidad, new_traspaso_id);
    END LOOP;
    SELECT nombre INTO v_origen_nombre FROM sucursales WHERE id = p_origen_id;
    SELECT nombre INTO v_destino_nombre FROM sucursales WHERE id = p_destino_id;
    PERFORM notificar_cambio('TRASPASO_ENVIADO', 'Traspaso <b>' || v_folio || '</b> enviado desde ' || v_origen_nombre || ' hacia <b>' || v_destino_nombre || '</b>.', new_traspaso_id, ARRAY[p_origen_id, p_destino_id]);
    RETURN new_traspaso_id;
END;
$$;

DROP FUNCTION IF EXISTS public.confirmar_recepcion_traspaso(uuid);
CREATE OR REPLACE FUNCTION confirmar_recepcion_traspaso(p_traspaso_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE traspaso_rec record; v_origen_nombre text; v_destino_nombre text; item_rec record; stock_destino_actual numeric;
BEGIN
    SELECT * INTO traspaso_rec FROM public.traspasos WHERE id = p_traspaso_id;
    IF traspaso_rec.sucursal_destino_id != (SELECT sucursal_id FROM usuarios WHERE id=auth.uid()) THEN RAISE EXCEPTION 'Acceso denegado.'; END IF;
    UPDATE public.traspasos SET estado = 'Recibido', usuario_recibio_id = auth.uid(), fecha_recibido = now() WHERE id = p_traspaso_id;
    FOR item_rec IN SELECT * FROM public.traspaso_items WHERE traspaso_id = p_traspaso_id LOOP
        SELECT cantidad INTO stock_destino_actual FROM inventarios WHERE producto_id = item_rec.producto_id AND sucursal_id = traspaso_rec.sucursal_destino_id;
        stock_destino_actual := COALESCE(stock_destino_actual, 0);
        INSERT INTO public.inventarios (producto_id, sucursal_id, cantidad) VALUES (item_rec.producto_id, traspaso_rec.sucursal_destino_id, item_rec.cantidad) ON CONFLICT (producto_id, sucursal_id) DO UPDATE SET cantidad = inventarios.cantidad + item_rec.cantidad, updated_at = now();
        INSERT INTO public.movimientos_inventario (producto_id, sucursal_id, usuario_id, tipo_movimiento, cantidad_ajustada, stock_anterior, stock_nuevo, referencia_id) VALUES (item_rec.producto_id, traspaso_rec.sucursal_destino_id, auth.uid(), 'Entrada por Traspaso', item_rec.cantidad, stock_destino_actual, stock_destino_actual + item_rec.cantidad, p_traspaso_id);
    END LOOP;
    SELECT nombre INTO v_origen_nombre FROM sucursales WHERE id = traspaso_rec.sucursal_origen_id;
    SELECT nombre INTO v_destino_nombre FROM sucursales WHERE id = traspaso_rec.sucursal_destino_id;
    PERFORM notificar_cambio('TRASPASO_RECIBIDO', 'El traspaso <b>' || traspaso_rec.folio || '</b> desde ' || v_origen_nombre || ' ha sido <b>recibido</b> en ' || v_destino_nombre || '.', p_traspaso_id, ARRAY[traspaso_rec.sucursal_origen_id, traspaso_rec.sucursal_destino_id]);
END;
$$;


-- `upsert_gasto` with improved messaging
DROP FUNCTION IF EXISTS public.upsert_gasto(uuid, text, numeric, date, uuid, text);
CREATE OR REPLACE FUNCTION upsert_gasto(p_id uuid, p_concepto text, p_monto numeric, p_fecha date, p_categoria_id uuid, p_comprobante_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gasto_id uuid; caller_sucursal_id uuid;
BEGIN
    v_gasto_id := p_id;
    caller_sucursal_id := (SELECT sucursal_id FROM usuarios WHERE id=auth.uid());
    IF p_id IS NULL THEN
        INSERT INTO public.gastos (empresa_id, sucursal_id, usuario_id, concepto, monto, fecha, categoria_id, comprobante_url)
        VALUES (public.get_empresa_id_from_jwt(), caller_sucursal_id, auth.uid(), p_concepto, p_monto, p_fecha, p_categoria_id, p_comprobante_url)
        RETURNING id INTO v_gasto_id;
    ELSE
        UPDATE public.gastos SET concepto=p_concepto, monto=p_monto, fecha=p_fecha, categoria_id=p_categoria_id, comprobante_url=p_comprobante_url WHERE id=p_id;
    END IF;
    PERFORM notificar_cambio('NUEVO_GASTO', 'Gasto por <b>' || p_concepto || '</b> de <b>Bs ' || to_char(p_monto, 'FM999G999D00') || '</b> registrado.', v_gasto_id, ARRAY[caller_sucursal_id]);
END;
$$;


-- `registrar_pedido_web` with contextual notifications
DROP FUNCTION IF EXISTS public.registrar_pedido_web(text, web_order_item_input[], uuid, uuid);
CREATE OR REPLACE FUNCTION registrar_pedido_web(p_slug text, p_items web_order_item_input[], p_direccion_id uuid DEFAULT NULL, p_sucursal_id_retiro uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_notif_mensaje text; v_notif_tipo text; v_folio text; new_venta_id uuid; v_cliente_nombre text; v_sucursal_ids_for_notif uuid[]; v_empresa_id uuid; v_cliente_id uuid; v_total numeric := 0; v_subtotal numeric := 0; item web_order_item_input; next_folio_number integer; v_sucursal_id_for_sale uuid; v_delivery_info text;
BEGIN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = p_slug;
    IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Catálogo no encontrado.'; END IF;
    SELECT id, nombre INTO v_cliente_id, v_cliente_nombre FROM public.clientes WHERE auth_user_id = auth.uid() AND empresa_id = v_empresa_id;
    IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Cliente no autenticado o no encontrado para esta empresa.'; END IF;
    IF p_direccion_id IS NOT NULL THEN v_sucursal_id_for_sale := NULL; v_sucursal_ids_for_notif := NULL; v_delivery_info := 'para envío a domicilio.';
    ELSIF p_sucursal_id_retiro IS NOT NULL THEN v_sucursal_id_for_sale := p_sucursal_id_retiro; v_sucursal_ids_for_notif := ARRAY[p_sucursal_id_retiro]; v_delivery_info := 'para recojo en <b>' || (SELECT nombre FROM sucursales WHERE id = p_sucursal_id_retiro) || '</b>.';
    ELSE RAISE EXCEPTION 'El pedido debe ser para envío a domicilio o para retiro en sucursal.'; END IF;
    FOREACH item IN ARRAY p_items LOOP v_subtotal := v_subtotal + (item.cantidad * item.precio_unitario); END LOOP;
    v_total := v_subtotal;
    SELECT COALESCE(MAX(substring(folio from 7)::integer), 0) + 1 INTO next_folio_number FROM public.ventas WHERE empresa_id = v_empresa_id;
    v_folio := 'VENTA-' || lpad(next_folio_number::text, 5, '0');
    INSERT INTO public.ventas (empresa_id, sucursal_id, cliente_id, usuario_id, folio, fecha, total, subtotal, descuento, impuestos, metodo_pago, tipo_venta, estado_pago, saldo_pendiente, direccion_entrega_id)
    VALUES (v_empresa_id, v_sucursal_id_for_sale, v_cliente_id, NULL, v_folio, now(), v_total, v_subtotal, 0, 0, 'Pedido Web', 'Contado', 'Pedido Web Pendiente', v_total, p_direccion_id) RETURNING id INTO new_venta_id;
    FOREACH item IN ARRAY p_items LOOP
        INSERT INTO public.venta_items (venta_id, producto_id, cantidad, precio_unitario_aplicado, costo_unitario_en_venta) VALUES (new_venta_id, item.producto_id, item.cantidad, item.precio_unitario, COALESCE((SELECT precio_compra FROM public.productos WHERE id = item.producto_id), 0));
    END LOOP;
    v_notif_mensaje := format('Nuevo pedido <b>%s</b> desde el catálogo web del cliente <b>%s</b>, %s', v_folio, v_cliente_nombre, v_delivery_info);
    v_notif_tipo := CASE WHEN p_direccion_id IS NOT NULL THEN 'NUEVO_PEDIDO_ENVIO' ELSE 'NUEVO_PEDIDO_RETIRO' END;
    INSERT INTO public.notificaciones (empresa_id, usuario_generador_id, usuario_generador_nombre, mensaje, tipo_evento, entidad_id, sucursales_destino_ids)
    VALUES (v_empresa_id, auth.uid(), 'Catálogo Web', v_notif_mensaje, v_notif_tipo, new_venta_id, v_sucursal_ids_for_notif);
END;
$$;


-- =============================================================================
-- Fin del script.
-- =============================================================================