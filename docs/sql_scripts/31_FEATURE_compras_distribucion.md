-- =============================================================================
-- PURCHASE DISTRIBUTION FEATURE SCRIPT (V2 - Date Fix)
-- =============================================================================
-- This script updates the logic for registering purchases to allow the
-- distribution of a single product's quantity across multiple branches
-- and RE-INCORPORATES the ability for the user to set the purchase date and time,
-- fixing a regression and the distribution error.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Define the updated data types
-- -----------------------------------------------------------------------------
DROP TYPE IF EXISTS public.distribucion_item_input CASCADE;
CREATE TYPE public.distribucion_item_input AS (
    sucursal_id uuid,
    cantidad numeric
);

DROP TYPE IF EXISTS public.compra_item_input CASCADE;
CREATE TYPE public.compra_item_input AS (
    producto_id uuid,
    costo_unitario numeric,
    precios price_rule_input[],
    distribucion distribucion_item_input[]
);

DROP TYPE IF EXISTS public.compra_input CASCADE;
CREATE TYPE public.compra_input AS (
    proveedor_id uuid,
    sucursal_id uuid,
    fecha timestamptz, -- CORRECTION: Added back to allow custom date
    moneda text,
    tasa_cambio numeric,
    tipo_pago text,
    n_factura text,
    fecha_vencimiento date,
    abono_inicial numeric,
    metodo_abono text
);

-- -----------------------------------------------------------------------------
-- Step 2: Update the `registrar_compra` function with corrected logic
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
    dist_item distribucion_item_input;
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
    v_folio text;
    v_proveedor_nombre text;
