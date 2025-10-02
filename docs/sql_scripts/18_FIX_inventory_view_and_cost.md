-- =============================================================================
-- DATABASE FIX SCRIPT: ENRICH INVENTORY VIEW WITH COST DATA
-- =============================================================================
-- Este script actualiza la función principal de carga de productos para que
-- incluya dos campos cruciales para el nuevo módulo de Inventarios:
-- `precio_compra` (Costo Promedio Ponderado) y `stock_minimo`.
--
-- **PROBLEMA:**
-- La función `get_company_products_with_stock` no devolvía el costo del producto,
-- lo que impedía calcular el valor total del inventario. Tampoco devolvía el
-- stock mínimo, necesario para la lógica de "Bajo Stock".
--
-- **SOLUCIÓN:**
-- Se renombra la función a `get_company_products_with_stock_and_cost` para
-- reflejar su nueva capacidad y se añaden los campos faltantes a la consulta.
--
-- **INSTRUCCIONES:**
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

DO $$
BEGIN

-- -----------------------------------------------------------------------------
-- Paso 1: Eliminar la función antigua
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_company_products_with_stock();
RAISE NOTICE 'Paso 1/2: Función obsoleta "get_company_products_with_stock" eliminada.';

-- -----------------------------------------------------------------------------
-- Paso 2: Crear la nueva función `get_company_products_with_stock_and_cost`
-- -----------------------------------------------------------------------------
-- **CAMBIOS:**
-- - Se añade `p.precio_compra` a la lista de selección.
-- - Se calcula `stock_minimo` a nivel de producto como la suma del stock mínimo
--   de todas las sucursales donde está definido.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_company_products_with_stock_and_cost()
RETURNS TABLE (
    id uuid,
    nombre text,
    sku text,
    marca text,
    modelo text,
    categoria_id uuid,
    unidad_medida text,
    descripcion text,
    categoria_nombre text,
    stock_total numeric,
    stock_sucursal numeric,
    precio_base numeric,
    imagen_principal text,
    precio_compra numeric,
    stock_minimo numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    caller_empresa_id uuid;
    caller_sucursal_id uuid;
BEGIN
    SELECT u.empresa_id, u.sucursal_id INTO caller_empresa_id, caller_sucursal_id
    FROM public.usuarios u WHERE u.id = auth.uid();

    IF caller_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado.';
    END IF;

    RETURN QUERY
    SELECT
        p.id, p.nombre, p.sku, p.marca, p.modelo, p.categoria_id, p.unidad_medida, p.descripcion,
        c.nombre as categoria_nombre,
        COALESCE(i.stock_total, 0) as stock_total,
        COALESCE(i_sucursal.stock_sucursal, 0) as stock_sucursal,
        COALESCE(pp.precio, 0) as precio_base,
        (SELECT img.imagen_url FROM public.imagenes_productos img WHERE img.producto_id = p.id ORDER BY img.orden, img.created_at LIMIT 1) as imagen_principal,
        p.precio_compra,
        COALESCE(i.min_stock_total, 0) as stock_minimo
    FROM public.productos p
    LEFT JOIN public.categorias c ON p.categoria_id = c.id
    LEFT JOIN (
        SELECT 
            inv.producto_id, 
            SUM(inv.cantidad) as stock_total, 
            SUM(inv.stock_minimo) as min_stock_total 
        FROM public.inventarios inv 
        GROUP BY inv.producto_id
    ) i ON p.id = i.producto_id
    LEFT JOIN (
        SELECT 
            inv_s.producto_id, 
            inv_s.cantidad as stock_sucursal 
        FROM public.inventarios inv_s 
        WHERE inv_s.sucursal_id = caller_sucursal_id
    ) i_sucursal ON p.id = i_sucursal.producto_id
    LEFT JOIN public.listas_precios lp ON lp.empresa_id = p.empresa_id AND lp.es_predeterminada = true
    LEFT JOIN public.precios_productos pp ON pp.producto_id = p.id AND pp.lista_precio_id = lp.id
    WHERE p.empresa_id = caller_empresa_id
    ORDER BY p.created_at DESC;
END;
$function$;

RAISE NOTICE 'Paso 2/2: Función "get_company_products_with_stock_and_cost" creada/actualizada.';

END $$;
-- =============================================================================
-- Fin del script.
-- =============================================================================