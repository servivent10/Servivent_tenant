-- =============================================================================
-- AUDIT TRAIL ("BLACK BOX") SYSTEM - DATABASE SETUP (V3 - Web Catalog Context)
-- =============================================================================
-- This script implements the complete backend for the audit trail system.
-- VERSION 3 enhances the trigger function to correctly identify and label
-- actions originating from the unauthenticated web catalog, such as new client
-- sign-ups.
--
-- WHAT IT DOES:
-- 1.  Creates the `historial_cambios` table to store audit logs.
-- 2.  Creates a generic trigger function `registrar_cambio()` that now detects
--     when a new client is created without a session and labels the actor as
--     'Catálogo Web'.
-- 3.  Applies this trigger to all critical business tables.
-- 4.  Creates an RPC function `get_historial_cambios()` for the frontend.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor. It's safe to run
-- multiple times.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create the `historial_cambios` table (no changes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.historial_cambios (
    id bigserial PRIMARY KEY,
    timestamp timestamptz DEFAULT now() NOT NULL,
    usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    usuario_nombre text,
    accion text NOT NULL,
    tabla_afectada text NOT NULL,
    registro_id text NOT NULL,
    datos_anteriores jsonb,
    datos_nuevos jsonb,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_historial_cambios_empresa_id_timestamp ON public.historial_cambios (empresa_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_historial_cambios_tabla_afectada ON public.historial_cambios (tabla_afectada);
CREATE INDEX IF NOT EXISTS idx_historial_cambios_usuario_id ON public.historial_cambios (usuario_id);

ALTER TABLE public.historial_cambios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.historial_cambios;
CREATE POLICY "Enable all for own company" ON public.historial_cambios
FOR ALL USING (empresa_id = public.get_empresa_id_from_jwt());

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.historial_cambios;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Table "historial_cambios" is already in the publication.';
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 2: Create the generic trigger function `registrar_cambio` (UPDATED)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_cambio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_usuario_nombre text;
    v_registro_id text;
BEGIN
    v_usuario_id := auth.uid();
    v_usuario_nombre := (auth.jwt() -> 'app_metadata' ->> 'nombre_completo')::text;
    v_empresa_id := public.get_empresa_id_from_jwt();

    -- Fallback for server-side operations where a JWT might not be present.
    IF v_empresa_id IS NULL THEN
        IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
            v_empresa_id := NEW.empresa_id;
        ELSIF TG_OP = 'DELETE' THEN
            v_empresa_id := OLD.empresa_id;
        END IF;
    END IF;

    -- If after all attempts, empresa_id is still null, we cannot create an audit log.
    IF v_empresa_id IS NULL THEN
        RAISE WARNING '[AUDIT TRIGGER SKIPPED] Could not determine empresa_id for table %. Operation: %', TG_TABLE_NAME, TG_OP;
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Determine the ID of the record being changed
    IF TG_OP = 'DELETE' THEN
        v_registro_id := OLD.id::text;
    ELSE
        v_registro_id := NEW.id::text;
    END IF;

    -- **CONTEXT-AWARE USER NAMING**
    -- If user name is null (e.g., in a server context without a JWT), determine the actor.
    IF v_usuario_nombre IS NULL THEN
        IF v_usuario_id IS NOT NULL THEN
             SELECT nombre_completo INTO v_usuario_nombre FROM public.usuarios WHERE id = v_usuario_id;
        END IF;
        IF v_usuario_nombre IS NULL THEN
            -- Check for the specific case of a new client signing up from the web catalog
            IF TG_TABLE_NAME = 'clientes' AND TG_OP = 'INSERT' THEN
                v_usuario_nombre := 'Catálogo Web';
            ELSE
                v_usuario_nombre := 'Sistema/Admin'; -- Fallback for other system operations
            END IF;
        END IF;
    END IF;

    INSERT INTO public.historial_cambios (
        usuario_id, usuario_nombre, accion, tabla_afectada, registro_id,
        datos_anteriores, datos_nuevos, empresa_id
    ) VALUES (
        v_usuario_id, v_usuario_nombre, TG_OP, TG_TABLE_NAME, v_registro_id,
        to_jsonb(OLD), to_jsonb(NEW), v_empresa_id
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 3: Apply the trigger to all critical tables (no changes)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN
        VALUES
            ('productos'), ('precios_productos'), ('clientes'), ('proveedores'),
            ('sucursales'), ('usuarios'), ('gastos'), ('ventas'), ('compras'),
            ('categorias'), ('gastos_categorias'), ('listas_precios')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS on_%I_change ON public.%I;', table_name, table_name);
        EXECUTE format('
            CREATE TRIGGER on_%I_change
            AFTER INSERT OR UPDATE OR DELETE ON public.%I
            FOR EACH ROW EXECUTE FUNCTION public.registrar_cambio();
        ', table_name, table_name);
        RAISE NOTICE 'Audit trigger applied to table: %', table_name;
    END LOOP;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 4: Create RPC function for the frontend (no changes)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_historial_cambios(
    p_start_date date,
    p_end_date date,
    p_timezone text,
    p_user_ids uuid[] DEFAULT NULL,
    p_tables text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    v_start_utc timestamptz := (p_start_date::timestamp AT TIME ZONE p_timezone);
    v_end_utc timestamptz := ((p_end_date + interval '1 day')::timestamp AT TIME ZONE p_timezone);
    history_list json;
    filter_options json;
BEGIN
    SELECT json_agg(h_info) INTO history_list
    FROM (
        SELECT
            h.id, h.timestamp, h.usuario_nombre, h.accion, h.tabla_afectada,
            h.registro_id, h.datos_anteriores, h.datos_nuevos, u.avatar
        FROM public.historial_cambios h
        LEFT JOIN public.usuarios u ON h.usuario_id = u.id
        WHERE h.empresa_id = caller_empresa_id
          AND h.timestamp >= v_start_utc
          AND h.timestamp < v_end_utc
          AND (p_user_ids IS NULL OR h.usuario_id = ANY(p_user_ids))
          AND (p_tables IS NULL OR h.tabla_afectada = ANY(p_tables))
        ORDER BY h.timestamp DESC
        LIMIT 200
    ) h_info;

    SELECT json_build_object(
        'usuarios', (SELECT json_agg(u_opts) FROM (SELECT id, nombre_completo FROM public.usuarios WHERE empresa_id = caller_empresa_id ORDER BY nombre_completo) u_opts)
    ) INTO filter_options;

    RETURN jsonb_build_object(
        'history', COALESCE(history_list, '[]'::json),
        'filterOptions', filter_options
    );
END;
$$;

-- =============================================================================
-- End of script.
-- =============================================================================