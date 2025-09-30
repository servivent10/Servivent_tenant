-- =============================================================================
-- PRODUCTOS, INVENTARIOS & PRECIOS - DATABASE SETUP (v11 - Idempotent Fix)
-- =============================================================================
-- Este script implementa la nueva lógica de 'Ganancia Máxima' y 'Ganancia Mínima',
-- y corrige un error de sintaxis en la alteración de la tabla para que sea
-- seguro ejecutarlo múltiples veces.
--
-- **INSTRUCCIONES:**
-- 1. Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Modificación de Tablas y Creación de Trigger (CORREGIDO)
-- -----------------------------------------------------------------------------
-- Se utiliza un bloque DO para manejar las alteraciones de la tabla de forma segura
-- y evitar errores si el script se ejecuta más de una vez.
DO $$
BEGIN
    -- Eliminar la columna 'tipo_ganancia' si existe (esto es seguro)
    ALTER TABLE public.precios_productos DROP COLUMN IF EXISTS tipo_ganancia;

    -- Renombrar 'valor_ganancia' a 'ganancia_maxima' solo si la columna original existe
    -- y la nueva no. Esto previene el error 'RENAME COLUMN IF EXISTS'.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='precios_productos' AND column_name='valor_ganancia') AND
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='precios_productos' AND column_name='ganancia_maxima') THEN
        ALTER TABLE public.precios_productos RENAME COLUMN valor_ganancia TO ganancia_maxima;
    END IF;

    -- Añadir 'ganancia_minima' si no existe (esto es seguro)
    ALTER TABLE public.precios_productos ADD COLUMN IF NOT EXISTS ganancia_minima NUMERIC(10, 2) NOT NULL DEFAULT 0;
END $$;


-- Se actualiza el trigger para recalcular el precio de venta basado en la ganancia máxima.
CREATE OR REPLACE FUNCTION recalculate_prices_on_cost_change()
RETURNS TRIGGER AS $$
DECLARE
    price_rule RECORD;
    new_price NUMERIC;
BEGIN
    FOR price_rule IN
        SELECT id, ganancia_maxima
        FROM public.precios_productos
        WHERE producto_id = NEW.id
    LOOP
        -- El precio de venta siempre es el costo + la ganancia máxima.
        new_price := NEW.precio_compra + price_rule.ganancia_maxima;
        UPDATE public.precios_productos
        SET precio = new_price
        WHERE id = price_rule.id;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_product_cost_change ON public.productos;
CREATE TRIGGER on_product_cost_change
AFTER UPDATE OF precio_compra ON public.productos
FOR EACH ROW
WHEN (OLD.precio_compra IS DISTINCT FROM NEW.precio_compra)
EXECUTE FUNCTION recalculate_prices_on_cost_change();


-- -----------------------------------------------------------------------------
-- Paso 2: Funciones RPC (Lógica de Negocio) - **ACTUALIZADO**
-- -----------------------------------------------------------------------------
-- Se mantiene la función sin cambios, ya que la lógica de stock es independiente.
CREATE OR REPLACE FUNCTION get_company_products_with_stock()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_sucursal_id uuid;
    products_list json;
    kpis json;
BEGIN
    SELECT u.empresa_id, u.sucursal_id INTO caller_empresa_id, caller_sucursal_id
    FROM public.usuarios u WHERE u.id = auth.uid();

    IF caller_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado.';
    END IF;

    SELECT json_agg(p_info) INTO products_list FROM (
        SELECT
            p.id, p.nombre, p.sku, p.marca, p.modelo, p.categoria_id, p.unidad_medida, p.descripcion,
            c.nombre as categoria_nombre,
            COALESCE(i.stock_total, 0) as stock_total,
            COALESCE(i_sucursal.stock_sucursal, 0) as stock_sucursal,
            COALESCE(pp.precio, 0) as precio_base,
            (SELECT img.imagen_url FROM public.imagenes_productos img WHERE img.producto_id = p.id ORDER BY img.orden, img.created_at LIMIT 1) as imagen_principal
        FROM public.productos p
        LEFT JOIN public.categorias c ON p.categoria_id = c.id
        LEFT JOIN (SELECT inv.producto_id, SUM(inv.cantidad) as stock_total FROM public.inventarios inv GROUP BY inv.producto_id) i ON p.id = i.producto_id
        LEFT JOIN (SELECT inv_s.producto_id, inv_s.cantidad as stock_sucursal FROM public.inventarios inv_s WHERE inv_s.sucursal_id = caller_sucursal_id) i_sucursal ON p.id = i_sucursal.producto_id
        LEFT JOIN public.listas_precios lp ON lp.empresa_id = p.empresa_id AND lp.es_predeterminada = true
        LEFT JOIN public.precios_productos pp ON pp.producto_id = p.id AND pp.lista_precio_id = lp.id
        WHERE p.empresa_id = caller_empresa_id
        ORDER BY p.created_at DESC
    ) AS p_info;

    SELECT json_build_object(
        'total_products', (SELECT COUNT(*) FROM public.productos WHERE empresa_id = caller_empresa_id),
        'total_stock_items', COALESCE((SELECT SUM(cantidad) FROM public.inventarios inv JOIN public.productos pr ON inv.producto_id = pr.id WHERE pr.empresa_id = caller_empresa_id), 0),
        'products_without_stock', (SELECT COUNT(*) FROM public.productos p WHERE p.empresa_id = caller_empresa_id AND COALESCE((SELECT SUM(inv.cantidad) FROM public.inventarios inv WHERE inv.producto_id = p.id), 0) <= 0)
    ) INTO kpis;

    RETURN json_build_object('products', COALESCE(products_list, '[]'::json), 'kpis', kpis);
