-- =============================================================================
-- INVENTORY ONBOARDING & MINIMUM STOCK FEATURE (V4 - Bulk Audit Logging)
-- =============================================================================
-- This script implements the backend infrastructure for the new inventory
-- onboarding flow and minimum stock management.
-- VERSION 4: This version implements the context-aware auditing system for
-- bulk imports to prevent flooding the audit log.
--
-- WHAT IT DOES:
-- 1. Adds a `stock_minimo` column to the `inventarios` table.
-- 2. Updates `upsert_product` to handle `costo_inicial` and `precio_base`.
-- 3. Updates `ajustar_inventario_lote` to manage `stock_minimo`.
-- 4. Updates `import_products_in_bulk` to set a context variable to bypass
--    individual audit logs and instead insert consolidated summary logs.
-- 5. Fixes function ambiguity by cleaning up old types.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Alter tables (Idempotent)
-- -----------------------------------------------------------------------------
ALTER TABLE public.inventarios ADD COLUMN IF NOT EXISTS stock_minimo numeric(10, 2) NOT NULL DEFAULT 0;
-- The `costo_inicial` column on `productos` was removed in favor of direct CAPP setting.
-- It's kept in the function signature for compatibility with frontend calls.

-- -----------------------------------------------------------------------------
-- Step 2: Update RPC function `upsert_product`
-- -----------------------------------------------------------------------------
-- Drop all known previous versions of the function to avoid signature conflicts.
DROP FUNCTION IF EXISTS public.upsert_product(uuid, text, text, text, text, text, uuid, text);
DROP FUNCTION IF EXISTS public.upsert_product(uuid, text, text, text, text, text, uuid, text, numeric);
DROP FUNCTION IF EXISTS public.upsert_product(uuid, text, text, text, text, text, uuid, text, numeric, numeric);

