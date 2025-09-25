-- =============================================================================
-- CATEGORIES MANAGEMENT FUNCTIONS
-- =============================================================================
-- Este script crea las funciones PostgreSQL necesarias para el nuevo módulo
-- de gestión de Categorías de productos.
--
-- **INSTRUCCIONES:**
-- Por favor, ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Función 1: Obtener todas las categorías con su contador de productos
-- -----------------------------------------------------------------------------
-- Descripción:
-- Recupera la lista de todas las categorías de la empresa del usuario, y para
-- cada una, cuenta cuántos productos están asignados a ella.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_all_categories_with_product_count()
RETURNS TABLE (
    id uuid,
    nombre text,
    product_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
BEGIN
    -- Obtener el empresa_id del usuario que llama a la función
    SELECT u.empresa_id INTO caller_empresa_id FROM public.usuarios u WHERE u.id = auth.uid();

    IF caller_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: Usuario no encontrado.';
    END IF;

    -- Devolver la lista de categorías con el conteo de productos
    RETURN QUERY
    SELECT
        c.id,
        c.nombre,
        COUNT(p.id) AS product_count
    FROM
        public.categorias c
    LEFT JOIN
        public.productos p ON c.id = p.categoria_id
    WHERE
        c.empresa_id = caller_empresa_id
    GROUP BY
        c.id
    ORDER BY
        c.nombre;
END;
$$;

-- -----------------------------------------------------------------------------
-- Función 2: Crear o actualizar una categoría (Upsert)
-- -----------------------------------------------------------------------------
-- Descripción:
-- Crea una nueva categoría si p_id es NULL, o actualiza el nombre de una
-- existente si se proporciona un p_id.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_category(
    p_id uuid,
    p_nombre text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
BEGIN
    -- Obtener el empresa_id del usuario que llama a la función
    SELECT u.empresa_id INTO caller_empresa_id FROM public.usuarios u WHERE u.id = auth.uid();

    IF p_id IS NULL THEN
        -- Crear una nueva categoría
        INSERT INTO public.categorias(empresa_id, nombre)
        VALUES (caller_empresa_id, p_nombre);
    ELSE
        -- Actualizar una categoría existente
        UPDATE public.categorias
        SET nombre = p_nombre
        WHERE id = p_id AND empresa_id = caller_empresa_id;
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Función 3: Eliminar una categoría
-- -----------------------------------------------------------------------------
-- Descripción:
-- Elimina una categoría, pero solo si no tiene productos asignados. Esto
-- previene la creación de datos "huérfanos" y mantiene la integridad.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_category(
    p_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    product_count int;
BEGIN
    -- Obtener el empresa_id del usuario y validar permisos
    SELECT u.empresa_id INTO caller_empresa_id FROM public.usuarios u WHERE u.id = auth.uid();
    IF NOT EXISTS (SELECT 1 FROM public.categorias WHERE id = p_id AND empresa_id = caller_empresa_id) THEN
        RAISE EXCEPTION 'Categoría no encontrada o no pertenece a tu empresa.';
    END IF;

    -- Comprobar si hay productos asignados a esta categoría
    SELECT COUNT(*) INTO product_count FROM public.productos WHERE categoria_id = p_id;
    IF product_count > 0 THEN
        RAISE EXCEPTION 'No se puede eliminar una categoría que tiene productos asignados. Reasigna los productos primero.';
    END IF;

    -- Si no hay productos, proceder con la eliminación
    DELETE FROM public.categorias WHERE id = p_id;
END;
$$;


-- =============================================================================
-- Fin del script.
-- =============================================================================