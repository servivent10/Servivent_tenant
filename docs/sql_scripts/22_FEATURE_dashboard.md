-- =============================================================================
-- DASHBOARD DATA FUNCTION (V3 - INTELLIGENT DASHBOARD FIXES)
-- =============================================================================
-- Este script reescribe por completo la función `get_dashboard_data` para
-- ser más robusta, eficiente y corregir los errores reportados.
--
-- CAMBIOS CLAVE:
-- 1. Lógica de Sucursal Centralizada: Se usa una variable `effective_sucursal_id`
--    para unificar y corregir el filtrado por sucursal en todas las consultas.
-- 2. Corrección de Gráfico y Top Productos: Se usan CTEs (Common Table Expressions)
--    para hacer más fiables las consultas del gráfico comparativo y el top de
--    productos, asegurando que se muestren datos.
-- 3. Nuevos Contadores: Se añaden `total_sales_count` y `total_purchases_count`
--    para alimentar las nuevas "burbujas" en las tarjetas de KPIs.
--
-- INSTRUCCIONES:
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_data(
    p_start_date date,
    p_end_date date,
    p_sucursal_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    -- user and period variables
    caller_empresa_id uuid;
    caller_rol text;
    caller_sucursal_id uuid;
    effective_sucursal_id uuid;
    
    v_start_date date := p_start_date;
    v_end_date date := p_end_date;
    v_period_days integer := v_end_date - v_start_date + 1;
    v_prev_start_date date := v_start_date - v_period_days;
    v_prev_end_date date := v_end_date - v_period_days;

    -- result variables
    kpis jsonb;
    low_stock_products json;
    recent_activity json;
    chart_data json;
    comparative_chart_data json;
    all_branches json;
    top_selling_products json;
    top_customers json;

    -- intermediate calculation variables
    v_total_sales numeric;
    v_gross_profit numeric;
    v_total_impuestos numeric;
    v_ventas_con_impuestos bigint;
    v_total_sales_count bigint;
    v_prev_total_sales numeric;
    v_prev_gross_profit numeric;
BEGIN
    -- 1. Get caller info and determine effective branch filter
    SELECT u.empresa_id, u.rol, u.sucursal_id INTO caller_empresa_id, caller_rol, caller_sucursal_id
    FROM public.usuarios u WHERE u.id = auth.uid();
    
    IF caller_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado.';
    END IF;

    -- Centralized logic for filtering by branch
    IF caller_rol = 'Propietario' THEN
        effective_sucursal_id := p_sucursal_id; -- Can be NULL for all, or a specific ID
    ELSE
        effective_sucursal_id := caller_sucursal_id; -- Always their own branch for other roles
    END IF;

    -- 2. Calculate Sales & Profit KPIs
    WITH sales_in_period AS (
        SELECT
            SUM(v.total) as total_sales,
            SUM(v.impuestos) as total_impuestos,
            COUNT(*) as sales_count,
            COUNT(*) FILTER (WHERE v.impuestos > 0) as ventas_con_impuestos,
            SUM(vi.cantidad * (vi.precio_unitario_aplicado - vi.costo_unitario_en_venta)) as gross_profit
        FROM ventas v
        JOIN venta_items vi ON v.id = vi.venta_id
        WHERE v.empresa_id = caller_empresa_id
          AND v.fecha::date BETWEEN v_start_date AND v_end_date
          AND (effective_sucursal_id IS NULL OR v.sucursal_id = effective_sucursal_id)
    ),
    sales_in_previous_period AS (
        SELECT
            SUM(v.total) as total_sales,
            SUM(vi.cantidad * (vi.precio_unitario_aplicado - vi.costo_unitario_en_venta)) as gross_profit
        FROM ventas v
        JOIN venta_items vi ON v.id = vi.venta_id
        WHERE v.empresa_id = caller_empresa_id
          AND v.fecha::date BETWEEN v_prev_start_date AND v_prev_end_date
          AND (effective_sucursal_id IS NULL OR v.sucursal_id = effective_sucursal_id)
    )
    SELECT 
        COALESCE(s_current.total_sales, 0),
        COALESCE(s_current.gross_profit, 0),
        COALESCE(s_current.total_impuestos, 0),
        COALESCE(s_current.ventas_con_impuestos, 0),
        COALESCE(s_current.sales_count, 0),
        COALESCE(s_prev.total_sales, 0),
        COALESCE(s_prev.gross_profit, 0)
    INTO 
        v_total_sales, v_gross_profit, v_total_impuestos, v_ventas_con_impuestos, v_total_sales_count,
        v_prev_total_sales, v_prev_gross_profit
    FROM sales_in_period s_current, sales_in_previous_period s_prev;
    
    -- 3. Calculate other KPIs
    SELECT jsonb_build_object(
        'total_sales', v_total_sales,
        'total_sales_count', v_total_sales_count,
        'sales_change_percentage', 
            CASE 
                WHEN v_prev_total_sales > 0 THEN round(((v_total_sales - v_prev_total_sales) / v_prev_total_sales) * 100, 2)
                ELSE CASE WHEN v_total_sales > 0 THEN 100 ELSE 0 END
            END,
        'gross_profit', v_gross_profit,
        'profit_change_percentage',
             CASE 
                WHEN v_prev_gross_profit <> 0 THEN round(((v_gross_profit - v_prev_gross_profit) / abs(v_prev_gross_profit)) * 100, 2)
                ELSE CASE WHEN v_gross_profit <> 0 THEN 100 ELSE 0 END
            END,
        'total_purchases', (SELECT COALESCE(SUM(total_bob), 0) FROM compras WHERE empresa_id = caller_empresa_id AND fecha BETWEEN v_start_date AND v_end_date AND (effective_sucursal_id IS NULL OR sucursal_id = effective_sucursal_id)),
        'total_purchases_count', (SELECT COALESCE(COUNT(*), 0) FROM compras WHERE empresa_id = caller_empresa_id AND fecha BETWEEN v_start_date AND v_end_date AND (effective_sucursal_id IS NULL OR sucursal_id = effective_sucursal_id)),
        'total_impuestos', v_total_impuestos,
        'tax_sales_count', v_ventas_con_impuestos
    ) INTO kpis;
    
    -- 4. Get low stock products
    SELECT json_agg(low_stock) INTO low_stock_products FROM (
        SELECT 
            p.id, p.nombre, SUM(i.cantidad) as cantidad
        FROM inventarios i
        JOIN productos p ON i.producto_id = p.id
        WHERE p.empresa_id = caller_empresa_id
          AND (effective_sucursal_id IS NULL OR i.sucursal_id = effective_sucursal_id)
        GROUP BY p.id, p.nombre
        HAVING SUM(i.cantidad) <= SUM(COALESCE(i.stock_minimo, 0)) AND SUM(COALESCE(i.stock_minimo, 0)) > 0
        ORDER BY SUM(i.cantidad) ASC
        LIMIT 5
    ) AS low_stock;

    -- 5. Get recent activity
    SELECT json_agg(activity) INTO recent_activity FROM (
        (SELECT 'venta' as type, 'Venta ' || v.folio || ' a ' || COALESCE(c.nombre, 'Consumidor Final') as description, v.total as amount, v.created_at as timestamp
        FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id
        WHERE v.empresa_id = caller_empresa_id AND (effective_sucursal_id IS NULL OR v.sucursal_id = effective_sucursal_id)
        ORDER BY v.created_at DESC LIMIT 3)
        UNION ALL
        (SELECT 'compra' as type, 'Compra ' || c.folio || ' de ' || p.nombre as description, c.total_bob as amount, c.created_at as timestamp
        FROM compras c JOIN proveedores p ON c.proveedor_id = p.id
        WHERE c.empresa_id = caller_empresa_id AND (effective_sucursal_id IS NULL OR c.sucursal_id = effective_sucursal_id)
        ORDER BY c.created_at DESC LIMIT 2)
        UNION ALL
        (SELECT 'producto' as type, 'Nuevo producto: ' || p.nombre as description, null as amount, p.created_at as timestamp
        FROM productos p WHERE p.empresa_id = caller_empresa_id ORDER BY p.created_at DESC LIMIT 2)
        ORDER BY timestamp DESC LIMIT 7
    ) as activity;

    -- 6. Get data for charts
    IF caller_rol = 'Propietario' AND p_sucursal_id IS NULL THEN
        WITH branch_sales AS (
          SELECT
            v.sucursal_id,
            SUM(v.total) as total_sales,
            SUM(vi.cantidad * (vi.precio_unitario_aplicado - vi.costo_unitario_en_venta)) as total_profit
          FROM ventas v
          JOIN venta_items vi ON v.id = vi.venta_id
          WHERE v.empresa_id = caller_empresa_id
            AND v.fecha::date BETWEEN v_start_date AND v_end_date
          GROUP BY v.sucursal_id
        )
        SELECT json_agg(chart_points) INTO comparative_chart_data FROM (
          SELECT
            s.nombre as label,
            COALESCE(bs.total_sales, 0) as sales,
            COALESCE(bs.total_profit, 0) as profit
          FROM sucursales s
          LEFT JOIN branch_sales bs ON s.id = bs.sucursal_id
          WHERE s.empresa_id = caller_empresa_id
          ORDER BY sales DESC
        ) as chart_points;
    ELSE
        SELECT json_agg(chart_points) INTO chart_data FROM (
            SELECT
                to_char(d.day, 'DD/MM') as label,
                COALESCE(SUM(v.total), 0) as value
            FROM generate_series((current_date - interval '6 days')::date, current_date::date, '1 day') d(day)
            LEFT JOIN ventas v ON v.fecha::date = d.day
                AND v.empresa_id = caller_empresa_id
                AND v.sucursal_id = effective_sucursal_id
            GROUP BY d.day ORDER BY d.day ASC
        ) as chart_points;
    END IF;

    -- 7. Get all branches if owner
    IF caller_rol = 'Propietario' THEN
        SELECT json_agg(s) INTO all_branches FROM (SELECT id, nombre FROM sucursales WHERE empresa_id = caller_empresa_id ORDER BY nombre) s;
    END IF;
    
    -- 8. Get Top Selling Products
    SELECT json_agg(top_prods) INTO top_selling_products FROM (
        SELECT p.id, p.nombre, SUM(vi.cantidad * vi.precio_unitario_aplicado) as total_vendido
        FROM venta_items vi
        JOIN productos p ON vi.producto_id = p.id
        JOIN ventas v ON vi.venta_id = v.id
        WHERE v.empresa_id = caller_empresa_id
          AND v.fecha::date BETWEEN v_start_date AND v_end_date
          AND (effective_sucursal_id IS NULL OR v.sucursal_id = effective_sucursal_id)
        GROUP BY p.id, p.nombre
        ORDER BY total_vendido DESC
        LIMIT 5
    ) as top_prods;

    -- 9. Get Top Customers
    SELECT json_agg(top_cust) INTO top_customers FROM (
        SELECT c.id, c.nombre, c.avatar_url, SUM(v.total) as total_comprado
        FROM ventas v
        JOIN clientes c ON v.cliente_id = c.id
        WHERE v.empresa_id = caller_empresa_id
          AND v.fecha::date BETWEEN v_start_date AND v_end_date
          AND v.cliente_id IS NOT NULL AND c.nombre <> 'Consumidor Final'
          AND (effective_sucursal_id IS NULL OR v.sucursal_id = effective_sucursal_id)
        GROUP BY c.id, c.nombre, c.avatar_url
        ORDER BY total_comprado DESC
        LIMIT 5
    ) as top_cust;

    -- 10. Build final response object
    RETURN jsonb_build_object(
        'kpis', kpis,
        'low_stock_products', COALESCE(low_stock_products, '[]'::json),
        'recent_activity', COALESCE(recent_activity, '[]'::json),
        'chart_data', COALESCE(chart_data, '[]'::json),
        'comparative_chart_data', COALESCE(comparative_chart_data, '[]'::json),
        'all_branches', COALESCE(all_branches, '[]'::json),
        'top_selling_products', COALESCE(top_selling_products, '[]'::json),
        'top_customers', COALESCE(top_customers, '[]'::json)
    );
END;
$$;