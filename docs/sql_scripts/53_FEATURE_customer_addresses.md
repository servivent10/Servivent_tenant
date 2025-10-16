-- =============================================================================
-- CUSTOMER ADDRESS MANAGEMENT FEATURE - DATABASE SETUP (V3 - Notification Fix)
-- =============================================================================
-- This script implements the complete backend infrastructure for the customer
-- address management feature, including maps and integration into the checkout flow.
-- VERSION 3: Fixes the notification system for web orders by inserting the
-- notification directly, bypassing the tenant-centric helper function.
--
-- WHAT IT DOES:
-- 1. Creates the `direcciones_clientes` table to store customer addresses.
-- 2. Applies RLS policies and enables Realtime for the new table.
-- 3. Adds `direccion_entrega_id` to the `ventas` table.
-- 4. Creates RPC functions: `get_my_direcciones`, `upsert_direccion`, `delete_direccion`.
-- 5. Updates `registrar_pedido_web` to handle both delivery/pickup and to
--    insert a detailed notification directly.
-- 6. Updates `get_sale_details` to include delivery address information.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create the `direcciones_clientes` table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.direcciones_clientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nombre text NOT NULL,
    direccion_texto text,
    latitud numeric(10, 7) NOT NULL,
    longitud numeric(10, 7) NOT NULL,
    es_principal boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- -----------------------------------------------------------------------------
-- Step 2: RLS Policies and Realtime Publication
-- -----------------------------------------------------------------------------
ALTER TABLE public.direcciones_clientes ENABLE ROW LEVEL SECURITY;

-- Policy for customers to manage their own addresses
DROP POLICY IF EXISTS "Customers can manage their own addresses" ON public.direcciones_clientes;
CREATE POLICY "Customers can manage their own addresses"
ON public.direcciones_clientes FOR ALL
USING (cliente_id = (SELECT id FROM public.clientes WHERE auth_user_id = auth.uid() LIMIT 1));

-- Policy for employees to view addresses within their company (read-only)
DROP POLICY IF EXISTS "Employees can view company addresses" ON public.direcciones_clientes;
CREATE POLICY "Employees can view company addresses"
ON public.direcciones_clientes FOR SELECT
USING (empresa_id = public.get_empresa_id_from_jwt());

-- Add to Realtime publication
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direcciones_clientes;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Table "direcciones_clientes" is already in the publication.';
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 3: Modify the `ventas` table
-- -----------------------------------------------------------------------------
ALTER TABLE public.ventas
ADD COLUMN IF NOT EXISTS direccion_entrega_id uuid REFERENCES public.direcciones_clientes(id) ON DELETE SET NULL;


-- -----------------------------------------------------------------------------
-- Step 4: Create RPC Functions for Address Management
-- -----------------------------------------------------------------------------

-- Function for a customer to get their own addresses
CREATE OR REPLACE FUNCTION get_my_direcciones()
RETURNS SETOF public.direcciones_clientes
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cliente_id uuid;
BEGIN
    SELECT id INTO v_cliente_id FROM public.clientes WHERE auth_user_id = auth.uid() LIMIT 1;
    
    IF v_cliente_id IS NOT NULL THEN
        RETURN QUERY
        SELECT * FROM public.direcciones_clientes
        WHERE cliente_id = v_cliente_id
        ORDER BY es_principal DESC, created_at ASC;
    END IF;
END;
$$;

