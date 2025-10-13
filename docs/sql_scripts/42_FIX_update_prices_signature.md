-- =============================================================================
-- DATABASE FIX SCRIPT: Resolve update_product_prices Signature Mismatch
-- =============================================================================
-- This script fixes a "function not found" error that occurs when saving
-- product prices from the Product Detail page.
--
-- PROBLEM:
-- The Supabase client library sometimes reorders named parameters alphabetically
-- when making an RPC call. The frontend calls `update_product_prices` with
-- parameters `p_precios` and `p_producto_id`. Alphabetically, `p_precios` comes
-- first. However, the database function was defined with `p_producto_id` as the
-- first parameter, causing a signature mismatch that PostgREST cannot resolve.
--
-- SOLUTION:
-- This script drops the existing function and recreates it with the parameter
-- order swapped to match the order PostgREST expects, resolving the error.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Drop the existing function with the old parameter order
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_product_prices(p_producto_id uuid, p_precios public.price_rule_input[]);


-- -----------------------------------------------------------------------------
-- Step 2: Recreate the function with the corrected parameter order
-- -----------------------------------------------------------------------------
-- The new signature is `(p_precios price_rule_input[], p_producto_id uuid)`
-- The function body remains the same, as it uses named parameters internally.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_product_prices(
    p_precios public.price_rule_input[],
    p_producto_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    caller_empresa_id uuid;
    product_cost numeric;
    new_price numeric;
    price_item public.price_rule_input;
BEGIN
    caller_empresa_id := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid());

    IF NOT EXISTS (SELECT 1 FROM public.productos WHERE id = p_producto_id AND empresa_id = caller_empresa_id) THEN
        RAISE EXCEPTION 'Producto no encontrado o no pertenece a tu empresa.';
    END IF;

    SELECT precio_compra INTO product_cost FROM public.productos WHERE id = p_producto_id;
    product_cost := COALESCE(product_cost, 0);

    FOREACH price_item IN ARRAY p_precios LOOP
        new_price := product_cost + price_item.ganancia_maxima;

        INSERT INTO public.precios_productos(producto_id, lista_precio_id, ganancia_maxima, ganancia_minima, precio)
        VALUES(p_producto_id, price_item.lista_id, price_item.ganancia_maxima, price_item.ganancia_minima, new_price)
        ON CONFLICT (producto_id, lista_precio_id) DO UPDATE SET
            ganancia_maxima = EXCLUDED.ganancia_maxima,
            ganancia_minima = EXCLUDED.ganancia_minima,
            precio = EXCLUDED.precio,
            updated_at = now();
    END LOOP;
END;
$$;


-- =============================================================================
-- End of script. The error when saving prices should now be resolved.
-- =============================================================================