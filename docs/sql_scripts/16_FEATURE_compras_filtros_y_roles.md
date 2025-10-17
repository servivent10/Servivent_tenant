-- =============================================================================
-- DATABASE ENHANCEMENT SCRIPT: FILTERS FOR PURCHASES & ROLE-BASED SECURITY (V6 - Definitive Fix)
-- =============================================================================
-- This script provides the definitive fix for role-based security in the
-- purchases module, resolving any potential column ambiguity.
--
-- PROBLEM SOLVED:
-- A subtle bug can occur where a column name in the function's scope (like an
-- output parameter `sucursal_id`) conflicts with a column being selected from
-- a table, causing filters to fail silently.
--
-- SOLUTION:
-- The `get_company_purchases` function has been rewritten to be more explicit.
-- The initial query to fetch the user's role and branch now uses a table alias (`u`)
-- to ensure there is no ambiguity. This guarantees the `v_caller_sucursal_id`
-- variable is always correctly populated, making the filter for the 'Administrador'
-- role robust and reliable.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Update `get_company_purchases` with the definitive role logic
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
    fecha timestamptz,
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
    v_caller_rol text;
    v_caller_sucursal_id uuid;
    v_empresa_id uuid := public.get_empresa_id_from_jwt();
BEGIN
    -- **DEFINITIVE FIX**: Use table alias `u` to prevent any ambiguity with
    -- the function's output columns (like `sucursal_id`).
    SELECT u.rol, u.sucursal_id INTO v_caller_rol, v_caller_sucursal_id
    FROM public.usuarios u WHERE u.id = auth.uid();

    IF v_caller_rol = 'Propietario' THEN
        -- Owner sees all purchases in the company
        RETURN QUERY
        SELECT c.id, c.folio, c.proveedor_id, p.nombre, u.id, u.nombre_completo, s.id, s.nombre, c.fecha, c.total, c.moneda, c.total_bob, c.estado_pago, c.saldo_pendiente, c.tipo_pago
        FROM public.compras c
        JOIN public.proveedores p ON c.proveedor_id = p.id
        LEFT JOIN public.usuarios u ON c.usuario_id = u.id
        LEFT JOIN public.sucursales s ON c.sucursal_id = s.id
        WHERE c.empresa_id = v_empresa_id
        ORDER BY c.created_at DESC;
    ELSIF v_caller_rol = 'Administrador' THEN
        -- Administrator sees only purchases from their own branch
        RETURN QUERY
        SELECT c.id, c.folio, c.proveedor_id, p.nombre, u.id, u.nombre_completo, s.id, s.nombre, c.fecha, c.total, c.moneda, c.total_bob, c.estado_pago, c.saldo_pendiente, c.tipo_pago
        FROM public.compras c
        JOIN public.proveedores p ON c.proveedor_id = p.id
        LEFT JOIN public.usuarios u ON c.usuario_id = u.id
        LEFT JOIN public.sucursales s ON c.sucursal_id = s.id
        WHERE c.empresa_id = v_empresa_id AND c.sucursal_id = v_caller_sucursal_id
        ORDER BY c.created_at DESC;
    ELSE
        -- For any other role (like Empleado), return an empty set as a security measure.
        RETURN;
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 2: Update `get_company_sales` with logic for roles, ambiguity fix, and web orders
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
    metodo_pago text,
    impuestos numeric
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
    SELECT u.rol, u.sucursal_id, u.empresa_id INTO caller_rol, caller_sucursal_id, caller_empresa_id
    FROM public.usuarios u WHERE u.id = auth.uid();

    IF caller_rol = 'Propietario' THEN
        RETURN QUERY
        SELECT v.id, v.folio, v.cliente_id, c.nombre, v.usuario_id, u.nombre_completo, v.sucursal_id, s.nombre, v.fecha, v.total, v.estado_pago, v.saldo_pendiente, v.tipo_venta, v.metodo_pago, v.impuestos
        FROM public.ventas v
        LEFT JOIN public.clientes c ON v.cliente_id = c.id
        LEFT JOIN public.usuarios u ON v.usuario_id = u.id
        LEFT JOIN public.sucursales s ON v.sucursal_id = s.id
        WHERE v.empresa_id = caller_empresa_id
        ORDER BY v.created_at DESC;
    ELSE -- Administrador o Empleado
        RETURN QUERY
        SELECT v.id, v.folio, v.cliente_id, c.nombre, v.usuario_id, u.nombre_completo, v.sucursal_id, s.nombre, v.fecha, v.total, v.estado_pago, v.saldo_pendiente, v.tipo_venta, v.metodo_pago, v.impuestos
        FROM public.ventas v
        LEFT JOIN public.clientes c ON v.cliente_id = c.id
        LEFT JOIN public.usuarios u ON v.usuario_id = u.id
        LEFT JOIN public.sucursales s ON v.sucursal_id = s.id
        WHERE v.empresa_id = caller_empresa_id AND (
            v.sucursal_id = caller_sucursal_id 
            OR (v.estado_pago = 'Pedido Web Pendiente' AND v.sucursal_id IS NULL) -- Allow viewing home delivery web orders
        )
        ORDER BY v.created_at DESC;
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 3: New function to get data for purchase filters
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
-- Step 4: Add `usuario_id` column to the `compras` table
-- -----------------------------------------------------------------------------
ALTER TABLE public.compras
ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL;