-- Function to create or update an address
CREATE OR REPLACE FUNCTION upsert_direccion(
    p_id uuid,
    p_nombre text,
    p_direccion_texto text,
    p_latitud numeric,
    p_longitud numeric,
    p_es_principal boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cliente_id uuid;
    v_empresa_id uuid;
    v_direccion_id uuid;
BEGIN
    SELECT id, empresa_id INTO v_cliente_id, v_empresa_id FROM public.clientes WHERE auth_user_id = auth.uid() LIMIT 1;

    IF v_cliente_id IS NULL THEN
        RAISE EXCEPTION 'Cliente no encontrado.';
    END IF;

    -- If this address is being marked as principal, unmark all others for this client
    IF p_es_principal THEN
        UPDATE public.direcciones_clientes
        SET es_principal = false
        WHERE cliente_id = v_cliente_id
          AND (p_id IS NULL OR id != p_id);
    END IF;

    IF p_id IS NULL THEN
        -- Create new address
        INSERT INTO public.direcciones_clientes (cliente_id, empresa_id, nombre, direccion_texto, latitud, longitud, es_principal)
        VALUES (v_cliente_id, v_empresa_id, p_nombre, p_direccion_texto, p_latitud, p_longitud, p_es_principal)
        RETURNING id INTO v_direccion_id;
    ELSE
        -- Update existing address
        UPDATE public.direcciones_clientes
        SET
            nombre = p_nombre,
            direccion_texto = p_direccion_texto,
            latitud = p_latitud,
            longitud = p_longitud,
            es_principal = p_es_principal
        WHERE id = p_id AND cliente_id = v_cliente_id;
        v_direccion_id := p_id;
    END IF;

    RETURN v_direccion_id;
END;
$$;

-- Function to delete an address
CREATE OR REPLACE FUNCTION delete_direccion(p_direccion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cliente_id uuid;
BEGIN
    SELECT id INTO v_cliente_id FROM public.clientes WHERE auth_user_id = auth.uid() LIMIT 1;

    IF v_cliente_id IS NOT NULL THEN
        DELETE FROM public.direcciones_clientes
        WHERE id = p_direccion_id AND cliente_id = v_cliente_id;
    ELSE
        RAISE EXCEPTION 'Cliente no encontrado.';
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Step 5: Update related RPC functions
-- -----------------------------------------------------------------------------

-- **REFACTORED**: Unified function to register a web order with direct notification.
DROP FUNCTION IF EXISTS public.registrar_pedido_web(text, text, text, web_order_item_input[], text, uuid);
DROP FUNCTION IF EXISTS public.registrar_pedido_web(text, text, text, web_order_item_input[], text, uuid, uuid);
DROP FUNCTION IF EXISTS public.registrar_pedido_web(text, web_order_item_input[], uuid, uuid);
CREATE OR REPLACE FUNCTION registrar_pedido_web(
    p_slug text,
    p_items web_order_item_input[],
    p_direccion_id uuid DEFAULT NULL,
    p_sucursal_id_retiro uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_empresa_id uuid;
    v_cliente_id uuid;
    v_cliente_nombre text;
    v_cliente_telefono text;
    v_sucursal_id_for_sale uuid; -- The branch assigned to the sale record
    v_sucursal_ids_for_notif uuid[]; -- Branches to notify
    v_total numeric := 0;
    v_subtotal numeric := 0;
    item web_order_item_input;
    new_venta_id uuid;
    next_folio_number integer;
    v_folio text;
    v_notif_mensaje text;
    v_delivery_info text;
BEGIN
    -- 1. Get company and authenticated client
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = p_slug;
    IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Catálogo no encontrado.'; END IF;

    SELECT id, nombre, telefono INTO v_cliente_id, v_cliente_nombre, v_cliente_telefono FROM public.clientes WHERE auth_user_id = auth.uid() AND empresa_id = v_empresa_id;
    IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Cliente no autenticado o no encontrado para esta empresa.'; END IF;
    
    -- 2. Determine the handling branch and notification targets based on delivery method
    IF p_direccion_id IS NOT NULL THEN -- Home Delivery
        v_sucursal_id_for_sale := NULL; -- Belongs to the whole company, visible to all applicable users
        v_sucursal_ids_for_notif := NULL; -- Notify all branches (NULL means global for the company)
        v_delivery_info := 'para envío a domicilio.';
    ELSIF p_sucursal_id_retiro IS NOT NULL THEN -- Store Pickup
        v_sucursal_id_for_sale := p_sucursal_id_retiro; -- Belongs to specific branch
        v_sucursal_ids_for_notif := ARRAY[p_sucursal_id_retiro]; -- Notify only that branch
        v_delivery_info := 'para recojo en <b>' || (SELECT nombre FROM sucursales WHERE id = p_sucursal_id_retiro) || '</b>.';
    ELSE
        RAISE EXCEPTION 'El pedido debe ser para envío a domicilio o para retiro en sucursal.';
    END IF;

    -- 3. Calculate totals
    FOREACH item IN ARRAY p_items LOOP
        v_subtotal := v_subtotal + (item.cantidad * item.precio_unitario);
    END LOOP;
    v_total := v_subtotal;

    -- 4. Get next folio number
    SELECT COALESCE(MAX(substring(folio from 7)::integer), 0) + 1 
    INTO next_folio_number 
    FROM public.ventas WHERE empresa_id = v_empresa_id;
    v_folio := 'VENTA-' || lpad(next_folio_number::text, 5, '0');

    -- 5. Create the 'venta' record with the correct sucursal_id
    INSERT INTO public.ventas (
        empresa_id, sucursal_id, cliente_id, usuario_id, folio, fecha, total, subtotal, 
        descuento, impuestos, metodo_pago, tipo_venta, estado_pago, saldo_pendiente, direccion_entrega_id
    ) VALUES (
        v_empresa_id, v_sucursal_id_for_sale, v_cliente_id, NULL, v_folio, now(), v_total, v_subtotal,
        0, 0, 'Pedido Web', 'Contado', 'Pedido Web Pendiente', v_total, p_direccion_id
    ) RETURNING id INTO new_venta_id;

    -- 6. Insert sale items
    FOREACH item IN ARRAY p_items LOOP
        INSERT INTO public.venta_items (venta_id, producto_id, cantidad, precio_unitario_aplicado, costo_unitario_en_venta)
        VALUES (
            new_venta_id, item.producto_id, item.cantidad, item.precio_unitario,
            COALESCE((SELECT precio_compra FROM public.productos WHERE id = item.producto_id), 0)
        );
    END LOOP;
    
    -- 7. Generate context-aware notification DIRECTLY
    v_notif_mensaje := format(
        'Nuevo pedido <b>%s</b> desde el catálogo web del cliente <b>%s</b>, %s',
        v_folio,
        v_cliente_nombre,
        v_delivery_info
    );

    INSERT INTO public.notificaciones (
        empresa_id,
        usuario_generador_id,
        usuario_generador_nombre,
        mensaje,
        tipo_evento,
        entidad_id,
        sucursales_destino_ids
    ) VALUES (
        v_empresa_id,
        auth.uid(),
        'Catálogo Web',
        v_notif_mensaje,
        'NUEVA_VENTA',
        new_venta_id,
        v_sucursal_ids_for_notif -- Use the correct notification target
    );

END;
$$;


-- Update `get_sale_details` to join and return address and branch info, and fix payments query
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
BEGIN
    SELECT to_jsonb(v) || jsonb_build_object(
        'cliente_nombre', c.nombre, 
        'usuario_nombre', u.nombre_completo,
        'sucursal_nombre', s.nombre
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
    
    -- **FIX**: Correctly query `pagos_ventas` instead of `pagos_compras`
    SELECT json_agg(p) INTO payments_list FROM (SELECT * FROM public.pagos_ventas WHERE venta_id = p_venta_id ORDER BY fecha_pago) p;

    -- Fetch delivery address if it exists
    SELECT to_json(da) INTO address_data
    FROM public.direcciones_clientes da
    WHERE da.id = (sale_details->>'direccion_entrega_id')::uuid;

    RETURN sale_details || jsonb_build_object(
        'items', COALESCE(items_list, '[]'::json),
        'pagos', COALESCE(payments_list, '[]'::json),
        'direccion_entrega', address_data
    );
END;
$$;

-- =============================================================================
-- End of script.
-- =============================================================================