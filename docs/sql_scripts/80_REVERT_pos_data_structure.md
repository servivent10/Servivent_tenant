-- =============================================================================
-- REVERT SCRIPT FOR: POINT OF SALE DATA STRUCTURE HOTFIX (V1)
-- =============================================================================
-- This script reverts the changes made by `80_HOTFIX_pos_data_structure.md`.
-- It restores the version of the `get_pos_data` function that includes the
-- `clients` array in its return object.
--
-- WARNING: Running this script may re-introduce the critical error on the
-- Point of Sale page. Use it only if you intend to undo the fix.
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_pos_data();
CREATE OR REPLACE FUNCTION get_pos_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_sucursal_id uuid;
    products_list json;
    price_lists_list json;
    clients_list json;
BEGIN
    SELECT u.empresa_id, u.sucursal_id INTO caller_empresa_id, caller_sucursal_id
    FROM public.usuarios u WHERE u.id = auth.uid();

    IF caller_empresa_id IS NULL OR caller_sucursal_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado o no asignado a una sucursal.';
    END IF;

    SELECT json_agg(pl_info) INTO price_lists_list
    FROM (
        SELECT id, nombre, es_predeterminada
        FROM public.listas_precios
        WHERE empresa_id = caller_empresa_id
        ORDER BY es_predeterminada DESC, orden ASC, nombre ASC
    ) AS pl_info;

    SELECT json_agg(c_info) INTO clients_list
    FROM (
        SELECT id, nombre, nit_ci, telefono, avatar_url, auth_user_id
        FROM public.clientes
        WHERE empresa_id = caller_empresa_id
        ORDER BY
          CASE
            WHEN nombre = 'Consumidor Final' THEN 0
            ELSE 1
          END,
          nombre
    ) AS c_info;

    SELECT json_agg(p_info) INTO products_list FROM (
        SELECT
            p.id, p.nombre, p.sku, p.marca, p.modelo, p.descripcion, p.unidad_medida, p.created_at,
            c.nombre as categoria_nombre,
            p.categoria_id,
            (
                SELECT COALESCE(SUM(vi.cantidad), 0)
                FROM public.venta_items vi
                JOIN public.ventas v ON vi.venta_id = v.id
                WHERE vi.producto_id = p.id
                  AND v.empresa_id = caller_empresa_id
                  AND v.fecha >= (now() - interval '90 days')
            ) as unidades_vendidas_90_dias,
            (SELECT img.imagen_url FROM public.imagenes_productos img WHERE img.producto_id = p.id ORDER BY img.orden, img.created_at LIMIT 1) as imagen_principal,
            COALESCE((SELECT i.cantidad FROM public.inventarios i WHERE i.producto_id = p.id AND i.sucursal_id = caller_sucursal_id), 0) as stock_sucursal,
            COALESCE((SELECT i.stock_minimo FROM public.inventarios i WHERE i.producto_id = p.id AND i.sucursal_id = caller_sucursal_id), 0) as stock_minimo_sucursal,
            (
                SELECT json_agg(json_build_object('sucursal_id', s.id, 'sucursal_nombre', s.nombre, 'cantidad', COALESCE(i.cantidad, 0)))
                FROM public.sucursales s
                LEFT JOIN public.inventarios i ON s.id = i.sucursal_id AND i.producto_id = p.id
                WHERE s.empresa_id = caller_empresa_id
            ) as all_branch_stock,
            (
                SELECT json_object_agg(pp.lista_precio_id, json_build_object('precio', pp.precio, 'ganancia_maxima', pp.ganancia_maxima, 'ganancia_minima', pp.ganancia_minima))
                FROM public.precios_productos pp
                WHERE pp.producto_id = p.id
            ) as prices
        FROM public.productos p
        LEFT JOIN public.categorias c ON p.categoria_id = c.id
        WHERE p.empresa_id = caller_empresa_id
        ORDER BY p.nombre ASC
    ) AS p_info;

    RETURN json_build_object(
        'products', COALESCE(products_list, '[]'::json),
        'price_lists', COALESCE(price_lists_list, '[]'::json),
        'clients', COALESCE(clients_list, '[]'::json)
    );
END;
$$;


-- =============================================================================
-- End of revert script.
-- =============================================================================