-- =============================================================================
-- HOTFIX: WEB CATALOG PRICE DISPLAY (V1)
-- =============================================================================
-- This script provides a critical hotfix for the public web catalog, which stopped
-- displaying product prices after the implementation of the new logistics flow.
--
-- PROBLEM:
-- The `get_public_catalog_data` function, modified in script 94, was refactored
-- to use correlated subqueries for fetching prices. This approach proved to be
-- highly inefficient, likely causing timeouts or incorrect data retrieval,
-- resulting in prices appearing as zero in the frontend.
--
-- SOLUTION:
-- This script restores the more performant and robust price-fetching logic from
-- previous versions, which uses `LEFT JOIN` and `GROUP BY` with `MAX(CASE...END)`.
-- It carefully integrates this proven logic with the new `all_branch_stock`
-- feature, ensuring both functionalities work correctly and efficiently. It also
-- fixes an unintentional omission by re-adding `categoria_nombre` to the payload.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor. This will
-- immediately fix the price display issue on the public web catalog.
-- =============================================================================

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

    -- **THE CORRECTED QUERY**: Combines efficient price fetching with new features.
    SELECT json_agg(p_info) INTO products_list FROM (
        SELECT
            p.id, p.nombre, p.sku, p.marca, p.modelo, p.descripcion, p.categoria_id, p.created_at,
            c.nombre as categoria_nombre, -- Re-added
            (SELECT img.imagen_url FROM public.imagenes_productos img WHERE img.producto_id = p.id ORDER BY img.orden, img.created_at LIMIT 1) as imagen_principal,
            (SELECT json_agg(json_build_object('url', img.imagen_url) ORDER BY img.orden) FROM public.imagenes_productos img WHERE img.producto_id = p.id) as imagenes,
            COALESCE((SELECT SUM(i.cantidad) FROM public.inventarios i JOIN public.sucursales s ON i.sucursal_id = s.id WHERE i.producto_id = p.id AND s.tipo = 'Sucursal'), 0) as stock_consolidado,
            (
                SELECT json_agg(json_build_object('id', s.id, 'nombre', s.nombre, 'cantidad', COALESCE(i.cantidad, 0)))
                FROM public.sucursales s
                LEFT JOIN public.inventarios i ON s.id = i.sucursal_id AND i.producto_id = p.id
                WHERE s.empresa_id = v_empresa_id AND s.tipo != 'Depósito'
            ) as all_branch_stock,
            -- Restored efficient price logic using JOIN and GROUP BY
            COALESCE(MAX(CASE WHEN pp.lista_precio_id = v_general_list_id THEN pp.precio END), 0) as precio_base,
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