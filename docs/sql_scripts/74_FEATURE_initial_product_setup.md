-- =============================================================================
-- INITIAL PRODUCT SETUP FEATURE - DATABASE SETUP (V1)
-- =============================================================================
-- This script implements the backend infrastructure for the new "Initial Product
-- Setup" feature, designed to streamline the onboarding of new products without
-- a purchase/sale history.
--
-- WHAT IT DOES:
-- 1. Creates `set_initial_product_setup`: A new transactional RPC function to set
--    initial cost, price, and inventory quantities/minimums for a "virgin" product.
-- 2. Updates `get_company_products_with_stock_and_cost`: The main product list
--    function is enhanced to return `has_sales` and `has_purchases` flags,
--    enabling the UI to conditionally show the new setup feature.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create a new composite type for the inventory adjustment input
-- -----------------------------------------------------------------------------
DROP TYPE IF EXISTS public.ajuste_inventario_inicial_input CASCADE;
CREATE TYPE public.ajuste_inventario_inicial_input AS (
    sucursal_id uuid,
    cantidad_inicial numeric,
    stock_minimo numeric
);

-- -----------------------------------------------------------------------------
-- Step 2: Create the new RPC function `set_initial_product_setup`
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_initial_product_setup(
    p_producto_id uuid,
    p_costo_inicial numeric,
    p_precio_base numeric,
    p_ajustes ajuste_inventario_inicial_input[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    caller_user_id uuid := auth.uid();
    v_has_history boolean;
    v_default_price_list_id uuid;
    v_ganancia numeric;
    ajuste ajuste_inventario_inicial_input;
BEGIN
    -- 1. Security Check: Ensure the product belongs to the user's company
    IF NOT EXISTS (SELECT 1 FROM public.productos WHERE id = p_producto_id AND empresa_id = caller_empresa_id) THEN
        RAISE EXCEPTION 'Producto no encontrado o no pertenece a tu empresa.';
    END IF;

    -- 2. CRITICAL: Verify the product has NO sales or purchase history
    SELECT EXISTS (SELECT 1 FROM public.venta_items WHERE producto_id = p_producto_id) OR
           EXISTS (SELECT 1 FROM public.compra_items WHERE producto_id = p_producto_id)
    INTO v_has_history;

    IF v_has_history THEN
        RAISE EXCEPTION 'Este producto ya tiene historial de ventas o compras y no puede usar la configuración inicial.';
    END IF;

    -- 3. Update the product's cost (CAPP)
    UPDATE public.productos
    SET precio_compra = p_costo_inicial
    WHERE id = p_producto_id;

    -- 4. Set the base selling price and gains
    SELECT id INTO v_default_price_list_id FROM public.listas_precios WHERE empresa_id = caller_empresa_id AND es_predeterminada = true;
    
    v_ganancia := p_precio_base - p_costo_inicial;

    INSERT INTO public.precios_productos (producto_id, lista_precio_id, precio, ganancia_maxima, ganancia_minima)
    VALUES (p_producto_id, v_default_price_list_id, p_precio_base, v_ganancia, v_ganancia)
    ON CONFLICT (producto_id, lista_precio_id) DO UPDATE SET
        precio = EXCLUDED.precio,
        ganancia_maxima = EXCLUDED.ganancia_maxima,
        ganancia_minima = EXCLUDED.ganancia_minima,
        updated_at = now();

    -- 5. Load initial inventory for each branch
    FOREACH ajuste IN ARRAY p_ajustes
    LOOP
        IF ajuste.cantidad_inicial > 0 OR ajuste.stock_minimo > 0 THEN
            INSERT INTO public.inventarios (producto_id, sucursal_id, cantidad, stock_minimo)
            VALUES (p_producto_id, ajuste.sucursal_id, ajuste.cantidad_inicial, ajuste.stock_minimo)
            ON CONFLICT (producto_id, sucursal_id) DO UPDATE SET
                cantidad = EXCLUDED.cantidad,
                stock_minimo = EXCLUDED.stock_minimo,
                updated_at = now();
            
            -- Register the movement in the audit log only if quantity is changing
            IF ajuste.cantidad_inicial > 0 THEN
                INSERT INTO public.movimientos_inventario (
                    producto_id, sucursal_id, usuario_id, tipo_movimiento,
                    cantidad_ajustada, stock_anterior, stock_nuevo, motivo, referencia_id
                ) VALUES (
                    p_producto_id, ajuste.sucursal_id, caller_user_id, 'Ajuste',
                    ajuste.cantidad_inicial, 0, ajuste.cantidad_inicial, 'Carga Inicial de Inventario', p_producto_id
                );
            END IF;
        END IF;
    END LOOP;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 3: Update `get_company_products_with_stock_and_cost` to include history flags
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_company_products_with_stock_and_cost();
CREATE OR REPLACE FUNCTION get_company_products_with_stock_and_cost()
RETURNS TABLE (
    id uuid,
    nombre text,
    sku text,
    marca text,
    modelo text,
    categoria_id uuid,
    unidad_medida text,
    descripcion text,
    categoria_nombre text,
    stock_total numeric,
    stock_sucursal numeric,
    precio_base numeric,
    imagen_principal text,
    precio_compra numeric,
    stock_minimo numeric,
    unidades_vendidas_90_dias numeric,
    created_at timestamptz,
    has_sales boolean,
    has_purchases boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    caller_sucursal_id uuid;
BEGIN
    SELECT u.sucursal_id INTO caller_sucursal_id FROM public.usuarios u WHERE u.id = auth.uid();
    IF caller_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario no encontrado.'; END IF;

    RETURN QUERY
    SELECT
        p.id, p.nombre, p.sku, p.marca, p.modelo, p.categoria_id, p.unidad_medida, p.descripcion,
        c.nombre as categoria_nombre,
        COALESCE(i_agg.stock_total, 0) as stock_total,
        COALESCE(i_sucursal.stock_sucursal, 0) as stock_sucursal,
        COALESCE(pp.precio, 0) as precio_base,
        (SELECT img.imagen_url FROM public.imagenes_productos img WHERE img.producto_id = p.id ORDER BY img.orden, img.created_at LIMIT 1) as imagen_principal,
        p.precio_compra,
        COALESCE(i_agg.stock_minimo_total, 0) as stock_minimo,
        (
            SELECT COALESCE(SUM(vi.cantidad), 0)
            FROM public.venta_items vi JOIN public.ventas v ON vi.venta_id = v.id
            WHERE vi.producto_id = p.id AND v.empresa_id = caller_empresa_id AND v.fecha >= (now() - interval '90 days')
        ) as unidades_vendidas_90_dias,
        p.created_at,
        EXISTS(SELECT 1 FROM public.venta_items WHERE producto_id = p.id) as has_sales,
        EXISTS(SELECT 1 FROM public.compra_items WHERE producto_id = p.id) as has_purchases
    FROM public.productos p
    LEFT JOIN public.categorias c ON p.categoria_id = c.id
    LEFT JOIN (
        SELECT inv.producto_id, SUM(inv.cantidad) as stock_total, SUM(inv.stock_minimo) as stock_minimo_total
        FROM public.inventarios inv GROUP BY inv.producto_id
    ) i_agg ON p.id = i_agg.producto_id
    LEFT JOIN (
        SELECT inv_s.producto_id, inv_s.cantidad as stock_sucursal
        FROM public.inventarios inv_s WHERE inv_s.sucursal_id = caller_sucursal_id
    ) i_sucursal ON p.id = i_sucursal.producto_id
    LEFT JOIN public.listas_precios lp ON lp.empresa_id = p.empresa_id AND lp.es_predeterminada = true
    LEFT JOIN public.precios_productos pp ON pp.producto_id = p.id AND pp.lista_precio_id = lp.id
    WHERE p.empresa_id = caller_empresa_id
    ORDER BY p.created_at DESC;
END;
$function$;

-- =============================================================================
-- End of script.
-- =============================================================================