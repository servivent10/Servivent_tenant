-- =============================================================================
-- REVERT SCRIPT FOR: WEB CATALOG PRICE DISPLAY HOTFIX (V1)
-- =============================================================================
-- This script reverts the changes made by `95_HOTFIX_catalog_prices.md`.
-- It restores the version of the `get_public_catalog_data` function from
-- script `94`, which contained the inefficient subqueries that caused the
-- price display issue.
--
-- WARNING: Running this script will re-introduce the bug that prevents prices
-- from showing correctly in the public web catalog. Use it only if you intend
-- to undo the fix.
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_public_catalog_data(text);
CREATE OR REPLACE FUNCTION get_public_catalog_data(p_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_empresa_id uuid; sucursales_list json; company_data json; products_list json; categories_list json; brands_list json;
BEGIN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = p_slug;
    IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Catálogo no encontrado.'; END IF;
    
    SELECT json_agg(s_info) INTO sucursales_list FROM (
        SELECT id, nombre, direccion, telefono, latitud, longitud FROM public.sucursales
        WHERE empresa_id = v_empresa_id AND tipo = 'Sucursal' ORDER BY nombre
    ) AS s_info;
    
    SELECT to_jsonb(e) into company_data FROM empresas e WHERE id = v_empresa_id;

    SELECT json_agg(p_info) INTO products_list FROM (
        SELECT
            p.id, p.nombre, p.sku, p.marca, p.modelo, p.descripcion, p.categoria_id, p.created_at,
            (
                SELECT json_agg(json_build_object('id', s.id, 'nombre', s.nombre, 'cantidad', COALESCE(i.cantidad, 0)))
                FROM public.sucursales s
                LEFT JOIN public.inventarios i ON s.id = i.sucursal_id AND i.producto_id = p.id
                WHERE s.empresa_id = v_empresa_id AND s.tipo != 'Depósito'
            ) as all_branch_stock,
            COALESCE((SELECT pp.precio FROM public.precios_productos pp JOIN public.listas_precios lp ON pp.lista_precio_id = lp.id WHERE pp.producto_id = p.id AND lp.es_predeterminada = true), 0) as precio_base,
            COALESCE((SELECT pp.precio FROM public.precios_productos pp JOIN public.listas_precios lp ON pp.lista_precio_id = lp.id WHERE pp.producto_id = p.id AND lp.nombre = 'Ofertas Web' AND pp.ganancia_maxima > 0), 0) as precio_oferta,
            (SELECT img.imagen_url FROM public.imagenes_productos img WHERE img.producto_id = p.id ORDER BY img.orden LIMIT 1) as imagen_principal
        FROM public.productos p
        WHERE p.empresa_id = v_empresa_id
    ) AS p_info;

    SELECT json_agg(c) into categories_list FROM categorias c WHERE empresa_id = v_empresa_id;
    SELECT json_agg(b) into brands_list FROM (SELECT DISTINCT marca as nombre FROM productos WHERE empresa_id = v_empresa_id AND marca IS NOT NULL) b;

    RETURN json_build_object('company', company_data, 'products', products_list, 'categories', categories_list, 'brands', brands_list, 'sucursales', sucursales_list);
END;
$$;


-- =============================================================================
-- End of revert script.
-- =============================================================================