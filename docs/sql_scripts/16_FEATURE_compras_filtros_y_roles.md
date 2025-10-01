-- =============================================================================
-- DATABASE ENHANCEMENT SCRIPT: FILTERS FOR PURCHASES & ROLE-BASED SECURITY (v2 - Ambiguity Fix)
-- =============================================================================
-- Este script introduce dos mejoras y una corrección crítica:
-- 1. (FIX) Resuelve un error de "columna ambigua" al calificar explícitamente la
--    columna `sucursal_id` en la consulta inicial de perfil de usuario.
-- 2. Implementa la lógica de seguridad basada en roles en las funciones de la
--    base de datos, asegurando que los Administradores y Empleados solo vean
--    los datos de su propia sucursal.
-- 3. Añade una nueva función para obtener eficientemente los datos necesarios
--    para los nuevos filtros del módulo de Compras.
--
-- **INSTRUCCIONES:**
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Actualizar `get_company_purchases` con lógica de roles y corrección de ambigüedad
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_company_purchases();
CREATE OR REPLACE FUNCTION get_company_purchases()
RETURNS TABLE (
    id uuid,
    folio text,
    proveedor_id uuid,
    proveedor_nombre text,
    usuario_id uuid,
    usuario_nombre text,
    sucursal_id uuid,
    sucursal_nombre text,
    fecha date,
    total numeric,
    moneda text,
    total_bob numeric,
    estado_pago text,
    saldo_pendiente numeric,
    tipo_pago text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_rol text;
    caller_sucursal_id uuid;
    caller_empresa_id uuid;
BEGIN
    -- FIX: Usar el alias de tabla 'u' para resolver la ambigüedad con la columna de salida 'sucursal_id'.
    SELECT u.rol, u.sucursal_id, u.empresa_id INTO caller_rol, caller_sucursal_id, caller_empresa_id
    FROM public.usuarios u WHERE u.id = auth.uid();

    IF caller_rol = 'Propietario' THEN
        RETURN QUERY
        SELECT c.id, c.folio, c.proveedor_id, p.nombre, u.id, u.nombre_completo, s.id, s.nombre, c.fecha, c.total, c.moneda, c.total_bob, c.estado_pago, c.saldo_pendiente, c.tipo_pago
        FROM public.compras c
        JOIN public.proveedores p ON c.proveedor_id = p.id
        LEFT JOIN public.usuarios u ON c.usuario_id = u.id
        LEFT JOIN public.sucursales s ON c.sucursal_id = s.id
        WHERE c.empresa_id = caller_empresa_id
        ORDER BY c.created_at DESC;
    ELSE -- Administrador
        RETURN QUERY
        SELECT c.id, c.folio, c.proveedor_id, p.nombre, u.id, u.nombre_completo, s.id, s.nombre, c.fecha, c.total, c.moneda, c.total_bob, c.estado_pago, c.saldo_pendiente, c.tipo_pago
        FROM public.compras c
        JOIN public.proveedores p ON c.proveedor_id = p.id
        LEFT JOIN public.usuarios u ON c.usuario_id = u.id
        LEFT JOIN public.sucursales s ON c.sucursal_id = s.id
        WHERE c.sucursal_id = caller_sucursal_id
        ORDER BY c.created_at DESC;
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Paso 2: Actualizar `get_company_sales` con lógica de roles y corrección de ambigüedad
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_company_sales();
CREATE OR REPLACE FUNCTION get_company_sales()
RETURNS TABLE (
    id uuid,
    folio text,
    cliente_id uuid,
    cliente_nombre text,
    usuario_id uuid,
    usuario_nombre text,
    sucursal_id uuid,
    sucursal_nombre text,
    fecha timestamptz,
    total numeric,
    estado_pago text,
    saldo_pendiente numeric,
    tipo_venta text,
    metodo_pago text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_rol text;
    caller_sucursal_id uuid;
    caller_empresa_id uuid;
BEGIN
    -- FIX: Usar el alias de tabla 'u' para resolver la ambigüedad con la columna de salida 'sucursal_id'.
    SELECT u.rol, u.sucursal_id, u.empresa_id INTO caller_rol, caller_sucursal_id, caller_empresa_id
    FROM public.usuarios u WHERE u.id = auth.uid();

    IF caller_rol = 'Propietario' THEN
        RETURN QUERY
        SELECT v.id, v.folio, v.cliente_id, c.nombre, v.usuario_id, u.nombre_completo, v.sucursal_id, s.nombre, v.fecha, v.total, v.estado_pago, v.saldo_pendiente, v.tipo_venta, v.metodo_pago
        FROM public.ventas v
        LEFT JOIN public.clientes c ON v.cliente_id = c.id
        LEFT JOIN public.usuarios u ON v.usuario_id = u.id
        LEFT JOIN public.sucursales s ON v.sucursal_id = s.id
        WHERE v.empresa_id = caller_empresa_id
        ORDER BY v.created_at DESC;
    ELSE -- Administrador o Empleado
        RETURN QUERY
        SELECT v.id, v.folio, v.cliente_id, c.nombre, v.usuario_id, u.nombre_completo, v.sucursal_id, s.nombre, v.fecha, v.total, v.estado_pago, v.saldo_pendiente, v.tipo_venta, v.metodo_pago
        FROM public.ventas v
        LEFT JOIN public.clientes c ON v.cliente_id = c.id
        LEFT JOIN public.usuarios u ON v.usuario_id = u.id
        LEFT JOIN public.sucursales s ON v.sucursal_id = s.id
        WHERE v.sucursal_id = caller_sucursal_id
        ORDER BY v.created_at DESC;
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Paso 3: Nueva función para obtener datos para los filtros de compras
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_purchases_filter_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid());
    providers_list json;
    users_list json;
    branches_list json;
BEGIN
    SELECT json_agg(p) INTO providers_list FROM (
        SELECT id, nombre FROM public.proveedores WHERE empresa_id = caller_empresa_id ORDER BY nombre
    ) p;

    SELECT json_agg(u) INTO users_list FROM (
        SELECT id, nombre_completo FROM public.usuarios WHERE empresa_id = caller_empresa_id ORDER BY nombre_completo
    ) u;
    
    SELECT json_agg(s) INTO branches_list FROM (
        SELECT id, nombre FROM public.sucursales WHERE empresa_id = caller_empresa_id ORDER BY nombre
    ) s;

    RETURN json_build_object(
        'providers', COALESCE(providers_list, '[]'::json),
        'users', COALESCE(users_list, '[]'::json),
        'branches', COALESCE(branches_list, '[]'::json)
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- Paso 4: Añadir columna `usuario_id` a la tabla `compras`
-- -----------------------------------------------------------------------------
-- Es necesario para saber quién registró la compra.
ALTER TABLE public.compras
ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL;


-- -----------------------------------------------------------------------------
-- Paso 5: Actualizar `registrar_compra` para guardar el `usuario_id`
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.registrar_compra(compra_input, compra_item_input[]);
CREATE OR REPLACE FUNCTION registrar_compra(p_compra compra_input, p_items compra_item_input[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid());
    caller_user_id uuid := auth.uid();
    new_compra_id uuid;
    item compra_item_input;
    price_rule price_rule_input;
    total_compra numeric := 0;
    total_compra_bob numeric;
    saldo_final numeric;
    estado_final text;
    stock_total_actual numeric;
    capp_actual numeric;
    nuevo_capp numeric;
    costo_unitario_bob numeric;
    new_price numeric;
    next_folio_number integer;
BEGIN
    -- ... (cálculos de total y saldo sin cambios) ...
    FOREACH item IN ARRAY p_items LOOP total_compra := total_compra + (item.cantidad * item.costo_unitario); END LOOP;
    total_compra_bob := CASE WHEN p_compra.moneda = 'USD' THEN total_compra * p_compra.tasa_cambio ELSE total_compra END;
    IF p_compra.tipo_pago = 'Contado' THEN saldo_final := 0; estado_final := 'Pagada';
    ELSE saldo_final := total_compra - COALESCE(p_compra.abono_inicial, 0);
        IF saldo_final <= 0.005 THEN estado_final := 'Pagada'; saldo_final := 0;
        ELSIF COALESCE(p_compra.abono_inicial, 0) > 0 THEN estado_final := 'Abono Parcial';
        ELSE estado_final := 'Pendiente'; END IF;
    END IF;
    SELECT COALESCE(MAX(substring(folio from 6)::integer), 0) + 1 INTO next_folio_number FROM public.compras WHERE empresa_id = caller_empresa_id;

    -- Insertar la cabecera de la compra, AÑADIENDO el usuario_id
    INSERT INTO public.compras (
        empresa_id, sucursal_id, proveedor_id, usuario_id, folio, fecha, moneda, tasa_cambio, total, total_bob,
        tipo_pago, estado_pago, saldo_pendiente, n_factura, fecha_vencimiento
    ) VALUES (
        caller_empresa_id, p_compra.sucursal_id, p_compra.proveedor_id, caller_user_id,
        'COMP-' || lpad(next_folio_number::text, 5, '0'), p_compra.fecha, p_compra.moneda, p_compra.tasa_cambio, total_compra, total_compra_bob,
        p_compra.tipo_pago, estado_final, saldo_final, p_compra.n_factura, p_compra.fecha_vencimiento
    ) RETURNING id INTO new_compra_id;

    -- ... (lógica de procesamiento de items sin cambios) ...
    FOREACH item IN ARRAY p_items LOOP
        INSERT INTO public.compra_items (compra_id, producto_id, cantidad, costo_unitario) VALUES (new_compra_id, item.producto_id, item.cantidad, item.costo_unitario);
        costo_unitario_bob := CASE WHEN p_compra.moneda = 'USD' THEN item.costo_unitario * p_compra.tasa_cambio ELSE item.costo_unitario END;
        SELECT COALESCE(SUM(i.cantidad), 0), p.precio_compra INTO stock_total_actual, capp_actual FROM public.productos p LEFT JOIN public.inventarios i ON p.id = i.producto_id WHERE p.id = item.producto_id GROUP BY p.id;
        capp_actual := COALESCE(capp_actual, 0);
        IF (stock_total_actual + item.cantidad) > 0 THEN nuevo_capp := ((stock_total_actual * capp_actual) + (item.cantidad * costo_unitario_bob)) / (stock_total_actual + item.cantidad); ELSE nuevo_capp := costo_unitario_bob; END IF;
        UPDATE public.productos SET precio_compra = nuevo_capp WHERE id = item.producto_id;
        IF item.precios IS NOT NULL AND array_length(item.precios, 1) > 0 THEN FOREACH price_rule IN ARRAY item.precios LOOP new_price := nuevo_capp + price_rule.ganancia_maxima; INSERT INTO public.precios_productos(producto_id, lista_precio_id, ganancia_maxima, ganancia_minima, precio) VALUES(item.producto_id, price_rule.lista_id, price_rule.ganancia_maxima, price_rule.ganancia_minima, new_price) ON CONFLICT (producto_id, lista_precio_id) DO UPDATE SET ganancia_maxima = EXCLUDED.ganancia_maxima, ganancia_minima = EXCLUDED.ganancia_minima, precio = EXCLUDED.precio, updated_at = now(); END LOOP; END IF;
        DECLARE stock_sucursal_anterior numeric; BEGIN SELECT cantidad INTO stock_sucursal_anterior FROM public.inventarios WHERE producto_id = item.producto_id AND sucursal_id = p_compra.sucursal_id; stock_sucursal_anterior := COALESCE(stock_sucursal_anterior, 0); INSERT INTO public.inventarios (producto_id, sucursal_id, cantidad) VALUES (item.producto_id, p_compra.sucursal_id, stock_sucursal_anterior + item.cantidad) ON CONFLICT (producto_id, sucursal_id) DO UPDATE SET cantidad = public.inventarios.cantidad + item.cantidad, updated_at = now(); INSERT INTO public.movimientos_inventario (producto_id, sucursal_id, usuario_id, tipo_movimiento, cantidad_ajustada, stock_anterior, stock_nuevo, referencia_id) VALUES (item.producto_id, p_compra.sucursal_id, caller_user_id, 'Compra', item.cantidad, stock_sucursal_anterior, stock_sucursal_anterior + item.cantidad, new_compra_id); END;
    END LOOP;

    -- ... (lógica de registro de pago sin cambios) ...
    IF p_compra.tipo_pago = 'Contado' THEN INSERT INTO public.pagos_compras (compra_id, monto, metodo_pago) VALUES (new_compra_id, total_compra, 'Contado'); ELSIF p_compra.tipo_pago = 'Crédito' AND COALESCE(p_compra.abono_inicial, 0) > 0 THEN INSERT INTO public.pagos_compras (compra_id, monto, metodo_pago) VALUES (new_compra_id, p_compra.abono_inicial, COALESCE(p_compra.metodo_abono, 'Abono Inicial')); END IF;

    RETURN new_compra_id;
END;
$$;


-- =============================================================================
-- Fin del script.
-- =============================================================================