END;
$$;


-- **FUNCIÓN ACTUALIZADA:** `get_product_details`
-- **CAMBIO:** Ahora devuelve `ganancia_maxima` y `ganancia_minima` en lugar de `tipo_ganancia` y `valor_ganancia`.
CREATE OR REPLACE FUNCTION get_product_details(p_producto_id uuid) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE caller_empresa_id uuid; details jsonb; images json; inventory json; prices json; all_branches json; BEGIN caller_empresa_id := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid()); IF NOT EXISTS (SELECT 1 FROM public.productos WHERE id = p_producto_id AND empresa_id = caller_empresa_id) THEN RAISE EXCEPTION 'Producto no encontrado o no pertenece a tu empresa.'; END IF; SELECT to_jsonb(p) || jsonb_build_object('categoria_nombre', c.nombre) INTO details FROM public.productos p LEFT JOIN public.categorias c ON p.categoria_id = c.id WHERE p.id = p_producto_id; SELECT json_agg(i ORDER BY i.orden) INTO images FROM public.imagenes_productos i WHERE i.producto_id = p_producto_id; SELECT json_agg(inv) INTO inventory FROM ( SELECT i.sucursal_id, i.cantidad, i.stock_minimo, s.nombre as sucursal_nombre FROM public.inventarios i JOIN public.sucursales s ON i.sucursal_id = s.id WHERE i.producto_id = p_producto_id ) inv; SELECT json_agg(pr) INTO prices FROM ( SELECT lp.id as lista_precio_id, lp.nombre as lista_nombre, lp.es_predeterminada, pp.precio, pp.ganancia_maxima, pp.ganancia_minima FROM public.listas_precios lp LEFT JOIN public.precios_productos pp ON lp.id = pp.lista_precio_id AND pp.producto_id = p_producto_id WHERE lp.empresa_id = caller_empresa_id ORDER BY lp.es_predeterminada DESC, lp.orden ASC, lp.nombre ASC ) pr; SELECT json_agg(b) INTO all_branches FROM (SELECT id, nombre FROM public.sucursales WHERE empresa_id = caller_empresa_id ORDER BY nombre) b; RETURN json_build_object('details', details, 'images', COALESCE(images, '[]'::json), 'inventory', COALESCE(inventory, '[]'::json), 'prices', COALESCE(prices, '[]'::json), 'all_branches', COALESCE(all_branches, '[]'::json)); END; $$;

-- **FUNCIÓN ACTUALIZADA:** `update_product_prices`
-- **CAMBIO:** Se actualiza el tipo de entrada y la lógica de inserción/actualización.
DROP TYPE IF EXISTS public.price_rule_input CASCADE;
CREATE TYPE public.price_rule_input AS ( lista_id uuid, ganancia_maxima numeric, ganancia_minima numeric );