-- Create the new, correct version.
CREATE OR REPLACE FUNCTION upsert_product(
    p_id uuid,
    p_nombre text,
    p_sku text,
    p_marca text,
    p_modelo text,
    p_descripcion text,
    p_categoria_id uuid,
    p_unidad_medida text,
    p_costo_inicial numeric DEFAULT NULL,
    p_precio_base numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    v_producto_id uuid;
    v_default_price_list_id uuid;
    v_ganancia numeric;
BEGIN
    IF caller_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario no encontrado.'; END IF;

    -- Ensure default price list exists
    SELECT id INTO v_default_price_list_id FROM public.listas_precios WHERE empresa_id = caller_empresa_id AND es_predeterminada = true;
    IF v_default_price_list_id IS NULL THEN
        INSERT INTO public.listas_precios (empresa_id, nombre, es_predeterminada, descripcion)
        VALUES (caller_empresa_id, 'General', true, 'Precio de venta estándar')
        RETURNING id INTO v_default_price_list_id;
    END IF;

    IF p_id IS NULL THEN
        -- CREATE NEW PRODUCT FLOW
        INSERT INTO public.productos(
            empresa_id, nombre, sku, marca, modelo, descripcion, categoria_id, unidad_medida,
            precio_compra -- Set initial cost as CAPP
        ) VALUES (
            caller_empresa_id, p_nombre, p_sku, p_marca, p_modelo, p_descripcion, p_categoria_id, p_unidad_medida,
            p_costo_inicial -- Set CAPP
        ) RETURNING id INTO v_producto_id;

        -- Create a default price rule for the new product
        IF p_precio_base IS NOT NULL AND p_costo_inicial IS NOT NULL THEN
            v_ganancia := p_precio_base - p_costo_inicial;
            INSERT INTO public.precios_productos(producto_id, lista_precio_id, precio, ganancia_maxima, ganancia_minima)
            VALUES(v_producto_id, v_default_price_list_id, p_precio_base, v_ganancia, v_ganancia);
        ELSE
            -- Insert a placeholder rule if not enough data is provided
            INSERT INTO public.precios_productos(producto_id, lista_precio_id, precio, ganancia_maxima, ganancia_minima)
            VALUES(v_producto_id, v_default_price_list_id, COALESCE(p_precio_base, 0), 0, 0);
        END IF;
    ELSE
        -- UPDATE EXISTING PRODUCT FLOW
        v_producto_id := p_id;
        
        UPDATE public.productos
        SET nombre = p_nombre, sku = p_sku, marca = p_marca, modelo = p_modelo,
            descripcion = p_descripcion, categoria_id = p_categoria_id, unidad_medida = p_unidad_medida
        WHERE id = v_producto_id AND empresa_id = caller_empresa_id;
        
        DECLARE
            v_has_history boolean;
        BEGIN
            SELECT EXISTS (SELECT 1 FROM public.venta_items WHERE producto_id = v_producto_id) OR
                   EXISTS (SELECT 1 FROM public.compra_items WHERE producto_id = v_producto_id)
            INTO v_has_history;

            IF NOT v_has_history THEN
                DECLARE
                    v_cost_to_use numeric;
                BEGIN
                    -- Determine the cost to use. If a new cost is provided, use it. Otherwise, use the existing one.
                    IF p_costo_inicial IS NOT NULL THEN
                        UPDATE public.productos SET precio_compra = p_costo_inicial WHERE id = v_producto_id;
                        v_cost_to_use := p_costo_inicial;
                    ELSE
                        SELECT precio_compra INTO v_cost_to_use FROM public.productos WHERE id = v_producto_id;
                    END IF;
                    
                    v_cost_to_use := COALESCE(v_cost_to_use, 0);

                    -- If a base price is provided, calculate gains and upsert the price rule.
                    IF p_precio_base IS NOT NULL THEN
                        DECLARE
                            v_final_gain numeric;
                        BEGIN
                            v_final_gain := p_precio_base - v_cost_to_use;
                            
                            -- Use ON CONFLICT to robustly handle the update. This is the definitive fix.
                            INSERT INTO public.precios_productos (producto_id, lista_precio_id, precio, ganancia_maxima, ganancia_minima)
                            VALUES (v_producto_id, v_default_price_list_id, p_precio_base, v_final_gain, v_final_gain)
                            ON CONFLICT (producto_id, lista_precio_id) DO UPDATE SET
                                precio = EXCLUDED.precio,
                                ganancia_maxima = EXCLUDED.ganancia_maxima,
                                ganancia_minima = EXCLUDED.ganancia_minima,
                                updated_at = now();
                        END;
                    END IF;
                END;
            END IF;
        END;
    END IF;
    RETURN v_producto_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 3: Update RPC function `ajustar_inventario_lote` (DEFINITIVE FIX)
-- -----------------------------------------------------------------------------
-- Clean up old types and functions that cause ambiguity.
DROP TYPE IF EXISTS public.inventory_adjustment CASCADE;
DROP FUNCTION IF EXISTS public.ajustar_inventario_lote(uuid, jsonb, text);

-- Define the new composite type for the input array
DROP TYPE IF EXISTS public.ajuste_inventario_input CASCADE;
CREATE TYPE public.ajuste_inventario_input AS (
    sucursal_id uuid,
    cantidad_ajuste numeric,
    stock_minimo numeric
);

-- Create the new version of the function
CREATE OR REPLACE FUNCTION ajustar_inventario_lote(
    p_producto_id uuid,
    p_ajustes ajuste_inventario_input[],
    p_motivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_user_id uuid := auth.uid();
    ajuste ajuste_inventario_input;
    stock_anterior numeric;
BEGIN
    FOREACH ajuste IN ARRAY p_ajustes
    LOOP
        SELECT cantidad INTO stock_anterior
        FROM public.inventarios
        WHERE producto_id = p_producto_id AND sucursal_id = ajuste.sucursal_id;

        stock_anterior := COALESCE(stock_anterior, 0);

        INSERT INTO public.inventarios (producto_id, sucursal_id, cantidad, stock_minimo)
        VALUES (p_producto_id, ajuste.sucursal_id, stock_anterior + ajuste.cantidad_ajuste, ajuste.stock_minimo)
        ON CONFLICT (producto_id, sucursal_id) DO UPDATE
        SET
            cantidad = public.inventarios.cantidad + ajuste.cantidad_ajuste,
            stock_minimo = ajuste.stock_minimo,
            updated_at = now();
        
        IF ajuste.cantidad_ajuste <> 0 THEN
            INSERT INTO public.movimientos_inventario (
                producto_id, sucursal_id, usuario_id, tipo_movimiento,
                cantidad_ajustada, stock_anterior, stock_nuevo, motivo, referencia_id
            ) VALUES (
                p_producto_id, ajuste.sucursal_id, caller_user_id, 'Ajuste',
                ajuste.cantidad_ajuste, stock_anterior, stock_anterior + ajuste.cantidad_ajuste, p_motivo, p_producto_id
            );
        END IF;
    END LOOP;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 4: Update RPC function `import_products_in_bulk`
-- -----------------------------------------------------------------------------
-- Drop the old function to allow redefining the input type
DROP FUNCTION IF EXISTS public.import_products_in_bulk(product_import_row[]);

-- Define the new composite type for the input array
DROP TYPE IF EXISTS public.product_import_row CASCADE;
CREATE TYPE public.product_import_row AS (
    sku text,
    nombre text,
    marca text,
    modelo text,
    descripcion text,
    categoria_nombre text,
    unidad_medida text,
    precio_base numeric,
    costo_inicial numeric
);

-- Create the new version of the function with bulk audit logging
CREATE OR REPLACE FUNCTION import_products_in_bulk(p_products product_import_row[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    caller_user_id uuid := auth.uid();
    product_data product_import_row;
    v_categoria_id uuid;
    v_producto_id uuid;
    v_default_price_list_id uuid;
    v_ganancia numeric;
    created_count integer := 0;
    updated_count integer := 0;
    created_categories_count integer := 0; -- New counter for categories
    error_count integer := 0;
    error_messages text[] := ARRAY[]::text[];
    row_index integer := 1;
BEGIN
    -- Set a transaction-local variable to signal a bulk import is in progress.
    PERFORM set_config('servivent.source', 'csv_import', true);

    -- Ensure default price list exists
    SELECT id INTO v_default_price_list_id FROM public.listas_precios WHERE empresa_id = caller_empresa_id AND es_predeterminada = true;
    IF v_default_price_list_id IS NULL THEN
        INSERT INTO public.listas_precios (empresa_id, nombre, es_predeterminada) VALUES (caller_empresa_id, 'General', true) RETURNING id INTO v_default_price_list_id;
    END IF;

    FOREACH product_data IN ARRAY p_products
    LOOP
        BEGIN
            v_categoria_id := NULL;
            IF product_data.categoria_nombre IS NOT NULL AND TRIM(product_data.categoria_nombre) <> '' THEN
                SELECT id INTO v_categoria_id FROM public.categorias WHERE nombre = product_data.categoria_nombre AND empresa_id = caller_empresa_id;
                IF v_categoria_id IS NULL THEN
                    INSERT INTO public.categorias (empresa_id, nombre) VALUES (caller_empresa_id, product_data.categoria_nombre) RETURNING id INTO v_categoria_id;
                    created_categories_count := created_categories_count + 1; -- Increment counter
                END IF;
            END IF;

            v_producto_id := NULL;
            IF product_data.sku IS NOT NULL AND TRIM(product_data.sku) <> '' THEN
                SELECT id INTO v_producto_id FROM public.productos WHERE sku = product_data.sku AND empresa_id = caller_empresa_id;
            END IF;

            IF v_producto_id IS NOT NULL THEN
                UPDATE public.productos SET
                    nombre = product_data.nombre,
                    marca = product_data.marca,
                    modelo = product_data.modelo,
                    descripcion = product_data.descripcion,
                    categoria_id = v_categoria_id,
                    unidad_medida = product_data.unidad_medida
                WHERE id = v_producto_id;
                updated_count := updated_count + 1;
            ELSE
                INSERT INTO public.productos (empresa_id, sku, nombre, marca, modelo, descripcion, categoria_id, unidad_medida, precio_compra)
                VALUES (caller_empresa_id, product_data.sku, product_data.nombre, product_data.marca, product_data.modelo, product_data.descripcion, v_categoria_id, product_data.unidad_medida, product_data.costo_inicial)
                RETURNING id INTO v_producto_id;
                created_count := created_count + 1;
            END IF;

            IF product_data.precio_base IS NOT NULL AND product_data.precio_base > 0 THEN
                v_ganancia := product_data.precio_base - COALESCE((SELECT precio_compra FROM public.productos WHERE id = v_producto_id), 0);
                v_ganancia := GREATEST(0, v_ganancia);

                INSERT INTO public.precios_productos (producto_id, lista_precio_id, precio, ganancia_maxima, ganancia_minima)
                VALUES (v_producto_id, v_default_price_list_id, product_data.precio_base, v_ganancia, v_ganancia)
                ON CONFLICT (producto_id, lista_precio_id) DO UPDATE SET
                    precio = EXCLUDED.precio,
                    ganancia_maxima = EXCLUDED.ganancia_maxima,
                    ganancia_minima = EXCLUDED.ganancia_minima;
            END IF;

        EXCEPTION
            WHEN OTHERS THEN
                error_count := error_count + 1;
                error_messages := array_append(error_messages, 'Fila ' || row_index || ': ' || SQLERRM);
        END;
        row_index := row_index + 1;
    END LOOP;

    -- Insert consolidated audit logs
    IF created_count > 0 THEN
        INSERT INTO public.historial_cambios (usuario_id, usuario_nombre, accion, tabla_afectada, registro_id, datos_anteriores, datos_nuevos, empresa_id)
        VALUES (caller_user_id, 'Importación CSV', 'INSERT (BULK)', 'productos', 'operacion_masiva', NULL, jsonb_build_object('resumen', 'Se crearon ' || created_count || ' productos nuevos mediante importación CSV.'), caller_empresa_id);
    END IF;

    IF updated_count > 0 THEN
        INSERT INTO public.historial_cambios (usuario_id, usuario_nombre, accion, tabla_afectada, registro_id, datos_anteriores, datos_nuevos, empresa_id)
        VALUES (caller_user_id, 'Importación CSV', 'UPDATE (BULK)', 'productos', 'operacion_masiva', NULL, jsonb_build_object('resumen', 'Se actualizaron ' || updated_count || ' productos existentes mediante importación CSV.'), caller_empresa_id);
    END IF;
    
    IF created_categories_count > 0 THEN
        INSERT INTO public.historial_cambios (usuario_id, usuario_nombre, accion, tabla_afectada, registro_id, datos_anteriores, datos_nuevos, empresa_id)
        VALUES (caller_user_id, 'Importación CSV', 'INSERT (BULK)', 'categorias', 'operacion_masiva', NULL, jsonb_build_object('resumen', 'Se crearon ' || created_categories_count || ' categorías nuevas durante la importación.'), caller_empresa_id);
    END IF;

    RETURN json_build_object('created', created_count, 'updated', updated_count, 'errors', error_count, 'error_messages', error_messages);
END;
$$;