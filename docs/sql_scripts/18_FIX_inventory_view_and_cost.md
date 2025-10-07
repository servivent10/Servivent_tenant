-- =============================================================================
-- DATABASE FIX SCRIPT: ENRICH INVENTORY VIEW WITH COST DATA (V3 - Final Stock Fix)
-- =============================================================================
-- Este script actualiza la función principal de carga de productos para que
-- incluya dos campos cruciales para el nuevo módulo de Inventarios:
-- `precio_compra` (Costo Promedio Ponderado) y `stock_minimo`.
--
-- ADEMÁS, CORRIGE DE FORMA DEFINITIVA el error por el cual el `stock_total` no
-- se calculaba correctamente. La subconsulta anterior fue reemplazada por un
-- LEFT JOIN directo y un GROUP BY, que es una forma más robusta de hacer
-- la agregación.
--
-- **INSTRUCCIONES:**
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Eliminar la función antigua
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_company_products_with_stock();
DROP FUNCTION IF EXISTS public.get_company_products_with_stock_and_cost();


-- -----------------------------------------------------------------------------
-- Paso 2: Crear la nueva función `get_company_products_with_stock_and_cost` (CORREGIDA)
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
    stock_minimo numeric,
    unidades_vendidas_90_dias numeric,
    created_at timestamptz
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
        p.id,
        p.nombre,
        p.sku,
        p.marca,
        p.modelo,
        p.categoria_id,
        p.unidad_medida,
        p.descripcion,
        c.nombre as categoria_nombre,
        COALESCE(SUM(i.cantidad), 0) as stock_total, -- **CORRECCIÓN: SUMA DIRECTA**
        COALESCE(i_sucursal.stock_sucursal, 0) as stock_sucursal,
        COALESCE(pp.precio, 0) as precio_base,
        (SELECT img.imagen_url FROM public.imagenes_productos img WHERE img.producto_id = p.id ORDER BY img.orden, img.created_at LIMIT 1) as imagen_principal,
        p.precio_compra,
        COALESCE(SUM(i.stock_minimo), 0) as stock_minimo, -- **CORRECCIÓN: SUMA DIRECTA**
        (
            SELECT COALESCE(SUM(vi.cantidad), 0)
            FROM public.venta_items vi
            JOIN public.ventas v ON vi.venta_id = v.id
            WHERE vi.producto_id = p.id
              AND v.empresa_id = caller_empresa_id
              AND v.fecha >= (now() - interval '90 days')
        ) as unidades_vendidas_90_dias,
        p.created_at
    FROM public.productos p
    LEFT JOIN public.categorias c ON p.categoria_id = c.id
    LEFT JOIN public.inventarios i ON p.id = i.producto_id
    LEFT JOIN (
        SELECT inv_s.producto_id, inv_s.cantidad as stock_sucursal
        FROM public.inventarios inv_s
        WHERE inv_s.sucursal_id = caller_sucursal_id
    ) i_sucursal ON p.id = i_sucursal.producto_id
    LEFT JOIN public.listas_precios lp ON lp.empresa_id = p.empresa_id AND lp.es_predeterminada = true
    LEFT JOIN public.precios_productos pp ON pp.producto_id = p.id AND pp.lista_precio_id = lp.id
    WHERE p.empresa_id = caller_empresa_id
    GROUP BY -- **CORRECCIÓN: GROUP BY para que la suma funcione**
        p.id,
        c.nombre,
        i_sucursal.stock_sucursal,
        pp.precio
    ORDER BY p.created_at DESC;
END;
$function$;

-- =============================================================================
-- Fin del script.
-- =============================================================================