CREATE OR REPLACE FUNCTION update_product_prices( p_producto_id uuid, p_precios price_rule_input[] ) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE caller_empresa_id uuid; product_cost numeric; new_price numeric; price_item price_rule_input; BEGIN caller_empresa_id := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid()); IF NOT EXISTS (SELECT 1 FROM public.productos WHERE id = p_producto_id AND empresa_id = caller_empresa_id) THEN RAISE EXCEPTION 'Producto no encontrado o no pertenece a tu empresa.'; END IF; SELECT precio_compra INTO product_cost FROM public.productos WHERE id = p_producto_id; product_cost := COALESCE(product_cost, 0); FOREACH price_item IN ARRAY p_precios LOOP new_price := product_cost + price_item.ganancia_maxima; INSERT INTO public.precios_productos(producto_id, lista_precio_id, ganancia_maxima, ganancia_minima, precio) VALUES(p_producto_id, price_item.lista_id, price_item.ganancia_maxima, price_item.ganancia_minima, new_price) ON CONFLICT (producto_id, lista_precio_id) DO UPDATE SET ganancia_maxima = EXCLUDED.ganancia_maxima, ganancia_minima = EXCLUDED.ganancia_minima, precio = EXCLUDED.precio, updated_at = now(); END LOOP; END; $$;

-- **FUNCIÓN ACTUALIZADA:** `registrar_compra`
-- **CAMBIO:** Se actualizan los tipos de entrada y la lógica para manejar precios y ganancias.
DROP TYPE IF EXISTS public.compra_item_input CASCADE;
CREATE TYPE public.compra_item_input AS ( producto_id uuid, cantidad numeric, costo_unitario numeric, precios price_rule_input[] );

DROP TYPE IF EXISTS public.compra_input CASCADE;
CREATE TYPE public.compra_input AS ( proveedor_id uuid, sucursal_id uuid, fecha date, moneda text, tasa_cambio numeric, tipo_pago text, n_factura text, fecha_vencimiento date, abono_inicial numeric, metodo_abono text );

CREATE OR REPLACE FUNCTION registrar_compra(p_compra compra_input, p_items compra_item_input[]) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE caller_empresa_id uuid := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid()); caller_user_id uuid := auth.uid(); new_compra_id uuid; item compra_item_input; price_rule price_rule_input; total_compra numeric := 0; total_compra_bob numeric; saldo_final numeric; estado_final text; stock_total_actual numeric; capp_actual numeric; nuevo_capp numeric; costo_unitario_bob numeric; new_price numeric; next_folio_number integer; BEGIN FOREACH item IN ARRAY p_items LOOP total_compra := total_compra + (item.cantidad * item.costo_unitario); END LOOP; total_compra_bob := CASE WHEN p_compra.moneda = 'USD' THEN total_compra * p_compra.tasa_cambio ELSE total_compra END; IF p_compra.tipo_pago = 'Contado' THEN saldo_final := 0; estado_final := 'Pagada'; ELSE saldo_final := total_compra - COALESCE(p_compra.abono_inicial, 0); IF saldo_final <= 0.005 THEN estado_final := 'Pagada'; saldo_final := 0; ELSIF COALESCE(p_compra.abono_inicial, 0) > 0 THEN estado_final := 'Abono Parcial'; ELSE estado_final := 'Pendiente'; END IF; END IF; SELECT COALESCE(MAX(substring(folio from 6)::integer), 0) + 1 INTO next_folio_number FROM public.compras WHERE empresa_id = caller_empresa_id; INSERT INTO public.compras (empresa_id, sucursal_id, proveedor_id, folio, fecha, moneda, tasa_cambio, total, total_bob, tipo_pago, estado_pago, saldo_pendiente, n_factura, fecha_vencimiento) VALUES (caller_empresa_id, p_compra.sucursal_id, p_compra.proveedor_id, 'COMP-' || lpad(next_folio_number::text, 5, '0'), p_compra.fecha, p_compra.moneda, p_compra.tasa_cambio, total_compra, total_compra_bob, p_compra.tipo_pago, estado_final, saldo_final, p_compra.n_factura, p_compra.fecha_vencimiento) RETURNING id INTO new_compra_id; FOREACH item IN ARRAY p_items LOOP INSERT INTO public.compra_items (compra_id, producto_id, cantidad, costo_unitario) VALUES (new_compra_id, item.producto_id, item.cantidad, item.costo_unitario); costo_unitario_bob := CASE WHEN p_compra.moneda = 'USD' THEN item.costo_unitario * p_compra.tasa_cambio ELSE item.costo_unitario END; SELECT COALESCE(SUM(i.cantidad), 0), p.precio_compra INTO stock_total_actual, capp_actual FROM public.productos p LEFT JOIN public.inventarios i ON p.id = i.producto_id WHERE p.id = item.producto_id GROUP BY p.id; capp_actual := COALESCE(capp_actual, 0); IF (stock_total_actual + item.cantidad) > 0 THEN nuevo_capp := ((stock_total_actual * capp_actual) + (item.cantidad * costo_unitario_bob)) / (stock_total_actual + item.cantidad); ELSE nuevo_capp := costo_unitario_bob; END IF; UPDATE public.productos SET precio_compra = nuevo_capp WHERE id = item.producto_id; IF item.precios IS NOT NULL AND array_length(item.precios, 1) > 0 THEN FOREACH price_rule IN ARRAY item.precios LOOP new_price := nuevo_capp + price_rule.ganancia_maxima; INSERT INTO public.precios_productos(producto_id, lista_precio_id, ganancia_maxima, ganancia_minima, precio) VALUES(item.producto_id, price_rule.lista_id, price_rule.ganancia_maxima, price_rule.ganancia_minima, new_price) ON CONFLICT (producto_id, lista_precio_id) DO UPDATE SET ganancia_maxima = EXCLUDED.ganancia_maxima, ganancia_minima = EXCLUDED.ganancia_minima, precio = EXCLUDED.precio, updated_at = now(); END LOOP; END IF; DECLARE stock_sucursal_anterior numeric; BEGIN SELECT cantidad INTO stock_sucursal_anterior FROM public.inventarios WHERE producto_id = item.producto_id AND sucursal_id = p_compra.sucursal_id; stock_sucursal_anterior := COALESCE(stock_sucursal_anterior, 0); INSERT INTO public.inventarios (producto_id, sucursal_id, cantidad) VALUES (item.producto_id, p_compra.sucursal_id, stock_sucursal_anterior + item.cantidad) ON CONFLICT (producto_id, sucursal_id) DO UPDATE SET cantidad = public.inventarios.cantidad + item.cantidad, updated_at = now(); INSERT INTO public.movimientos_inventario (producto_id, sucursal_id, usuario_id, tipo_movimiento, cantidad_ajustada, stock_anterior, stock_nuevo, referencia_id) VALUES (item.producto_id, p_compra.sucursal_id, caller_user_id, 'Compra', item.cantidad, stock_sucursal_anterior, stock_sucursal_anterior + item.cantidad, new_compra_id); END; END LOOP; IF p_compra.tipo_pago = 'Contado' THEN INSERT INTO public.pagos_compras (compra_id, monto, metodo_pago) VALUES (new_compra_id, total_compra, 'Contado'); ELSIF p_compra.tipo_pago = 'Crédito' AND COALESCE(p_compra.abono_inicial, 0) > 0 THEN INSERT INTO public.pagos_compras (compra_id, monto, metodo_pago) VALUES (new_compra_id, p_compra.abono_inicial, COALESCE(p_compra.metodo_abono, 'Abono Inicial')); END IF; RETURN new_compra_id; END; $$;

