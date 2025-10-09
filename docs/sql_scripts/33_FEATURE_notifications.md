-- =============================================================================
-- INTELLIGENT NOTIFICATIONS SYSTEM (V4 - Sucursal Scoping & Formatting Fix)
-- =============================================================================
-- Este script implementa un sistema de notificaciones mucho más inteligente,
-- permitiendo que se dirijan a sucursales específicas y corrigiendo bugs
-- de formato de moneda.
--
-- ¿QUÉ HACE ESTE SCRIPT?
-- 1.  Modifica la tabla `notificaciones` para incluir un array de IDs de
--     sucursales de destino.
-- 2.  Actualiza las funciones de lectura de notificaciones para que los
--     Propietarios vean todo, pero los demás roles solo vean las notificaciones
--     dirigidas a su sucursal.
-- 3.  Modifica la función `notificar_cambio` para aceptar el array de sucursales.
-- 4.  Actualiza TODAS las funciones de negocio (`registrar_venta`, etc.) para:
--     a) Pasar las sucursales de destino correctas (para traspasos, son 2).
--     b) Formatear correctamente los montos de dinero a 2 decimales.
--
-- **INSTRUCCIONES:**
-- Ejecuta este script completo en tu Editor SQL. Es seguro ejecutarlo varias veces.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Modificar la tabla `notificaciones` (Idempotente)
-- -----------------------------------------------------------------------------
ALTER TABLE public.notificaciones DROP COLUMN IF EXISTS sucursal_nombre;
ALTER TABLE public.notificaciones ADD COLUMN IF NOT EXISTS sucursales_destino_ids uuid[];

-- (El resto de la tabla y políticas se mantienen igual)
CREATE TABLE IF NOT EXISTS public.notificaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    usuario_generador_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    usuario_generador_nombre text,
    mensaje text NOT NULL,
    tipo_evento text,
    entidad_id uuid,
    leido_por uuid[] DEFAULT ARRAY[]::uuid[],
    created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.notificaciones;
CREATE POLICY "Enable all for own company" ON public.notificaciones
FOR ALL USING (
    empresa_id = public.get_empresa_id_from_jwt()
);