BEGIN
    -- 1. Calculate the total purchase amount by summing quantities from distributions
    FOREACH item IN ARRAY p_items LOOP
        -- **FIX**: Use COALESCE to ensure SUM returns 0 instead of NULL for empty distributions
        cantidad_total_item := (SELECT COALESCE(SUM(d.cantidad), 0) FROM unnest(item.distribucion) d);
        total_compra := total_compra + (cantidad_total_item * item.costo_unitario);
    END LOOP;

    -- 2. Calculate total in BOB and pending balance (unchanged logic)
    total_compra_bob := CASE WHEN p_compra.moneda = 'USD' THEN total_compra * p_compra.tasa_cambio ELSE total_compra END;
    IF p_compra.tipo_pago = 'Contado' THEN
        saldo_final := 0;
        estado_final := 'Pagada';
    ELSE 
        saldo_final := total_compra - COALESCE(p_compra.abono_inicial, 0);
        IF saldo_final <= 0.005 THEN estado_final := 'Pagada'; saldo_final := 0;
        ELSIF COALESCE(p_compra.abono_inicial, 0) > 0 THEN estado_final := 'Abono Parcial';
        ELSE estado_final := 'Pendiente'; END IF;
    END IF;
    
    -- 3. Get the next folio number (unchanged logic)
    SELECT COALESCE(MAX(substring(folio from 6)::integer), 0) + 1 
    INTO next_folio_number 
    FROM public.compras 
    WHERE empresa_id = caller_empresa_id;

    v_folio := 'COMP-' || lpad(next_folio_number::text, 5, '0');

    -- 4. Insert the purchase header (using the date from the payload)
    INSERT INTO public.compras (
        empresa_id, sucursal_id, proveedor_id, usuario_id, folio, fecha, moneda, tasa_cambio, total, total_bob,
        tipo_pago, estado_pago, saldo_pendiente, n_factura, fecha_vencimiento
    ) VALUES (
        caller_empresa_id, p_compra.sucursal_id, p_compra.proveedor_id, caller_user_id,
        v_folio, p_compra.fecha, p_compra.moneda, p_compra.tasa_cambio, total_compra, total_compra_bob,
        p_compra.tipo_pago, estado_final, saldo_final, p_compra.n_factura, p_compra.fecha_vencimiento
    ) RETURNING id INTO new_compra_id;

    -- 5. Process each item and its distribution
    FOREACH item IN ARRAY p_items LOOP
        -- **FIX**: Use COALESCE here as well for safety in calculations below
        cantidad_total_item := (SELECT COALESCE(SUM(d.cantidad), 0) FROM unnest(item.distribucion) d);

        -- Insert the purchase item with the total quantity
        INSERT INTO public.compra_items (compra_id, producto_id, cantidad, costo_unitario)
        VALUES (new_compra_id, item.producto_id, cantidad_total_item, item.costo_unitario);
        
        costo_unitario_bob := CASE WHEN p_compra.moneda = 'USD' THEN item.costo_unitario * p_compra.tasa_cambio ELSE item.costo_unitario END;

        -- Calculate the new CAPP using the total quantity of the item
        SELECT COALESCE(SUM(i.cantidad), 0), p.precio_compra INTO stock_total_actual, capp_actual
        FROM public.productos p
        LEFT JOIN public.inventarios i ON p.id = i.producto_id
        WHERE p.id = item.producto_id
        GROUP BY p.id;
        capp_actual := COALESCE(capp_actual, 0);

        IF (stock_total_actual + cantidad_total_item) > 0 THEN
            nuevo_capp := ((stock_total_actual * capp_actual) + (cantidad_total_item * costo_unitario_bob)) / (stock_total_actual + cantidad_total_item);
        ELSE
            nuevo_capp := costo_unitario_bob;
        END IF;
        
        UPDATE public.productos SET precio_compra = nuevo_capp WHERE id = item.producto_id;

        -- Update sales prices (unchanged logic)
        IF item.precios IS NOT NULL AND array_length(item.precios, 1) > 0 THEN
            FOREACH price_rule IN ARRAY item.precios LOOP
                new_price := nuevo_capp + price_rule.ganancia_maxima;
                INSERT INTO public.precios_productos(producto_id, lista_precio_id, ganancia_maxima, ganancia_minima, precio)
                VALUES(item.producto_id, price_rule.lista_id, price_rule.ganancia_maxima, price_rule.ganancia_minima, new_price)
                ON CONFLICT (producto_id, lista_precio_id) DO UPDATE SET
                    ganancia_maxima = EXCLUDED.ganancia_maxima,
                    ganancia_minima = EXCLUDED.ganancia_minima,
                    precio = EXCLUDED.precio,
                    updated_at = now();
            END LOOP;
        END IF;

        -- **DISTRIBUTION LOGIC**: Iterate over the distribution to update inventory
        FOREACH dist_item IN ARRAY item.distribucion LOOP
            IF dist_item.cantidad > 0 THEN
                DECLARE
                    stock_sucursal_anterior numeric;
                BEGIN
                    SELECT cantidad INTO stock_sucursal_anterior 
                    FROM public.inventarios 
                    WHERE producto_id = item.producto_id AND sucursal_id = dist_item.sucursal_id;
                    
                    stock_sucursal_anterior := COALESCE(stock_sucursal_anterior, 0);

                    INSERT INTO public.inventarios (producto_id, sucursal_id, cantidad)
                    VALUES (item.producto_id, dist_item.sucursal_id, stock_sucursal_anterior + dist_item.cantidad)
                    ON CONFLICT (producto_id, sucursal_id) DO UPDATE SET
                        cantidad = public.inventarios.cantidad + dist_item.cantidad,
                        updated_at = now();

                    INSERT INTO public.movimientos_inventario (
                        producto_id, sucursal_id, usuario_id, tipo_movimiento,
                        cantidad_ajustada, stock_anterior, stock_nuevo, referencia_id
                    ) VALUES (
                        item.producto_id, dist_item.sucursal_id, caller_user_id, 'Compra',
                        dist_item.cantidad, stock_sucursal_anterior, stock_sucursal_anterior + dist_item.cantidad, new_compra_id
                    );
                END;
            END IF;
        END LOOP;
    END LOOP;

    -- 6. Register payment (unchanged logic)
    IF p_compra.tipo_pago = 'Contado' THEN
        INSERT INTO public.pagos_compras (compra_id, monto, metodo_pago)
        VALUES (new_compra_id, total_compra, 'Contado');
    ELSIF p_compra.tipo_pago = 'Crédito' AND COALESCE(p_compra.abono_inicial, 0) > 0 THEN
        INSERT INTO public.pagos_compras (compra_id, monto, metodo_pago)
        VALUES (new_compra_id, p_compra.abono_inicial, COALESCE(p_compra.metodo_abono, 'Abono Inicial'));
    END IF;

    -- 7. **NEW: Generate smart notification**
    SELECT nombre INTO v_proveedor_nombre FROM proveedores WHERE id = p_compra.proveedor_id;
    PERFORM notificar_cambio(
        'NUEVA_COMPRA', 
        'Compra <b>' || v_folio || '</b> a ' || v_proveedor_nombre || ' por <b>' || p_compra.moneda || ' ' || total_compra::text || '</b>',
        new_compra_id
    );

    RETURN new_compra_id;
END;
$$;