-- **FUNCIÓN ACTUALIZADA:** `upsert_product`
-- **CAMBIO:** La inserción en `precios_productos` ahora usa las nuevas columnas.
CREATE OR REPLACE FUNCTION upsert_product( p_id uuid, p_nombre text, p_sku text, p_marca text, p_modelo text, p_descripcion text, p_categoria_id uuid, p_unidad_medida text ) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE caller_empresa_id uuid; v_producto_id uuid; v_default_price_list_id uuid; BEGIN caller_empresa_id := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid()); IF caller_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario no encontrado.'; END IF; SELECT id INTO v_default_price_list_id FROM public.listas_precios WHERE empresa_id = caller_empresa_id AND es_predeterminada = true; IF v_default_price_list_id IS NULL THEN INSERT INTO public.listas_precios (empresa_id, nombre, es_predeterminada, descripcion) VALUES (caller_empresa_id, 'General', true, 'Precio de venta estándar') RETURNING id INTO v_default_price_list_id; END IF; IF p_id IS NULL THEN INSERT INTO public.productos(empresa_id, nombre, sku, marca, modelo, descripcion, categoria_id, unidad_medida) VALUES (caller_empresa_id, p_nombre, p_sku, p_marca, p_modelo, p_descripcion, p_categoria_id, p_unidad_medida) RETURNING id INTO v_producto_id; INSERT INTO public.precios_productos(producto_id, lista_precio_id, precio, ganancia_maxima, ganancia_minima) VALUES(v_producto_id, v_default_price_list_id, 0, 0, 0); ELSE UPDATE public.productos SET nombre = p_nombre, sku = p_sku, marca = p_marca, modelo = p_modelo, descripcion = p_descripcion, categoria_id = p_categoria_id, unidad_medida = p_unidad_medida WHERE id = p_id AND empresa_id = caller_empresa_id; v_producto_id := p_id; END IF; RETURN v_producto_id; END; $$;

