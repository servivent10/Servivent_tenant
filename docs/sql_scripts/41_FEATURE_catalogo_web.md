-- =============================================================================
-- WEB CATALOG FEATURE - DATABASE SETUP (V4 - Full Featured)
-- =============================================================================
-- This script implements the complete backend infrastructure for the public-facing
-- customer web catalog. This version adds image galleries, descriptions, and
-- data for filters (categories & brands).
--
-- WHAT IT DOES:
-- 1.  Adds a `slug` column to the `empresas` table for unique catalog URLs.
-- 2.  Creates new RPC functions:
--     - `check_slug_availability`: For real-time validation in the settings page.
--     - `get_public_catalog_data`: To securely fetch public data, now including offer prices, galleries, and filter data.
--     - `registrar_pedido_web`: To create a pending web order.
-- 3.  Updates `update_company_info` to allow owners to set their `slug`.
-- 4.  Adds new RLS policies and helper functions for a future customer portal.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Modify `empresas` table to add `slug`
-- -----------------------------------------------------------------------------
ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create a unique index to enforce slug uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS empresas_slug_key ON public.empresas (slug);


-- -----------------------------------------------------------------------------
-- Step 2: Update `update_company_info` to include `p_slug` (ROBUST FIX)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_company_info(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.update_company_info(text, text, text, text);
DROP FUNCTION IF EXISTS public.update_company_info(text, text, text);

CREATE OR REPLACE FUNCTION update_company_info(
    p_nombre text,
    p_nit text,
    p_logo text,
    p_modo_caja text,
    p_slug text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
BEGIN
    SELECT empresa_id, rol INTO caller_empresa_id, caller_rol
    FROM public.usuarios WHERE id = auth.uid();

    IF caller_rol != 'Propietario' THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de Propietario.';
    END IF;

    UPDATE public.empresas
    SET
        nombre = p_nombre,
        nit = p_nit,
        logo = p_logo,
        modo_caja = p_modo_caja,
        slug = p_slug
    WHERE id = caller_empresa_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 3: New RPC functions for the Web Catalog
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_slug_availability(p_slug text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN NOT EXISTS (SELECT 1 FROM public.empresas WHERE slug = p_slug);
END;
$$;


-- **UPDATED**: Function to get all public data for a catalog, now with offer prices, galleries, and filter data
CREATE OR REPLACE FUNCTION get_public_catalog_data(p_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_empresa_id uuid;
    v_empresa_record record;
    v_ofertas_web_list_id uuid;
    v_general_list_id uuid;
    company_data json;
    products_list json;
    categories_list json;
    brands_list json;
BEGIN
    SELECT id, nombre, logo, moneda INTO v_empresa_record
    FROM public.empresas WHERE slug = p_slug LIMIT 1;

    IF v_empresa_record.id IS NULL THEN
        RAISE EXCEPTION 'Catálogo no encontrado.';
    END IF;
    
    v_empresa_id := v_empresa_record.id;

    -- Find or create the "Ofertas Web" price list
    SELECT id INTO v_ofertas_web_list_id FROM public.listas_precios WHERE empresa_id = v_empresa_id AND nombre = 'Ofertas Web';
    IF v_ofertas_web_list_id IS NULL THEN
        INSERT INTO public.listas_precios (empresa_id, nombre, descripcion, es_predeterminada, orden)
        VALUES (v_empresa_id, 'Ofertas Web', 'Precios especiales para el catálogo web.', false, 100)
        RETURNING id INTO v_ofertas_web_list_id;
    END IF;

    -- Find the "General" price list
    SELECT id INTO v_general_list_id FROM public.listas_precios WHERE empresa_id = v_empresa_id AND es_predeterminada = true;

    company_data := json_build_object(
        'nombre', v_empresa_record.nombre,
        'logo', v_empresa_record.logo,
        'moneda_simbolo', 
            CASE v_empresa_record.moneda
                WHEN 'BOB' THEN 'Bs'
                WHEN 'USD' THEN '$'
                ELSE v_empresa_record.moneda
            END
    );

    SELECT json_agg(p_info) INTO products_list FROM (
        SELECT
            p.id,
            p.nombre,
            p.sku,
            p.marca,
            p.modelo,
            p.descripcion,
            p.categoria_id,
            c.nombre as categoria_nombre,
            (SELECT img.imagen_url FROM public.imagenes_productos img WHERE img.producto_id = p.id ORDER BY img.orden, img.created_at LIMIT 1) as imagen_principal,
            (SELECT json_agg(json_build_object('url', img.imagen_url) ORDER BY img.orden) FROM public.imagenes_productos img WHERE img.producto_id = p.id) as imagenes,
            COALESCE((SELECT SUM(i.cantidad) FROM public.inventarios i WHERE i.producto_id = p.id), 0) as stock_consolidado,
            COALESCE((SELECT pp.precio FROM public.precios_productos pp WHERE pp.producto_id = p.id AND pp.lista_precio_id = v_general_list_id), 0) as precio_base,
            COALESCE((SELECT pp.precio FROM public.precios_productos pp WHERE pp.producto_id = p.id AND pp.lista_precio_id = v_ofertas_web_list_id), 0) as precio_oferta
        FROM public.productos p
        LEFT JOIN public.categorias c ON p.categoria_id = c.id
        WHERE p.empresa_id = v_empresa_id
        ORDER BY p.nombre
    ) AS p_info;

    -- NEW: Fetch categories with product counts
    SELECT json_agg(cat_info) INTO categories_list FROM (
        SELECT 
            c.id, 
            c.nombre, 
            COUNT(p.id) as product_count
        FROM public.categorias c
        JOIN public.productos p ON c.id = p.categoria_id
        WHERE c.empresa_id = v_empresa_id
        GROUP BY c.id, c.nombre
        ORDER BY c.nombre
    ) AS cat_info;

    -- NEW: Fetch brands with product counts
    SELECT json_agg(brand_info) INTO brands_list FROM (
        SELECT 
            p.marca as nombre, 
            COUNT(p.id) as product_count
        FROM public.productos p
        WHERE p.empresa_id = v_empresa_id AND p.marca IS NOT NULL AND p.marca <> ''
        GROUP BY p.marca
        ORDER BY p.marca
    ) AS brand_info;


    RETURN json_build_object(
        'company', company_data,
        'products', COALESCE(products_list, '[]'::json),
        'categories', COALESCE(categories_list, '[]'::json),
        'brands', COALESCE(brands_list, '[]'::json)
    );
END;
$$;

DROP TYPE IF EXISTS public.web_order_item_input CASCADE;
CREATE TYPE public.web_order_item_input AS (
    producto_id uuid,
    cantidad integer,
    precio_unitario numeric
);

-- **UPDATED**: Function to register a web order with new customer data and corrected parameter order
DROP FUNCTION IF EXISTS public.registrar_pedido_web(text, text, web_order_item_input[]);
DROP FUNCTION IF EXISTS public.registrar_pedido_web(text, text, web_order_item_input[], text, text);
DROP FUNCTION IF EXISTS public.registrar_pedido_web(text, text, text, web_order_item_input[], text);

CREATE OR REPLACE FUNCTION registrar_pedido_web(
    p_cliente_email text,
    p_cliente_nombre text,
    p_cliente_telefono text,
    p_items web_order_item_input[],
    p_slug text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_empresa_id uuid;
    v_cliente_id uuid;
    v_total numeric := 0;
    v_subtotal numeric := 0;
    item web_order_item_input;
    new_venta_id uuid;
    next_folio_number integer;
BEGIN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = p_slug;
    IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Catálogo no encontrado.'; END IF;

    -- Find client by email
    SELECT id INTO v_cliente_id FROM public.clientes WHERE email = p_cliente_email AND empresa_id = v_empresa_id;

    -- If client does not exist and a name was provided (new client registration)
    IF v_cliente_id IS NULL AND p_cliente_nombre IS NOT NULL THEN
        INSERT INTO public.clientes (empresa_id, nombre, email, telefono)
        VALUES (v_empresa_id, p_cliente_nombre, p_cliente_email, p_cliente_telefono)
        RETURNING id INTO v_cliente_id;
    -- If client does not exist and no name was provided (existing client with typo)
    ELSIF v_cliente_id IS NULL AND p_cliente_nombre IS NULL THEN
        INSERT INTO public.clientes (empresa_id, nombre, email)
        VALUES (v_empresa_id, p_cliente_email, p_cliente_email) -- Create a placeholder
        RETURNING id INTO v_cliente_id;
    END IF;
    
    -- If client still not found (safeguard)
    IF v_cliente_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo identificar o crear al cliente.';
    END IF;

    -- Calculate totals
    FOREACH item IN ARRAY p_items LOOP
        v_subtotal := v_subtotal + (item.cantidad * item.precio_unitario);
    END LOOP;
    v_total := v_subtotal;

    -- Get next folio number
    SELECT COALESCE(MAX(substring(folio from 7)::integer), 0) + 1 
    INTO next_folio_number 
    FROM public.ventas WHERE empresa_id = v_empresa_id;

    -- Create the 'venta' record
    INSERT INTO public.ventas (
        empresa_id, sucursal_id, cliente_id, usuario_id, folio, fecha, total, subtotal, 
        metodo_pago, tipo_venta, estado_pago, saldo_pendiente
    ) VALUES (
        v_empresa_id, 
        (SELECT id FROM public.sucursales WHERE empresa_id = v_empresa_id ORDER BY created_at LIMIT 1),
        v_cliente_id,
        NULL, -- No user associated with a web order initially
        'VENTA-' || lpad(next_folio_number::text, 5, '0'),
        now(), v_total, v_subtotal,
        'Web', 'Contado', 'Pedido Web Pendiente', v_total
    ) RETURNING id INTO new_venta_id;

    -- Insert sale items
    FOREACH item IN ARRAY p_items LOOP
        INSERT INTO public.venta_items (venta_id, producto_id, cantidad, precio_unitario_aplicado, costo_unitario_en_venta)
        VALUES (
            new_venta_id, item.producto_id, item.cantidad, item.precio_unitario,
            COALESCE((SELECT precio_compra FROM public.productos WHERE id = item.producto_id), 0)
        );
    END LOOP;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 4: Update `get_user_profile_data` to return slug
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_profile_data();
CREATE OR REPLACE FUNCTION get_user_profile_data()
RETURNS table (
    empresa_id uuid,
    empresa_nombre text,
    empresa_logo text,
    empresa_nit text,
    empresa_timezone text,
    empresa_moneda text,
    empresa_modo_caja text,
    empresa_slug text,
    plan_actual text,
    estado_licencia text,
    fecha_fin_licencia date,
    nombre_completo text,
    rol text,
    avatar text,
    sucursal_id uuid,
    sucursal_principal_nombre text,
    historial_pagos json
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.empresa_id,
        e.nombre AS empresa_nombre,
        e.logo AS empresa_logo,
        e.nit AS empresa_nit,
        e.timezone AS empresa_timezone,
        e.moneda AS empresa_moneda,
        e.modo_caja AS empresa_modo_caja,
        e.slug as empresa_slug,
        l.tipo_licencia AS plan_actual,
        l.estado AS estado_licencia,
        l.fecha_fin AS fecha_fin_licencia,
        u.nombre_completo,
        u.rol,
        u.avatar,
        u.sucursal_id,
        s.nombre AS sucursal_principal_nombre,
        (SELECT json_agg(p) FROM (SELECT id, monto, fecha_pago, metodo_pago, notas FROM pagos_licencia pl WHERE pl.empresa_id = u.empresa_id ORDER BY fecha_pago DESC) p) as historial_pagos
    FROM
        usuarios u
    LEFT JOIN
        empresas e ON u.empresa_id = e.id
    LEFT JOIN
        licencias l ON u.empresa_id = l.empresa_id
    LEFT JOIN
        sucursales s ON u.sucursal_id = s.id
    WHERE
        u.id = auth.uid();
END;
$$;

-- =============================================================================
-- End of script.
-- =============================================================================