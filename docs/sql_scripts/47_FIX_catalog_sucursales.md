-- =============================================================================
-- WEB CATALOG FIX: ADD SUCURSALES TO PUBLIC DATA (V1)
-- =============================================================================
-- This script fixes an issue where the public web catalog was not displaying
-- the company's branches because they were not being included in the data payload.
--
-- WHAT IT DOES:
-- 1. Updates the `get_public_catalog_data` RPC function to query and return
--    an array of `sucursales` associated with the company.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- **UPDATED**: Function to get all public data for a catalog, now including branches.
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
    sucursales_list json; -- **NUEVO**
BEGIN
    SELECT id, nombre, logo, moneda INTO v_empresa_record
    FROM public.empresas WHERE slug = p_slug LIMIT 1;

    IF v_empresa_record.id IS NULL THEN
        RAISE EXCEPTION 'Catálogo no encontrado.';
    END IF;
    
    v_empresa_id := v_empresa_record.id;

    -- (Lógica de listas de precios sin cambios)
    SELECT id INTO v_ofertas_web_list_id FROM public.listas_precios WHERE empresa_id = v_empresa_id AND nombre = 'Ofertas Web';
    IF v_ofertas_web_list_id IS NULL THEN
        INSERT INTO public.listas_precios (empresa_id, nombre, descripcion, es_predeterminada, orden)
        VALUES (v_empresa_id, 'Ofertas Web', 'Precios especiales para el catálogo web.', false, 100)
        RETURNING id INTO v_ofertas_web_list_id;
    END IF;
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

    -- (Lógica de productos, categorías y marcas sin cambios)
    SELECT json_agg(p_info) INTO products_list FROM (
        SELECT
            p.id, p.nombre, p.sku, p.marca, p.modelo, p.descripcion, p.categoria_id, c.nombre as categoria_nombre,
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

    SELECT json_agg(cat_info) INTO categories_list FROM (
        SELECT c.id, c.nombre, COUNT(p.id) as product_count FROM public.categorias c JOIN public.productos p ON c.id = p.categoria_id
        WHERE c.empresa_id = v_empresa_id GROUP BY c.id, c.nombre ORDER BY c.nombre
    ) AS cat_info;

    SELECT json_agg(brand_info) INTO brands_list FROM (
        SELECT p.marca as nombre, COUNT(p.id) as product_count FROM public.productos p
        WHERE p.empresa_id = v_empresa_id AND p.marca IS NOT NULL AND p.marca <> '' GROUP BY p.marca ORDER BY p.marca
    ) AS brand_info;

    -- **NUEVA LÓGICA: Obtener sucursales**
    SELECT json_agg(s_info) INTO sucursales_list FROM (
        SELECT id, nombre, direccion, telefono FROM public.sucursales
        WHERE empresa_id = v_empresa_id ORDER BY nombre
    ) AS s_info;

    RETURN json_build_object(
        'company', company_data,
        'products', COALESCE(products_list, '[]'::json),
        'categories', COALESCE(categories_list, '[]'::json),
        'brands', COALESCE(brands_list, '[]'::json),
        'sucursales', COALESCE(sucursales_list, '[]'::json) -- **AÑADIDO A LA RESPUESTA**
    );
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================