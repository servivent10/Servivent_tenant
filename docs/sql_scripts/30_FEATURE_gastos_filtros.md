-- =============================================================================
-- EXPENSES FILTERS DATA FUNCTION
-- =============================================================================
-- Este script crea la función `get_gastos_filter_data`, que es necesaria para
-- poblar los nuevos filtros avanzados en la página de Gestión de Gastos.
--
-- INSTRUCCIONES:
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Función: get_gastos_filter_data
-- -----------------------------------------------------------------------------
-- Descripción:
-- Recupera una lista de todas las categorías de gastos, todos los usuarios y
-- todas las sucursales de la empresa del usuario actual. Esto se usa para
-- construir los menús desplegables de los filtros avanzados.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_gastos_filter_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    categories_list json;
    users_list json;
    branches_list json;
BEGIN
    -- Obtener la lista de categorías de gastos
    SELECT json_agg(c) INTO categories_list FROM (
        SELECT id, nombre FROM public.gastos_categorias WHERE empresa_id = caller_empresa_id ORDER BY nombre
    ) c;

    -- Obtener la lista de usuarios
    SELECT json_agg(u) INTO users_list FROM (
        SELECT id, nombre_completo FROM public.usuarios WHERE empresa_id = caller_empresa_id ORDER BY nombre_completo
    ) u;
    
    -- Obtener la lista de sucursales
    SELECT json_agg(s) INTO branches_list FROM (
        SELECT id, nombre FROM public.sucursales WHERE empresa_id = caller_empresa_id ORDER BY nombre
    ) s;

    RETURN json_build_object(
        'categories', COALESCE(categories_list, '[]'::json),
        'users', COALESCE(users_list, '[]'::json),
        'branches', COALESCE(branches_list, '[]'::json)
    );
END;
$$;


-- =============================================================================
-- Fin del script.
-- =============================================================================