-- -----------------------------------------------------------------------------
-- Step 5: Update `registrar_compra` to save the `usuario_id`
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
    cantidad_total_item numeric;
BEGIN
    FOREACH item IN ARRAY p_items LOOP
        cantidad_total_item := (SELECT SUM(d.cantidad) FROM unnest(item.distribucion) d);
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

    INSERT INTO public.compras (
        empresa_id, sucursal_id, proveedor_id, usuario_id, folio, fecha, moneda, tasa_cambio, total, total_bob,
        tipo_pago, estado_pago, saldo_pendiente, n_factura, fecha_vencimiento
    ) VALUES (
        caller_empresa_id, p_compra.sucursal_id, p_compra.proveedor_id, caller_user_id,
        'COMP-' || lpad(next_folio_number::text, 5, '0'), p_compra.fecha, p_compra.moneda, p_compra.tasa_cambio, total_compra, total_compra_bob,
        p_compra.tipo_pago, estado_final, saldo_final, p_compra.n_factura, p_compra.fecha_vencimiento
    ) RETURNING id INTO new_compra_id;

    FOREACH item IN ARRAY p_items LOOP
        cantidad_total_item := (SELECT SUM(d.cantidad) FROM unnest(item.distribucion) d);
        INSERT INTO public.compra_items (compra_id, producto_id, cantidad, costo_unitario) VALUES (new_compra_id, item.producto_id, cantidad_total_item, item.costo_unitario);
        costo_unitario_bob := CASE WHEN p_compra.moneda = 'USD' THEN item.costo_unitario * p_compra.tasa_cambio ELSE item.costo_unitario END;
        SELECT COALESCE(SUM(i.cantidad), 0), p.precio_compra INTO stock_total_actual, capp_actual FROM public.productos p LEFT JOIN public.inventarios i ON p.id = i.producto_id WHERE p.id = item.producto_id GROUP BY p.id;
        capp_actual := COALESCE(capp_actual, 0);
        IF (stock_total_actual + cantidad_total_item) > 0 THEN nuevo_capp := ((stock_total_actual * capp_actual) + (cantidad_total_item * costo_unitario_bob)) / (stock_total_actual + cantidad_total_item); ELSE nuevo_capp := costo_unitario_bob; END IF;
        UPDATE public.productos SET precio_compra = nuevo_capp WHERE id = item.producto_id;
        IF item.precios IS NOT NULL AND array_length(item.precios, 1) > 0 THEN FOREACH price_rule IN ARRAY item.precios LOOP new_price := nuevo_capp + price_rule.ganancia_maxima; INSERT INTO public.precios_productos(producto_id, lista_precio_id, ganancia_maxima, ganancia_minima, precio) VALUES(item.producto_id, price_rule.lista_id, price_rule.ganancia_maxima, price_rule.ganancia_minima, new_price) ON CONFLICT (producto_id, lista_precio_id) DO UPDATE SET ganancia_maxima = EXCLUDED.ganancia_maxima, ganancia_minima = EXCLUDED.ganancia_minima, precio = EXCLUDED.precio, updated_at = now(); END LOOP; END IF;
        DECLARE dist_item distribucion_item_input; stock_sucursal_anterior numeric;
        BEGIN
            FOREACH dist_item IN ARRAY item.distribucion LOOP
                IF dist_item.cantidad > 0 THEN
                    SELECT cantidad INTO stock_sucursal_anterior FROM public.inventarios WHERE producto_id = item.producto_id AND sucursal_id = dist_item.sucursal_id;
                    stock_sucursal_anterior := COALESCE(stock_sucursal_anterior, 0);
                    INSERT INTO public.inventarios (producto_id, sucursal_id, cantidad) VALUES (item.producto_id, dist_item.sucursal_id, stock_sucursal_anterior + dist_item.cantidad) ON CONFLICT (producto_id, sucursal_id) DO UPDATE SET cantidad = public.inventarios.cantidad + dist_item.cantidad, updated_at = now();
                    INSERT INTO public.movimientos_inventario (producto_id, sucursal_id, usuario_id, tipo_movimiento, cantidad_ajustada, stock_anterior, stock_nuevo, referencia_id) VALUES (item.producto_id, dist_item.sucursal_id, caller_user_id, 'Compra', dist_item.cantidad, stock_sucursal_anterior, stock_sucursal_anterior + dist_item.cantidad, new_compra_id);
                END IF;
            END LOOP;
        END;
    END LOOP;

    IF p_compra.tipo_pago = 'Contado' THEN INSERT INTO public.pagos_compras (compra_id, monto, metodo_pago) VALUES (new_compra_id, total_compra, 'Contado'); ELSIF p_compra.tipo_pago = 'Crédito' AND COALESCE(p_compra.abono_inicial, 0) > 0 THEN INSERT INTO public.pagos_compras (compra_id, monto, metodo_pago) VALUES (new_compra_id, p_compra.abono_inicial, COALESCE(p_compra.metodo_abono, 'Abono Inicial')); END IF;

    RETURN new_compra_id;
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================