-- **FUNCIÓN ACTUALIZADA:** `get_pos_data`
-- **CAMBIO:** Devuelve el objeto completo de precio, incluyendo las ganancias, para el cálculo de descuentos.
CREATE OR REPLACE FUNCTION get_pos_data() RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE caller_empresa_id uuid; caller_sucursal_id uuid; products_list json; price_lists_list json; BEGIN SELECT u.empresa_id, u.sucursal_id INTO caller_empresa_id, caller_sucursal_id FROM public.usuarios u WHERE u.id = auth.uid(); IF caller_empresa_id IS NULL OR caller_sucursal_id IS NULL THEN RAISE EXCEPTION 'Usuario no encontrado o no asignado a una sucursal.'; END IF; SELECT json_agg(pl_info) INTO price_lists_list FROM ( SELECT id, nombre, es_predeterminada FROM public.listas_precios WHERE empresa_id = caller_empresa_id ORDER BY es_predeterminada DESC, orden ASC, nombre ASC ) AS pl_info; SELECT json_agg(p_info) INTO products_list FROM ( SELECT p.id, p.nombre, p.sku, p.marca, p.modelo, p.descripcion, p.unidad_medida, c.nombre as categoria_nombre, (SELECT img.imagen_url FROM public.imagenes_productos img WHERE img.producto_id = p.id ORDER BY img.orden, img.created_at LIMIT 1) as imagen_principal, COALESCE((SELECT i.cantidad FROM public.inventarios i WHERE i.producto_id = p.id AND i.sucursal_id = caller_sucursal_id), 0) as stock_sucursal, ( SELECT json_agg(json_build_object('sucursal_id', s.id, 'sucursal_nombre', s.nombre, 'cantidad', COALESCE(i.cantidad, 0))) FROM public.sucursales s LEFT JOIN public.inventarios i ON s.id = i.sucursal_id AND i.producto_id = p.id WHERE s.empresa_id = caller_empresa_id ) as all_branch_stock, ( SELECT json_object_agg(pp.lista_precio_id, json_build_object('precio', pp.precio, 'ganancia_maxima', pp.ganancia_maxima, 'ganancia_minima', pp.ganancia_minima)) FROM public.precios_productos pp WHERE pp.producto_id = p.id ) as prices FROM public.productos p LEFT JOIN public.categorias c ON p.categoria_id = c.id WHERE p.empresa_id = caller_empresa_id ORDER BY p.nombre ASC ) AS p_info; RETURN json_build_object( 'products', COALESCE(products_list, '[]'::json), 'price_lists', COALESCE(price_lists_list, '[]'::json) ); END; $$;

-- Se mantienen las demás funciones sin cambios
CREATE OR REPLACE FUNCTION get_price_lists() RETURNS TABLE (id uuid, nombre text, descripcion text, es_predeterminada boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN RETURN QUERY SELECT lp.id, lp.nombre, lp.descripcion, lp.es_predeterminada FROM public.listas_precios lp WHERE lp.empresa_id = (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid()) ORDER BY lp.es_predeterminada DESC, lp.orden ASC, lp.nombre ASC; END; $$;
CREATE OR REPLACE FUNCTION upsert_price_list(p_id uuid, p_nombre text, p_descripcion text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE caller_empresa_id uuid; v_list_id uuid; v_new_order integer; BEGIN caller_empresa_id := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid()); IF p_id IS NULL THEN SELECT COALESCE(MAX(orden), -1) + 1 INTO v_new_order FROM public.listas_precios WHERE empresa_id = caller_empresa_id AND es_predeterminada = false; INSERT INTO public.listas_precios (empresa_id, nombre, descripcion, orden) VALUES (caller_empresa_id, p_nombre, p_descripcion, v_new_order) RETURNING id INTO v_list_id; ELSE UPDATE public.listas_precios SET nombre = p_nombre, descripcion = p_descripcion WHERE id = p_id AND empresa_id = caller_empresa_id; v_list_id := p_id; END IF; RETURN v_list_id; END; $$;
CREATE OR REPLACE FUNCTION update_price_list_order(p_list_ids uuid[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE caller_empresa_id uuid; BEGIN caller_empresa_id := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid()); IF caller_empresa_id IS NULL THEN RAISE EXCEPTION 'Acceso denegado.'; END IF; WITH new_order AS ( SELECT id, (row_number() OVER ()) - 1 AS orden FROM unnest(p_list_ids) as id ) UPDATE public.listas_precios lp SET orden = new_order.orden FROM new_order WHERE lp.id = new_order.id AND lp.empresa_id = caller_empresa_id; END; $$;
-- =============================================================================
-- Fin del script.
-- =============================================================================