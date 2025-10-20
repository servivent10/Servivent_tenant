

-- =============================================================================
-- DUE DATE MANAGEMENT FOR CREDIT SALES - DATABASE SETUP (V1)
-- =============================================================================
-- This script implements the backend infrastructure for the new due date
-- management feature for credit sales.
--
-- WHAT IT DOES:
-- 1. Updates `get_company_sales`: Adds `estado_vencimiento` and `dias_diferencia`
--    to provide context about due dates in the sales list.
-- 2. Updates `get_sale_details`: Adds the same context to the sale detail view.
-- 3. Updates `get_dashboard_data`: Adds new KPIs for `cuentas_por_cobrar` (accounts
--    receivable) and `cuentas_vencidas` (overdue accounts) for a better
--    financial overview.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Update `get_company_sales` to include due date status
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
    impuestos numeric,
    estado_vencimiento text,
    dias_diferencia integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_rol text;
    caller_sucursal_id uuid;
    caller_empresa_id uuid;
    v_company_timezone text;
BEGIN
    SELECT u.rol, u.sucursal_id, u.empresa_id, e.timezone 
    INTO caller_rol, caller_sucursal_id, caller_empresa_id, v_company_timezone
    FROM public.usuarios u
    JOIN public.empresas e on u.empresa_id = e.id
    WHERE u.id = auth.uid();

    IF caller_rol IS NULL THEN
        RETURN;
    END IF;
    
    IF v_company_timezone IS NULL THEN
        v_company_timezone := 'UTC'; -- Fallback
    END IF;
    
    RETURN QUERY
    SELECT 
        v.id, v.folio, v.cliente_id, c.nombre, v.usuario_id, u.nombre_completo, v.sucursal_id, s.nombre, v.fecha, v.total, v.estado_pago, v.saldo_pendiente, v.tipo_venta, v.metodo_pago, v.impuestos,
        CASE
            WHEN v.estado_pago = 'Pagada' THEN 'Pagada'
            WHEN v.tipo_venta = 'Contado' THEN 'Pagada'
            WHEN v.fecha_vencimiento IS NULL THEN 'N/A'
            WHEN v.fecha_vencimiento < (now() AT TIME ZONE v_company_timezone)::date THEN 'Vencida'
            ELSE 'Al día'
        END AS estado_vencimiento,
        CASE
            WHEN v.tipo_venta = 'Crédito' AND v.fecha_vencimiento IS NOT NULL THEN (v.fecha_vencimiento - (now() AT TIME ZONE v_company_timezone)::date)
            ELSE NULL
        END AS dias_diferencia
    FROM public.ventas v
    LEFT JOIN public.clientes c ON v.cliente_id = c.id
    LEFT JOIN public.usuarios u ON v.usuario_id = u.id
    LEFT JOIN public.sucursales s ON v.sucursal_id = s.id
    WHERE v.empresa_id = caller_empresa_id
      AND (
        caller_rol = 'Propietario' OR
        v.sucursal_id = caller_sucursal_id OR
        (v.estado_pago = 'Pedido Web Pendiente' AND v.sucursal_id IS NULL)
      )
    ORDER BY v.created_at DESC;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 2: Update `get_sale_details` to include due date status
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_sale_details(p_venta_id uuid);
CREATE OR REPLACE FUNCTION get_sale_details(p_venta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sale_details jsonb;
    items_list json;
    payments_list json;
    address_data json;
    v_company_timezone text;
BEGIN
    SELECT e.timezone INTO v_company_timezone
    FROM public.empresas e
    WHERE e.id = public.get_empresa_id_from_jwt();
    
    IF v_company_timezone IS NULL THEN
        v_company_timezone := 'UTC'; -- Fallback
    END IF;

    SELECT to_jsonb(v) || jsonb_build_object(
        'cliente_nombre', c.nombre,
        'cliente_nit_ci', c.nit_ci,
        'cliente_telefono', c.telefono,
        'usuario_nombre', u.nombre_completo,
        'sucursal_nombre', s.nombre,
        'sucursal_direccion', s.direccion,
        'sucursal_telefono', s.telefono,
        'estado_vencimiento', CASE
            WHEN v.estado_pago = 'Pagada' THEN 'Pagada'
            WHEN v.tipo_venta = 'Contado' THEN 'Pagada'
            WHEN v.fecha_vencimiento IS NULL THEN 'N/A'
            WHEN v.fecha_vencimiento < (now() AT TIME ZONE v_company_timezone)::date THEN 'Vencida'
            ELSE 'Al día'
        END,
        'dias_diferencia', CASE
            WHEN v.tipo_venta = 'Crédito' AND v.fecha_vencimiento IS NOT NULL THEN (v.fecha_vencimiento - (now() AT TIME ZONE v_company_timezone)::date)
            ELSE NULL
        END
    ) 
    INTO sale_details
    FROM public.ventas v
    LEFT JOIN public.clientes c ON v.cliente_id = c.id
    LEFT JOIN public.usuarios u ON v.usuario_id = u.id
    LEFT JOIN public.sucursales s ON v.sucursal_id = s.id
    WHERE v.id = p_venta_id
    AND v.empresa_id = (SELECT usr.empresa_id FROM public.usuarios usr WHERE usr.id = auth.uid());

    IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada o no pertenece a tu empresa.'; END IF;
    
    SELECT json_agg(i) INTO items_list FROM (SELECT vi.*, p.nombre as producto_nombre FROM public.venta_items vi JOIN public.productos p ON vi.producto_id = p.id WHERE vi.venta_id = p_venta_id) i;
    SELECT json_agg(p) INTO payments_list FROM (SELECT * FROM public.pagos_ventas WHERE venta_id = p_venta_id ORDER BY fecha_pago) p;
    SELECT to_json(da) INTO address_data FROM public.direcciones_clientes da WHERE da.id = (sale_details->>'direccion_entrega_id')::uuid;

    RETURN sale_details || jsonb_build_object(
        'items', COALESCE(items_list, '[]'::json),
        'pagos', COALESCE(payments_list, '[]'::json),
        'direccion_entrega', address_data
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 3: Update `get_dashboard_data` to include new financial KPIs (FULL VERSION)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_dashboard_data(date, date, text, uuid);
CREATE OR REPLACE FUNCTION get_dashboard_data(
    p_start_date date,
    p_end_date date,
    p_timezone text,
    p_sucursal_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid; caller_rol text; caller_sucursal_id uuid; effective_sucursal_id uuid;
    v_start_utc timestamptz := (p_start_date::timestamp AT TIME ZONE p_timezone);
    v_end_utc timestamptz := ((p_end_date + interval '1 day')::timestamp AT TIME ZONE p_timezone);
    v_period_days integer := p_end_date - p_start_date + 1;
    v_prev_start_utc timestamptz := v_start_utc - make_interval(days => v_period_days);
    v_prev_end_utc timestamptz := v_end_utc - make_interval(days => v_period_days);
    kpis jsonb; low_stock_products json; recent_activity json; chart_data json; all_branches json; top_selling_products json; top_customers json;
    v_total_sales numeric; v_gross_profit numeric; v_total_sales_count bigint; v_total_discounts numeric; v_discount_sales_count bigint;
    v_total_purchases numeric; v_total_purchases_count bigint; v_total_gastos numeric; v_total_gastos_count bigint;
    v_prev_total_sales numeric; v_prev_gross_profit numeric;
    v_cuentas_por_cobrar numeric; v_cuentas_por_cobrar_count bigint; v_cuentas_vencidas numeric; v_cuentas_vencidas_count bigint;
BEGIN
    SELECT u.empresa_id, u.rol, u.sucursal_id INTO caller_empresa_id, caller_rol, caller_sucursal_id FROM public.usuarios u WHERE u.id = auth.uid();
    IF caller_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario no encontrado.'; END IF;
    effective_sucursal_id := CASE WHEN caller_rol = 'Propietario' THEN p_sucursal_id ELSE caller_sucursal_id END;

    -- Calculate Sales & Profit KPIs
    WITH sales_with_profit_current AS (
        SELECT v.id, v.total, v.descuento, SUM(vi.cantidad * (vi.precio_unitario_aplicado - vi.costo_unitario_en_venta)) as item_profit
        FROM ventas v JOIN venta_items vi ON v.id = vi.venta_id
        WHERE v.empresa_id = caller_empresa_id AND v.fecha >= v_start_utc AND v.fecha < v_end_utc
          AND (effective_sucursal_id IS NULL OR v.sucursal_id = effective_sucursal_id)
          AND v.estado_pago != 'Pedido Web Pendiente'
        GROUP BY v.id
    ),
    sales_in_period AS (
        SELECT SUM(total) as total_sales, SUM(descuento) as total_discounts, COUNT(*) as sales_count,
               COUNT(*) FILTER (WHERE descuento > 0) as discount_sales_count, SUM(item_profit - descuento) as gross_profit
        FROM sales_with_profit_current
    ),
    sales_with_profit_previous AS (
        SELECT v.id, v.total, v.descuento, SUM(vi.cantidad * (vi.precio_unitario_aplicado - vi.costo_unitario_en_venta)) as item_profit
        FROM ventas v JOIN venta_items vi ON v.id = vi.venta_id
        WHERE v.empresa_id = caller_empresa_id AND v.fecha >= v_prev_start_utc AND v.fecha < v_prev_end_utc
          AND (effective_sucursal_id IS NULL OR v.sucursal_id = effective_sucursal_id)
          AND v.estado_pago != 'Pedido Web Pendiente'
        GROUP BY v.id
    ),
    sales_in_previous_period AS (
        SELECT SUM(total) as total_sales, SUM(item_profit - descuento) as gross_profit
        FROM sales_with_profit_previous
    )
    SELECT COALESCE(s_current.total_sales, 0), COALESCE(s_current.gross_profit, 0), COALESCE(s_current.sales_count, 0), COALESCE(s_current.total_discounts, 0), COALESCE(s_current.discount_sales_count, 0), COALESCE(s_prev.total_sales, 0), COALESCE(s_prev.gross_profit, 0)
    INTO v_total_sales, v_gross_profit, v_total_sales_count, v_total_discounts, v_discount_sales_count, v_prev_total_sales, v_prev_gross_profit
    FROM sales_in_period s_current, sales_in_previous_period s_prev;
    
    -- Calculate other KPIs
    SELECT COALESCE(SUM(total_bob), 0), COALESCE(COUNT(*), 0) INTO v_total_purchases, v_total_purchases_count FROM compras WHERE empresa_id = caller_empresa_id AND fecha >= v_start_utc AND fecha < v_end_utc AND (effective_sucursal_id IS NULL OR sucursal_id = effective_sucursal_id);
    SELECT COALESCE(SUM(monto), 0), COALESCE(COUNT(*), 0) INTO v_total_gastos, v_total_gastos_count FROM gastos WHERE empresa_id = caller_empresa_id AND fecha >= p_start_date AND fecha <= p_end_date AND (effective_sucursal_id IS NULL OR sucursal_id = effective_sucursal_id);

    -- **NEW**: Calculate Accounts Receivable KPIs (not date-filtered)
    SELECT COALESCE(SUM(saldo_pendiente), 0), COALESCE(COUNT(*), 0) INTO v_cuentas_por_cobrar, v_cuentas_por_cobrar_count FROM ventas WHERE empresa_id = caller_empresa_id AND estado_pago IN ('Pendiente', 'Abono Parcial') AND (effective_sucursal_id IS NULL OR sucursal_id = effective_sucursal_id);
    SELECT COALESCE(SUM(saldo_pendiente), 0), COALESCE(COUNT(*), 0) INTO v_cuentas_vencidas, v_cuentas_vencidas_count FROM ventas WHERE empresa_id = caller_empresa_id AND estado_pago IN ('Pendiente', 'Abono Parcial') AND fecha_vencimiento < (now() AT TIME ZONE p_timezone)::date AND (effective_sucursal_id IS NULL OR sucursal_id = effective_sucursal_id);

    SELECT jsonb_build_object(
        'total_sales', v_total_sales, 'total_sales_count', v_total_sales_count, 'sales_change_percentage', CASE WHEN v_prev_total_sales > 0 THEN round(((v_total_sales - v_prev_total_sales) / v_prev_total_sales) * 100, 2) ELSE CASE WHEN v_total_sales > 0 THEN 100 ELSE 0 END END,
        'gross_profit', v_gross_profit, 'profit_change_percentage', CASE WHEN v_prev_gross_profit <> 0 THEN round(((v_gross_profit - v_prev_gross_profit) / abs(v_prev_gross_profit)) * 100, 2) ELSE CASE WHEN v_gross_profit <> 0 THEN 100 ELSE 0 END END,
        'total_discounts', v_total_discounts, 'discount_sales_count', v_discount_sales_count,
        'total_purchases', v_total_purchases, 'total_purchases_count', v_total_purchases_count,
        'total_gastos', v_total_gastos, 'total_gastos_count', v_total_gastos_count,
        'cuentas_por_cobrar', v_cuentas_por_cobrar, 'cuentas_por_cobrar_count', v_cuentas_por_cobrar_count,
        'cuentas_vencidas', v_cuentas_vencidas, 'cuentas_vencidas_count', v_cuentas_vencidas_count
    ) INTO kpis;
    
    -- Low Stock Products
    SELECT json_agg(low_stock) INTO low_stock_products FROM (SELECT p.id, p.nombre, SUM(i.cantidad) as cantidad FROM inventarios i JOIN productos p ON i.producto_id = p.id WHERE p.empresa_id = caller_empresa_id AND (effective_sucursal_id IS NULL OR i.sucursal_id = effective_sucursal_id) GROUP BY p.id, p.nombre HAVING SUM(i.cantidad) <= SUM(COALESCE(i.stock_minimo, 0)) AND SUM(COALESCE(i.stock_minimo, 0)) > 0 ORDER BY SUM(i.cantidad) ASC LIMIT 5 ) AS low_stock;

    -- Recent Activity
    SELECT json_agg(activity) INTO recent_activity FROM ((SELECT 'venta' as type, 'Venta <b>' || v.folio || '</b> a ' || COALESCE(c.nombre, 'Consumidor Final') as description, v.total as amount, v.created_at as timestamp, NULL as estado FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id WHERE v.empresa_id = caller_empresa_id AND (effective_sucursal_id IS NULL OR v.sucursal_id = effective_sucursal_id OR v.sucursal_id IS NULL) ) UNION ALL (SELECT 'compra' as type, 'Compra <b>' || com.folio || '</b> a <b>' || p.nombre || '</b>' as description, com.total_bob as amount, com.created_at as timestamp, NULL as estado FROM compras com JOIN proveedores p ON com.proveedor_id = p.id WHERE com.empresa_id = caller_empresa_id AND (effective_sucursal_id IS NULL OR com.sucursal_id = effective_sucursal_id) ) UNION ALL (SELECT 'gasto' as type, 'Gasto: <b>' || g.concepto || '</b>' as description, g.monto as amount, g.created_at as timestamp, NULL as estado FROM gastos g WHERE g.empresa_id = caller_empresa_id AND (effective_sucursal_id IS NULL OR g.sucursal_id = effective_sucursal_id) ) UNION ALL (SELECT 'traspaso' as type, 'Traspaso <b>' || t.folio || '</b> de <b>' || s_origen.nombre || '</b> a <b>' || s_destino.nombre || '</b>' as description, NULL as amount, t.created_at as timestamp, t.estado FROM traspasos t JOIN sucursales s_origen ON t.sucursal_origen_id = s_origen.id JOIN sucursales s_destino ON t.sucursal_destino_id = s_destino.id WHERE t.empresa_id = caller_empresa_id AND (effective_sucursal_id IS NULL OR t.sucursal_origen_id = effective_sucursal_id OR t.sucursal_destino_id = effective_sucursal_id)) ORDER BY timestamp DESC LIMIT 5 ) as activity;

    -- Chart Data
    IF caller_rol = 'Propietario' AND p_sucursal_id IS NULL THEN
        WITH branch_sales AS (SELECT v.sucursal_id, SUM(v.total) as total_sales, SUM(vi.cantidad * (vi.precio_unitario_aplicado - vi.costo_unitario_en_venta) - v.descuento / (SELECT COUNT(*) FROM venta_items WHERE venta_id = v.id)) as total_profit FROM ventas v JOIN venta_items vi ON v.id = vi.venta_id WHERE v.empresa_id = caller_empresa_id AND v.fecha >= v_start_utc AND v.fecha < v_end_utc AND v.estado_pago != 'Pedido Web Pendiente' GROUP BY v.id, v.sucursal_id) SELECT json_agg(chart_points) INTO chart_data FROM ( SELECT s.nombre as label, COALESCE(SUM(bs.total_sales), 0) as sales, COALESCE(SUM(bs.total_profit), 0) as profit FROM sucursales s LEFT JOIN branch_sales bs ON s.id = bs.sucursal_id WHERE s.empresa_id = caller_empresa_id GROUP BY s.nombre ORDER BY sales DESC ) as chart_points;
    ELSE
        IF (p_end_date - p_start_date) > 31 THEN SELECT json_agg(chart_points) INTO chart_data FROM ( SELECT to_char(d.month, 'TMMonth') as label, COALESCE(SUM(v.total), 0) as sales, COALESCE(SUM(vi.cantidad * (vi.precio_unitario_aplicado - vi.costo_unitario_en_venta) - v.descuento / (SELECT COUNT(*) FROM venta_items WHERE venta_id = v.id)), 0) as profit FROM generate_series(date_trunc('month', p_start_date), p_end_date, '1 month') d(month) LEFT JOIN ventas v ON date_trunc('month', v.fecha AT TIME ZONE p_timezone) = d.month AND v.empresa_id = caller_empresa_id AND v.sucursal_id = effective_sucursal_id AND v.estado_pago != 'Pedido Web Pendiente' LEFT JOIN venta_items vi ON vi.venta_id = v.id GROUP BY d.month ORDER BY d.month ASC ) as chart_points;
        ELSE SELECT json_agg(chart_points) INTO chart_data FROM ( SELECT to_char(d.day, 'DD Mon') as label, COALESCE(SUM(v.total), 0) as sales, COALESCE(SUM(vi.cantidad * (vi.precio_unitario_aplicado - vi.costo_unitario_en_venta) - v.descuento / (SELECT COUNT(*) FROM venta_items WHERE venta_id = v.id)), 0) as profit FROM generate_series(p_start_date, p_end_date, '1 day') d(day) LEFT JOIN ventas v ON (v.fecha AT TIME ZONE p_timezone)::date = d.day AND v.empresa_id = caller_empresa_id AND v.sucursal_id = effective_sucursal_id AND v.estado_pago != 'Pedido Web Pendiente' LEFT JOIN venta_items vi ON vi.venta_id = v.id GROUP BY d.day ORDER BY d.day ASC ) as chart_points;
        END IF;
    END IF;

    -- All Branches for Owner
    IF caller_rol = 'Propietario' THEN SELECT json_agg(s) INTO all_branches FROM (SELECT id, nombre FROM sucursales WHERE empresa_id = caller_empresa_id ORDER BY nombre) s; END IF;
    
    -- Top Selling Products
    SELECT json_agg(top_prods) INTO top_selling_products FROM (SELECT p.id, p.nombre, SUM(vi.cantidad * vi.precio_unitario_aplicado) as total_vendido FROM venta_items vi JOIN productos p ON vi.producto_id = p.id JOIN ventas v ON vi.venta_id = v.id WHERE v.empresa_id = caller_empresa_id AND v.fecha >= v_start_utc AND v.fecha < v_end_utc AND (effective_sucursal_id IS NULL OR v.sucursal_id = effective_sucursal_id) AND v.estado_pago != 'Pedido Web Pendiente' GROUP BY p.id, p.nombre ORDER BY total_vendido DESC LIMIT 5 ) as top_prods;

    -- Top Customers
    SELECT json_agg(top_cust) INTO top_customers FROM (SELECT c.id, c.nombre, c.avatar_url, SUM(v.total) as total_comprado FROM ventas v JOIN clientes c ON v.cliente_id = c.id WHERE v.empresa_id = caller_empresa_id AND v.fecha >= v_start_utc AND v.fecha < v_end_utc AND v.cliente_id IS NOT NULL AND c.nombre <> 'Consumidor Final' AND (effective_sucursal_id IS NULL OR v.sucursal_id = effective_sucursal_id) AND v.estado_pago != 'Pedido Web Pendiente' GROUP BY c.id, c.nombre, c.avatar_url ORDER BY total_comprado DESC LIMIT 3 ) as top_cust;

    -- Build final response object
    RETURN jsonb_build_object('kpis', kpis, 'low_stock_products', COALESCE(low_stock_products, '[]'::json), 'recent_activity', COALESCE(recent_activity, '[]'::json), 'chart_data', COALESCE(chart_data, '[]'::json), 'all_branches', COALESCE(all_branches, '[]'::json), 'top_selling_products', COALESCE(top_selling_products, '[]'::json), 'top_customers', COALESCE(top_customers, '[]'::json));
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================