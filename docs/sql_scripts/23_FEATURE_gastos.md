-- =============================================================================
-- EXPENSES (GASTOS) MODULE - DATABASE SETUP (V2 - Filtering)
-- =============================================================================
-- Este script actualiza la lógica de negocio para el módulo de Gestión de Gastos,
-- añadiendo capacidades de filtrado avanzadas a la función principal.
--
-- INSTRUCCIONES:
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Creación de Tablas (sin cambios, idempotente)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gastos_categorias (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nombre text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT gastos_categorias_empresa_id_nombre_key UNIQUE (empresa_id, nombre)
);

CREATE TABLE IF NOT EXISTS public.gastos (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    sucursal_id uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
    usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    categoria_id uuid REFERENCES public.gastos_categorias(id) ON DELETE SET NULL,
    concepto text NOT NULL,
    monto numeric(10, 2) NOT NULL,
    fecha date NOT NULL,
    comprobante_url text,
    created_at timestamptz DEFAULT now() NOT NULL
);


-- -----------------------------------------------------------------------------
-- Paso 2: Políticas RLS (sin cambios, idempotente)
-- -----------------------------------------------------------------------------
ALTER TABLE public.gastos_categorias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.gastos_categorias;
CREATE POLICY "Enable all for own company" ON public.gastos_categorias FOR ALL USING (empresa_id = public.get_empresa_id_from_jwt());

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.gastos;
CREATE POLICY "Enable all for own company" ON public.gastos FOR ALL USING (empresa_id = public.get_empresa_id_from_jwt());


-- -----------------------------------------------------------------------------
-- Paso 3: Funciones RPC (Lógica de Negocio) - **ACTUALIZADAS**
-- -----------------------------------------------------------------------------

-- Función para obtener categorías de gastos (sin cambios)
CREATE OR REPLACE FUNCTION get_gastos_categorias() RETURNS TABLE (id uuid, nombre text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN RETURN QUERY SELECT c.id, c.nombre FROM public.gastos_categorias c WHERE c.empresa_id = public.get_empresa_id_from_jwt() ORDER BY c.nombre; END; $$;

-- Función upsert de categoría de gasto (sin cambios)
CREATE OR REPLACE FUNCTION upsert_gasto_categoria(p_id uuid, p_nombre text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE caller_empresa_id uuid := public.get_empresa_id_from_jwt(); BEGIN IF p_id IS NULL THEN INSERT INTO public.gastos_categorias(empresa_id, nombre) VALUES (caller_empresa_id, p_nombre); ELSE UPDATE public.gastos_categorias SET nombre = p_nombre WHERE id = p_id AND empresa_id = caller_empresa_id; END IF; END; $$;

-- Función delete de categoría de gasto (sin cambios)
CREATE OR REPLACE FUNCTION delete_gasto_categoria(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE caller_empresa_id uuid := public.get_empresa_id_from_jwt(); BEGIN IF EXISTS (SELECT 1 FROM public.gastos WHERE categoria_id = p_id AND empresa_id = caller_empresa_id) THEN RAISE EXCEPTION 'No se puede eliminar. La categoría está siendo usada por uno o más gastos.'; END IF; DELETE FROM public.gastos_categorias WHERE id = p_id AND empresa_id = caller_empresa_id; END; $$;

-- **FUNCIÓN ACTUALIZADA:** `get_company_gastos` ahora acepta filtros
CREATE OR REPLACE FUNCTION get_company_gastos(
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_category_ids uuid[] DEFAULT NULL,
    p_user_ids uuid[] DEFAULT NULL,
    p_sucursal_ids uuid[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    gastos_list json;
    stats_data json;
BEGIN
    SELECT json_agg(g_info) INTO gastos_list FROM (
        SELECT g.id, g.concepto, g.monto, g.fecha, g.comprobante_url, g.categoria_id, gc.nombre as categoria_nombre
        FROM public.gastos g
        LEFT JOIN public.gastos_categorias gc ON g.categoria_id = gc.id
        WHERE g.empresa_id = caller_empresa_id
          AND (p_start_date IS NULL OR g.fecha >= p_start_date)
          AND (p_end_date IS NULL OR g.fecha <= p_end_date)
          AND (p_category_ids IS NULL OR array_length(p_category_ids, 1) IS NULL OR g.categoria_id = ANY(p_category_ids))
          AND (p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL OR g.usuario_id = ANY(p_user_ids))
          AND (p_sucursal_ids IS NULL OR array_length(p_sucursal_ids, 1) IS NULL OR g.sucursal_id = ANY(p_sucursal_ids))
        ORDER BY g.fecha DESC, g.created_at DESC
    ) g_info;

    SELECT json_build_object(
        'total', COALESCE(SUM(g.monto), 0),
        'count', COALESCE(COUNT(g.*), 0)
    ) INTO stats_data
    FROM public.gastos g
    WHERE g.empresa_id = caller_empresa_id
      AND (p_start_date IS NULL OR g.fecha >= p_start_date)
      AND (p_end_date IS NULL OR g.fecha <= p_end_date)
      AND (p_category_ids IS NULL OR array_length(p_category_ids, 1) IS NULL OR g.categoria_id = ANY(p_category_ids))
      AND (p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL OR g.usuario_id = ANY(p_user_ids))
      AND (p_sucursal_ids IS NULL OR array_length(p_sucursal_ids, 1) IS NULL OR g.sucursal_id = ANY(p_sucursal_ids));

    RETURN json_build_object(
        'gastos', COALESCE(gastos_list, '[]'::json),
        'stats', stats_data
    );
END;
$$;


-- Función upsert de gasto (sin cambios)
CREATE OR REPLACE FUNCTION upsert_gasto(p_id uuid, p_concepto text, p_monto numeric, p_fecha date, p_categoria_id uuid, p_comprobante_url text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE caller_empresa_id uuid := public.get_empresa_id_from_jwt(); caller_user_id uuid := auth.uid(); caller_sucursal_id uuid := (SELECT u.sucursal_id FROM public.usuarios u WHERE u.id = caller_user_id); BEGIN IF p_id IS NULL THEN INSERT INTO public.gastos(empresa_id, sucursal_id, usuario_id, concepto, monto, fecha, categoria_id, comprobante_url) VALUES (caller_empresa_id, caller_sucursal_id, caller_user_id, p_concepto, p_monto, p_fecha, p_categoria_id, p_comprobante_url); ELSE UPDATE public.gastos SET concepto = p_concepto, monto = p_monto, fecha = p_fecha, categoria_id = p_categoria_id, comprobante_url = p_comprobante_url WHERE id = p_id AND empresa_id = caller_empresa_id; END IF; END; $$;

-- Función delete de gasto (sin cambios)
CREATE OR REPLACE FUNCTION delete_gasto(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN DELETE FROM public.gastos WHERE id = p_id AND empresa_id = public.get_empresa_id_from_jwt(); END; $$;


-- -----------------------------------------------------------------------------
-- Paso 4: Publicación de Realtime (sin cambios, idempotente)
-- -----------------------------------------------------------------------------
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.gastos; EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'La tabla "gastos" ya está en la publicación.'; END; $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.gastos_categorias; EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'La tabla "gastos_categorias" ya está en la publicación.'; END; $$;

-- =============================================================================
-- Fin del script.
-- =============================================================================