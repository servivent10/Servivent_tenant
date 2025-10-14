-- =============================================================================
-- CUSTOMER PORTAL: ORDER DETAILS - DATABASE SETUP
-- =============================================================================
-- This script adds the backend functionality for customers to view the details
-- of their specific orders.
--
-- WHAT IT DOES:
-- 1. Creates `get_my_web_order_details`: A secure RPC function that fetches
--    the details of a single order, ensuring the order belongs to the currently
--    logged-in customer.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create the RPC function `get_my_web_order_details`
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_web_order_details(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cliente_id uuid;
    order_details jsonb;
    items_list json;
BEGIN
    -- 1. Get the authenticated client's ID
    SELECT id INTO v_cliente_id
    FROM public.clientes
    WHERE auth_user_id = auth.uid() LIMIT 1;

    IF v_cliente_id IS NULL THEN
        RAISE EXCEPTION 'Perfil de cliente no encontrado.';
    END IF;

    -- 2. Fetch the main order details, ensuring it belongs to the client
    SELECT to_jsonb(v) || jsonb_build_object('cliente_nombre', c.nombre)
    INTO order_details
    FROM public.ventas v
    JOIN public.clientes c ON v.cliente_id = c.id
    WHERE v.id = p_pedido_id AND v.cliente_id = v_cliente_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido no encontrado o no tienes permiso para verlo.';
    END IF;

    -- 3. Fetch order items with their product images
    SELECT json_agg(i) INTO items_list
    FROM (
        SELECT 
            vi.*, 
            p.nombre as producto_nombre,
            (SELECT img.imagen_url FROM public.imagenes_productos img WHERE img.producto_id = vi.producto_id ORDER BY img.orden, img.created_at LIMIT 1) as imagen_principal
        FROM public.venta_items vi 
        JOIN public.productos p ON vi.producto_id = p.id 
        WHERE vi.venta_id = p_pedido_id
    ) i;

    -- 4. Combine and return
    RETURN order_details || jsonb_build_object('items', COALESCE(items_list, '[]'::json));
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================