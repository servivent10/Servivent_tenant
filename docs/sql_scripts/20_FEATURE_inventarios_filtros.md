-- =============================================================================
-- INVENTORY FILTERS DATA FUNCTION
-- =============================================================================
-- Este script crea la función `get_inventory_filter_data`, que es necesaria para
-- poblar los nuevos filtros avanzados en la página de Gestión de Inventarios.
--
-- **INSTRUCCIONES:**
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Función: get_inventory_filter_data
-- -----------------------------------------------------------------------------
-- Descripción:
-- Recupera una lista de todas las categorías y todas las marcas únicas
-- de los productos de la empresa del usuario actual. Esto se usa para
-- construir los menús desplegables de los filtros avanzados.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_inventory_filter_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid());
    categories_list json;
    brands_list json;
BEGIN
    -- Obtener la lista de categorías
    SELECT json_agg(c) INTO categories_list FROM (
        SELECT id, nombre FROM public.categorias WHERE empresa_id = caller_empresa_id ORDER BY nombre
    ) c;

    -- Obtener la lista de marcas únicas
    SELECT json_agg(b) INTO brands_list FROM (
        SELECT DISTINCT marca as nombre FROM public.productos 
        WHERE empresa_id = caller_empresa_id AND marca IS NOT NULL AND marca <> '' ORDER BY nombre
    ) b;

    RETURN json_build_object(
        'categories', COALESCE(categories_list, '[]'::json),
        'brands', COALESCE(brands_list, '[]'::json)
    );
END;
$$;


-- =============================================================================
-- Fin del script.
-- =============================================================================