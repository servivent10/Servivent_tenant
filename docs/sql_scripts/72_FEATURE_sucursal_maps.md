-- =============================================================================
-- SUCURSAL LOCATION MANAGEMENT WITH MAPS - DATABASE SETUP (V3 - Offer Price Logic Fix)
-- =============================================================================
-- This script implements the backend infrastructure for managing branch
-- locations using geographic coordinates (latitude and longitude).
-- VERSION 3: Refactors the `get_public_catalog_data` function again to robustly
-- enforce business rules for "Ofertas Web", fixing a critical bug where
-- inactive offers were still being displayed.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor. It is idempotent
-- and safe to run multiple times.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Add latitude and longitude columns to the sucursales table
-- -----------------------------------------------------------------------------
ALTER TABLE public.sucursales ADD COLUMN IF NOT EXISTS latitud numeric(10, 7);
ALTER TABLE public.sucursales ADD COLUMN IF NOT EXISTS longitud numeric(10, 7);


-- -----------------------------------------------------------------------------
-- Step 2: Update RPC Functions
-- -----------------------------------------------------------------------------

-- create_sucursal
DROP FUNCTION IF EXISTS public.create_sucursal(text, text, text, numeric, numeric);
CREATE OR REPLACE FUNCTION create_sucursal(p_nombre text, p_direccion text, p_telefono text, p_latitud numeric, p_longitud numeric, p_tipo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    new_sucursal_id uuid;
BEGIN
    INSERT INTO public.sucursales(empresa_id, nombre, direccion, telefono, latitud, longitud, tipo)
    VALUES (public.get_empresa_id_from_jwt(), p_nombre, p_direccion, p_telefono, p_latitud, p_longitud, p_tipo)
    RETURNING id INTO new_sucursal_id;
    RETURN new_sucursal_id;
END;
$$;

-- update_sucursal
DROP FUNCTION IF EXISTS public.update_sucursal(uuid, text, text, text, numeric, numeric);
CREATE OR REPLACE FUNCTION update_sucursal(p_sucursal_id uuid, p_nombre text, p_direccion text, p_telefono text, p_latitud numeric, p_longitud numeric, p_tipo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.sucursales SET nombre = p_nombre, direccion = p_direccion, telefono = p_telefono, latitud = p_latitud, longitud = p_longitud, tipo = p_tipo
    WHERE id = p_sucursal_id AND empresa_id = public.get_empresa_id_from_jwt();
END;
$$;

-- get_company_sucursales
DROP FUNCTION IF EXISTS public.get_company_sucursales();
CREATE OR REPLACE FUNCTION get_company_sucursales()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_empresa_id uuid; caller_rol text; caller_sucursal_id uuid; sucursales_list json; kpis json;
BEGIN
    SELECT empresa_id, rol, sucursal_id INTO caller_empresa_id, caller_rol, caller_sucursal_id FROM public.usuarios WHERE id = auth.uid();
    IF caller_rol IS NULL THEN RAISE EXCEPTION 'Acceso denegado: Usuario no encontrado.'; END IF;
    IF caller_rol = 'Propietario' THEN
        SELECT json_agg(s_info) INTO sucursales_list FROM (
            SELECT s.id, s.nombre, s.direccion, s.telefono, s.latitud, s.longitud, s.tipo,
                (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = s.id) as user_count
            FROM sucursales s
            WHERE s.empresa_id = caller_empresa_id ORDER BY s.nombre
        ) AS s_info;
        SELECT json_build_object(
            'total_sucursales', (SELECT COUNT(*) FROM sucursales WHERE empresa_id = caller_empresa_id),
            'total_empleados', (SELECT COUNT(*) FROM usuarios WHERE empresa_id = caller_empresa_id)
        ) INTO kpis;
    ELSE
        SELECT json_build_object('user_sucursal_id', caller_sucursal_id) INTO sucursales_list;
        kpis := '{}'::json;
    END IF;
    RETURN json_build_object('sucursales', COALESCE(sucursales_list, '[]'::json), 'kpis', kpis);
END;
$$;

-- get_sucursal_details
DROP FUNCTION IF EXISTS public.get_sucursal_details(uuid);
CREATE OR REPLACE FUNCTION get_sucursal_details(p_sucursal_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sucursal_details json; users_list json; kpis json;
BEGIN
    SELECT to_json(s) INTO sucursal_details FROM (SELECT id, nombre, direccion, telefono, latitud, longitud, tipo FROM sucursales WHERE id = p_sucursal_id) s;
    SELECT json_agg(u) INTO users_list FROM (SELECT id, nombre_completo, correo, rol, avatar, created_at, sucursal_id FROM usuarios WHERE sucursal_id = p_sucursal_id ORDER BY rol, nombre_completo) u;
    SELECT json_build_object('total_company_users', (SELECT COUNT(*) FROM public.usuarios WHERE empresa_id = public.get_empresa_id_from_jwt())) INTO kpis;
    RETURN json_build_object('details', sucursal_details, 'users', COALESCE(users_list, '[]'::json), 'kpis', kpis);
END;
$$;

-- **REFACTORED**: Function to get public catalog data with robust price fetching and offer logic.
DROP FUNCTION IF EXISTS public.get_public_catalog_data(text);
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
    sucursales_list json;
BEGIN
    SELECT id, nombre, logo, moneda INTO v_empresa_record
    FROM public.empresas WHERE slug = p_slug LIMIT 1;

    IF v_empresa_record.id IS NULL THEN RAISE EXCEPTION 'Catálogo no encontrado.'; END IF;
    v_empresa_id := v_empresa_record.id;

    -- Find "Ofertas Web" and "General" price lists
    SELECT id INTO v_ofertas_web_list_id FROM public.listas_precios WHERE empresa_id = v_empresa_id AND nombre = 'Ofertas Web';
    SELECT id INTO v_general_list_id FROM public.listas_precios WHERE empresa_id = v_empresa_id AND es_predeterminada = true;
    
    -- Auto-create "Ofertas Web" if it doesn't exist
    IF v_ofertas_web_list_id IS NULL THEN
        INSERT INTO public.listas_precios (empresa_id, nombre, descripcion, es_predeterminada, orden)
        VALUES (v_empresa_id, 'Ofertas Web', 'Precios especiales para el catálogo web.', false, 100)
        RETURNING id INTO v_ofertas_web_list_id;
    END IF;

    company_data := json_build_object(
        'nombre', v_empresa_record.nombre, 'logo', v_empresa_record.logo,
        'moneda_simbolo', CASE v_empresa_record.moneda WHEN 'BOB' THEN 'Bs' WHEN 'USD' THEN '$' ELSE v_empresa_record.moneda END
    );

    -- **REFACTORED QUERY**: Use LEFT JOINs and conditional aggregation with gain check.
    SELECT json_agg(p_info) INTO products_list FROM (
        SELECT
            p.id, p.nombre, p.sku, p.marca, p.modelo, p.descripcion, p.categoria_id, c.nombre as categoria_nombre,
            (SELECT img.imagen_url FROM public.imagenes_productos img WHERE img.producto_id = p.id ORDER BY img.orden, img.created_at LIMIT 1) as imagen_principal,
            (SELECT json_agg(json_build_object('url', img.imagen_url) ORDER BY img.orden) FROM public.imagenes_productos img WHERE img.producto_id = p.id) as imagenes,
            COALESCE((SELECT SUM(i.cantidad) FROM public.inventarios i WHERE i.producto_id = p.id), 0) as stock_consolidado,
            -- Use MAX with CASE to pivot the prices from the joined table
            COALESCE(MAX(CASE WHEN pp.lista_precio_id = v_general_list_id THEN pp.precio END), 0) as precio_base,
            -- **THE FIX IS HERE**: Only select the offer price if its max gain is > 0
            COALESCE(MAX(CASE WHEN pp.lista_precio_id = v_ofertas_web_list_id AND pp.ganancia_maxima > 0 THEN pp.precio END), 0) as precio_oferta
        FROM public.productos p
        LEFT JOIN public.categorias c ON p.categoria_id = c.id
        LEFT JOIN public.precios_productos pp ON p.id = pp.producto_id
        WHERE p.empresa_id = v_empresa_id
        GROUP BY p.id, c.nombre
        ORDER BY p.nombre
    ) AS p_info;

    -- Fetch categories, brands, and branches (unchanged)
    SELECT json_agg(cat_info) INTO categories_list FROM (
        SELECT c.id, c.nombre, COUNT(p.id) as product_count FROM public.categorias c JOIN public.productos p ON c.id = p.categoria_id
        WHERE c.empresa_id = v_empresa_id GROUP BY c.id, c.nombre ORDER BY c.nombre
    ) AS cat_info;
    SELECT json_agg(brand_info) INTO brands_list FROM (
        SELECT p.marca as nombre, COUNT(p.id) as product_count FROM public.productos p
        WHERE p.empresa_id = v_empresa_id AND p.marca IS NOT NULL AND p.marca <> '' GROUP BY p.marca ORDER BY p.marca
    ) AS brand_info;
    SELECT json_agg(s_info) INTO sucursales_list FROM (
        SELECT id, nombre, direccion, telefono, latitud, longitud FROM public.sucursales
        WHERE empresa_id = v_empresa_id AND tipo = 'Sucursal' ORDER BY nombre
    ) AS s_info;

    RETURN json_build_object(
        'company', company_data,
        'products', COALESCE(products_list, '[]'::json),
        'categories', COALESCE(categories_list, '[]'::json),
        'brands', COALESCE(brands_list, '[]'::json),
        'sucursales', COALESCE(sucursales_list, '[]'::json)
    );
END;
$$;

-- =============================================================================
-- End of script.
-- =============================================================================