-- -----------------------------------------------------------------------------
-- Paso 2: Función `notificar_cambio` (ACTUALIZADA)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notificar_cambio(
    p_tipo_evento text,
    p_mensaje text,
    p_entidad_id uuid,
    p_sucursal_ids uuid[] -- NUEVO: Array de sucursales a notificar
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_usuario_nombre text;
BEGIN
    v_usuario_id := auth.uid();
    v_empresa_id := (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid;
    v_usuario_nombre := (auth.jwt() -> 'app_metadata' ->> 'nombre_completo')::text;

    IF v_empresa_id IS NOT NULL THEN
        INSERT INTO public.notificaciones (
            empresa_id, usuario_generador_id, usuario_generador_nombre, 
            mensaje, tipo_evento, entidad_id, sucursales_destino_ids
        ) VALUES (
            v_empresa_id, v_usuario_id, v_usuario_nombre,
            p_mensaje, p_tipo_evento, p_entidad_id, p_sucursal_ids
        );
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Paso 3: Funciones de lectura de notificaciones (CORREGIDAS)
-- -----------------------------------------------------------------------------

-- **FIX**: Eliminar la función existente antes de recrearla con la nueva firma
DROP FUNCTION IF EXISTS public.get_notificaciones();

CREATE OR REPLACE FUNCTION public.get_notificaciones()
RETURNS TABLE (
    id uuid, mensaje text, tipo_evento text, entidad_id uuid,
    usuario_generador_nombre text, created_at timestamptz, is_read boolean
) LANGUAGE plpgsql AS $$
DECLARE
    v_user_rol text;
    v_user_sucursal_id uuid;
BEGIN
    -- FIX: Qualify 'id' with table alias 'u' to avoid ambiguity with output column 'id'
    SELECT u.rol, u.sucursal_id INTO v_user_rol, v_user_sucursal_id FROM public.usuarios u WHERE u.id = auth.uid();
    
    RETURN QUERY
    SELECT n.id, n.mensaje, n.tipo_evento, n.entidad_id, n.usuario_generador_nombre, n.created_at, (auth.uid() = ANY(n.leido_por)) as is_read
    FROM public.notificaciones n
    WHERE n.empresa_id = public.get_empresa_id_from_jwt()
      AND (
          v_user_rol = 'Propietario' OR -- El propietario ve todo
          n.sucursales_destino_ids IS NULL OR -- Notificaciones globales (para Propietario)
          v_user_sucursal_id = ANY(n.sucursales_destino_ids) -- La sucursal del usuario está en la lista de destino
      )
    ORDER BY n.created_at DESC LIMIT 20;
END;
$$;


CREATE OR REPLACE FUNCTION public.mark_notificaciones_as_read()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.notificaciones
    SET leido_por = array_append(leido_por, auth.uid())
    WHERE empresa_id = public.get_empresa_id_from_jwt() AND NOT (leido_por @> ARRAY[auth.uid()]);
END;
$$;

-- **FIX**: Eliminar la función existente antes de recrearla con la nueva firma
DROP FUNCTION IF EXISTS public.get_all_notificaciones_filtered(date, date, text[], uuid[], boolean);

CREATE OR REPLACE FUNCTION public.get_all_notificaciones_filtered(
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_event_types text[] DEFAULT NULL,
    p_sucursal_ids uuid[] DEFAULT NULL,
    p_read_status boolean DEFAULT NULL
)
RETURNS TABLE (
    id uuid, mensaje text, tipo_evento text, entidad_id uuid,
    usuario_generador_nombre text, created_at timestamptz, is_read boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_user_rol text;
    v_user_sucursal_id uuid;
BEGIN
    -- FIX: Qualify 'id' with table alias 'u' to avoid ambiguity with output column 'id'
    SELECT u.rol, u.sucursal_id INTO v_user_rol, v_user_sucursal_id FROM public.usuarios u WHERE u.id = v_user_id;

    RETURN QUERY
    SELECT
        n.id, n.mensaje, n.tipo_evento, n.entidad_id, n.usuario_generador_nombre,
        n.created_at, (v_user_id = ANY(n.leido_por)) as is_read
    FROM public.notificaciones n
    WHERE n.empresa_id = public.get_empresa_id_from_jwt()
      -- Filtros de la UI
      AND (p_start_date IS NULL OR n.created_at::date >= p_start_date)
      AND (p_end_date IS NULL OR n.created_at::date <= p_end_date)
      AND (p_event_types IS NULL OR array_length(p_event_types, 1) IS NULL OR n.tipo_evento = ANY(p_event_types))
      AND (p_sucursal_ids IS NULL OR array_length(p_sucursal_ids, 1) IS NULL OR n.sucursales_destino_ids && p_sucursal_ids)
      AND (p_read_status IS NULL OR (v_user_id = ANY(n.leido_por)) = p_read_status)
      -- Filtro de seguridad por rol
      AND (
          v_user_rol = 'Propietario' OR
          n.sucursales_destino_ids IS NULL OR
          v_user_sucursal_id = ANY(n.sucursales_destino_ids)
      )
    ORDER BY n.created_at DESC;
END;
$$;

-- -----------------------------------------------------------------------------
-- Paso 4: Actualizar funciones de negocio
-- -----------------------------------------------------------------------------

-- registrar_venta (con formato de moneda)
CREATE OR REPLACE FUNCTION registrar_venta(p_venta venta_input, p_items venta_item_input[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    new_venta_id uuid; v_folio text; v_cliente_nombre text; v_sucursal_nombre text;
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    caller_user_id uuid := auth.uid();
    item venta_item_input; saldo_final numeric; estado_final text; next_folio_number integer;
    stock_sucursal_anterior numeric;
BEGIN
    -- (lógica de negocio original)
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
        SELECT cantidad INTO stock_sucursal_anterior FROM public.inventarios WHERE producto_id = item.producto_id AND sucursal_id = p_venta.sucursal_id;
        stock_sucursal_anterior := COALESCE(stock_sucursal_anterior, 0);
        UPDATE public.inventarios SET cantidad = cantidad - item.cantidad, updated_at = now() WHERE producto_id = item.producto_id AND sucursal_id = p_venta.sucursal_id;
        INSERT INTO public.movimientos_inventario (producto_id, sucursal_id, usuario_id, tipo_movimiento, cantidad_ajustada, stock_anterior, stock_nuevo, referencia_id) VALUES (item.producto_id, p_venta.sucursal_id, caller_user_id, 'Venta', -item.cantidad, stock_sucursal_anterior, stock_sucursal_anterior - item.cantidad, new_venta_id);
    END LOOP;
    IF p_venta.tipo_venta = 'Crédito' AND p_venta.cliente_id IS NOT NULL THEN UPDATE public.clientes SET saldo_pendiente = saldo_pendiente + saldo_final WHERE id = p_venta.cliente_id; END IF;
    IF p_venta.tipo_venta = 'Contado' THEN INSERT INTO public.pagos_ventas (venta_id, monto, metodo_pago) VALUES (new_venta_id, p_venta.total, p_venta.metodo_pago);
    ELSIF p_venta.tipo_venta = 'Crédito' AND COALESCE(p_venta.abono_inicial, 0) > 0 THEN INSERT INTO public.pagos_ventas (venta_id, monto, metodo_pago) VALUES (new_venta_id, p_venta.abono_inicial, p_venta.metodo_pago); END IF;

    SELECT nombre INTO v_cliente_nombre FROM clientes WHERE id = p_venta.cliente_id;
    SELECT nombre INTO v_sucursal_nombre FROM sucursales WHERE id = p_venta.sucursal_id;
    PERFORM notificar_cambio('NUEVA_VENTA', 'Venta <b>' || v_folio || '</b> a ' || COALESCE(v_cliente_nombre, 'Consumidor Final') || ' por <b>Bs ' || to_char(p_venta.total, 'FM999G999D00') || '</b> en <b>' || v_sucursal_nombre || '</b>', new_venta_id, ARRAY[p_venta.sucursal_id]);
    
    RETURN new_venta_id;
END;
$$;

-- registrar_compra (con formato de moneda)
CREATE OR REPLACE FUNCTION registrar_compra(p_compra compra_input, p_items compra_item_input[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    new_compra_id uuid; v_folio text; v_proveedor_nombre text; v_sucursal_nombre text;
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    caller_user_id uuid := auth.uid();
    item compra_item_input; dist_item distribucion_item_input; price_rule price_rule_input;
    total_compra numeric := 0; total_compra_bob numeric; saldo_final numeric; estado_final text;
    stock_total_actual numeric; capp_actual numeric; nuevo_capp numeric; costo_unitario_bob numeric;
    new_price numeric; next_folio_number integer; cantidad_total_item numeric;
BEGIN
    -- (lógica de negocio original)
    FOREACH item IN ARRAY p_items LOOP cantidad_total_item := (SELECT SUM(d.cantidad) FROM unnest(item.distribucion) d); total_compra := total_compra + (cantidad_total_item * item.costo_unitario); END LOOP;
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
    VALUES (caller_empresa_id, p_compra.sucursal_id, p_compra.proveedor_id, caller_user_id, v_folio, p_compra.fecha, p_compra.moneda, p_compra.tasa_cambio, total_compra, total_compra_bob, p_compra.tipo_pago, estado_final, saldo_final, p_compra.n_factura, p_compra.fecha_vencimiento) RETURNING id INTO new_compra_id;
    FOREACH item IN ARRAY p_items LOOP cantidad_total_item := (SELECT SUM(d.cantidad) FROM unnest(item.distribucion) d); INSERT INTO public.compra_items (compra_id, producto_id, cantidad, costo_unitario) VALUES (new_compra_id, item.producto_id, cantidad_total_item, item.costo_unitario); costo_unitario_bob := CASE WHEN p_compra.moneda = 'USD' THEN item.costo_unitario * p_compra.tasa_cambio ELSE item.costo_unitario END; SELECT COALESCE(SUM(i.cantidad), 0), p.precio_compra INTO stock_total_actual, capp_actual FROM public.productos p LEFT JOIN public.inventarios i ON p.id = i.producto_id WHERE p.id = item.producto_id GROUP BY p.id; capp_actual := COALESCE(capp_actual, 0); IF (stock_total_actual + cantidad_total_item) > 0 THEN nuevo_capp := ((stock_total_actual * capp_actual) + (cantidad_total_item * costo_unitario_bob)) / (stock_total_actual + cantidad_total_item); ELSE nuevo_capp := costo_unitario_bob; END IF; UPDATE public.productos SET precio_compra = nuevo_capp WHERE id = item.producto_id; IF item.precios IS NOT NULL AND array_length(item.precios, 1) > 0 THEN FOREACH price_rule IN ARRAY item.precios LOOP new_price := nuevo_capp + price_rule.ganancia_maxima; INSERT INTO public.precios_productos(producto_id, lista_precio_id, ganancia_maxima, ganancia_minima, precio) VALUES(item.producto_id, price_rule.lista_id, price_rule.ganancia_maxima, price_rule.ganancia_minima, new_price) ON CONFLICT (producto_id, lista_precio_id) DO UPDATE SET ganancia_maxima = EXCLUDED.ganancia_maxima, ganancia_minima = EXCLUDED.ganancia_minima, precio = EXCLUDED.precio, updated_at = now(); END LOOP; END IF; FOREACH dist_item IN ARRAY item.distribucion LOOP IF dist_item.cantidad > 0 THEN DECLARE stock_sucursal_anterior numeric; BEGIN SELECT cantidad INTO stock_sucursal_anterior FROM public.inventarios WHERE producto_id = item.producto_id AND sucursal_id = dist_item.sucursal_id; stock_sucursal_anterior := COALESCE(stock_sucursal_anterior, 0); INSERT INTO public.inventarios (producto_id, sucursal_id, cantidad) VALUES (item.producto_id, dist_item.sucursal_id, stock_sucursal_anterior + dist_item.cantidad) ON CONFLICT (producto_id, sucursal_id) DO UPDATE SET cantidad = public.inventarios.cantidad + dist_item.cantidad, updated_at = now(); INSERT INTO public.movimientos_inventario (producto_id, sucursal_id, usuario_id, tipo_movimiento, cantidad_ajustada, stock_anterior, stock_nuevo, referencia_id) VALUES (item.producto_id, dist_item.sucursal_id, caller_user_id, 'Compra', dist_item.cantidad, stock_sucursal_anterior, stock_sucursal_anterior + dist_item.cantidad, new_compra_id); END; END IF; END LOOP; END LOOP;
    IF p_compra.tipo_pago = 'Contado' THEN INSERT INTO public.pagos_compras (compra_id, monto, metodo_pago) VALUES (new_compra_id, total_compra, 'Contado'); ELSIF p_compra.tipo_pago = 'Crédito' AND COALESCE(p_compra.abono_inicial, 0) > 0 THEN INSERT INTO public.pagos_compras (compra_id, monto, metodo_pago) VALUES (new_compra_id, p_compra.abono_inicial, COALESCE(p_compra.metodo_abono, 'Abono Inicial')); END IF;

    SELECT nombre INTO v_proveedor_nombre FROM proveedores WHERE id = p_compra.proveedor_id;
    SELECT nombre INTO v_sucursal_nombre FROM sucursales WHERE id = p_compra.sucursal_id;
    PERFORM notificar_cambio('NUEVA_COMPRA', 'Compra <b>' || v_folio || '</b> a ' || v_proveedor_nombre || ' por <b>' || p_compra.moneda || ' ' || to_char(total_compra, 'FM999G999D00') || '</b> en <b>' || v_sucursal_nombre || '</b>', new_compra_id, ARRAY[p_compra.sucursal_id]);
    
    RETURN new_compra_id;
END;
$$;

-- registrar_traspaso (notifica a ambas sucursales)
CREATE OR REPLACE FUNCTION registrar_traspaso(p_origen_id uuid, p_destino_id uuid, p_fecha timestamptz, p_notas text, p_items traspaso_item_input[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    new_traspaso_id uuid; v_folio text; v_origen_nombre text; v_destino_nombre text;
    caller_empresa_id uuid := public.get_empresa_id_from_jwt(); caller_user_id uuid := auth.uid();
    caller_rol text := (SELECT u.rol FROM public.usuarios u WHERE u.id = caller_user_id);
    item traspaso_item_input; next_folio_number integer; stock_origen_actual numeric;
BEGIN
    -- (lógica de negocio original)
    IF caller_rol NOT IN ('Propietario', 'Administrador') THEN RAISE EXCEPTION 'Acceso denegado.'; END IF;
    SELECT COALESCE(MAX(substring(folio from 7)::integer), 0) + 1 INTO next_folio_number FROM public.traspasos WHERE empresa_id = caller_empresa_id;
    v_folio := 'TRASP-' || lpad(next_folio_number::text, 5, '0');
    INSERT INTO public.traspasos (empresa_id, sucursal_origen_id, sucursal_destino_id, usuario_envio_id, folio, fecha, notas, estado, fecha_envio)
    VALUES (caller_empresa_id, p_origen_id, p_destino_id, caller_user_id, v_folio, p_fecha, p_notas, 'En Camino', now()) RETURNING id INTO new_traspaso_id;
    FOREACH item IN ARRAY p_items LOOP SELECT cantidad INTO stock_origen_actual FROM inventarios WHERE producto_id = item.producto_id AND sucursal_id = p_origen_id; stock_origen_actual := COALESCE(stock_origen_actual, 0); IF stock_origen_actual < item.cantidad THEN RAISE EXCEPTION 'Stock insuficiente.'; END IF; INSERT INTO public.traspaso_items (traspaso_id, producto_id, cantidad) VALUES (new_traspaso_id, item.producto_id, item.cantidad); UPDATE public.inventarios SET cantidad = cantidad - item.cantidad, updated_at = now() WHERE producto_id = item.producto_id AND sucursal_id = p_origen_id; INSERT INTO public.movimientos_inventario (producto_id, sucursal_id, usuario_id, tipo_movimiento, cantidad_ajustada, stock_anterior, stock_nuevo, referencia_id) VALUES (item.producto_id, p_origen_id, caller_user_id, 'Salida por Traspaso', -item.cantidad, stock_origen_actual, stock_origen_actual - item.cantidad, new_traspaso_id); END LOOP;
    
    SELECT nombre INTO v_origen_nombre FROM sucursales WHERE id = p_origen_id;
    SELECT nombre INTO v_destino_nombre FROM sucursales WHERE id = p_destino_id;
    PERFORM notificar_cambio('TRASPASO_ENVIADO', 'Traspaso <b>' || v_folio || '</b> enviado desde ' || v_origen_nombre || ' hacia <b>' || v_destino_nombre || '</b>.', new_traspaso_id, ARRAY[p_origen_id, p_destino_id]);
    
    RETURN new_traspaso_id;
END;
$$;

-- confirmar_recepcion_traspaso (notifica a ambas sucursales)
CREATE OR REPLACE FUNCTION confirmar_recepcion_traspaso(p_traspaso_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    traspaso_rec record; v_origen_nombre text; v_destino_nombre text;
    caller_user_id uuid := auth.uid(); caller_sucursal_id uuid := (SELECT u.sucursal_id FROM public.usuarios u WHERE u.id = caller_user_id);
    item_rec record; stock_destino_actual numeric;
BEGIN
    -- (lógica de negocio original)
    SELECT * INTO traspaso_rec FROM public.traspasos WHERE id = p_traspaso_id;
    IF traspaso_rec IS NULL THEN RAISE EXCEPTION 'Traspaso no encontrado.'; END IF;
    IF traspaso_rec.sucursal_destino_id != caller_sucursal_id THEN RAISE EXCEPTION 'Acceso denegado.'; END IF;
    IF traspaso_rec.estado != 'En Camino' THEN RAISE EXCEPTION 'Este traspaso no está "En Camino".'; END IF;
    UPDATE public.traspasos SET estado = 'Recibido', usuario_recibio_id = caller_user_id, fecha_recibido = now() WHERE id = p_traspaso_id;
    FOR item_rec IN SELECT * FROM public.traspaso_items WHERE traspaso_id = p_traspaso_id LOOP SELECT cantidad INTO stock_destino_actual FROM inventarios WHERE producto_id = item_rec.producto_id AND sucursal_id = traspaso_rec.sucursal_destino_id; stock_destino_actual := COALESCE(stock_destino_actual, 0); INSERT INTO public.inventarios (producto_id, sucursal_id, cantidad) VALUES (item_rec.producto_id, traspaso_rec.sucursal_destino_id, item_rec.cantidad) ON CONFLICT (producto_id, sucursal_id) DO UPDATE SET cantidad = inventarios.cantidad + item_rec.cantidad, updated_at = now(); INSERT INTO public.movimientos_inventario (producto_id, sucursal_id, usuario_id, tipo_movimiento, cantidad_ajustada, stock_anterior, stock_nuevo, referencia_id) VALUES (item_rec.producto_id, traspaso_rec.sucursal_destino_id, caller_user_id, 'Entrada por Traspaso', item_rec.cantidad, stock_destino_actual, stock_destino_actual + item_rec.cantidad, p_traspaso_id); END LOOP;
    
    SELECT nombre INTO v_origen_nombre FROM sucursales WHERE id = traspaso_rec.sucursal_origen_id;
    SELECT nombre INTO v_destino_nombre FROM sucursales WHERE id = traspaso_rec.sucursal_destino_id;
    PERFORM notificar_cambio('TRASPASO_RECIBIDO', 'El traspaso <b>' || traspaso_rec.folio || '</b> desde ' || v_origen_nombre || ' ha sido <b>recibido</b> en ' || v_destino_nombre || '.', p_traspaso_id, ARRAY[traspaso_rec.sucursal_origen_id, traspaso_rec.sucursal_destino_id]);
END;
$$;
-- =============================================================================
-- Fin del script.
-- =============================================================================