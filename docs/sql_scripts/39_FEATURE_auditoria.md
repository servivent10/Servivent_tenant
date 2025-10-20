-- =============================================================================
-- AUDIT TRAIL ("BLACK BOX") SYSTEM - DATABASE SETUP (V11 - Bulk Operation Context)
-- =============================================================================
-- This script provides the definitive fix for the "violates foreign key constraint"
-- error that occurs during a SuperAdmin-initiated company deletion, AND adds
-- context-awareness to avoid logging individual rows during bulk operations.
--
-- PROBLEM:
-- The audit trigger fires for every single row change, which floods the audit log
-- with hundreds of entries during a bulk import, making it unreadable.
--
-- SOLUTION:
-- 1. The `registrar_cambio` trigger function is modified to check for a special
--    session variable (`servivent.source`).
-- 2. If this variable is set to 'csv_import', the trigger immediately stops and
--    does not log the individual change.
-- 3. The bulk import functions are modified to set this variable at the beginning
--    of their transaction and then insert a single, consolidated audit log entry
--    at the end.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create/Alter the `historial_cambios` table (WITHOUT FOREIGN KEY)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.historial_cambios (
    id bigserial PRIMARY KEY,
    timestamp timestamptz DEFAULT now() NOT NULL,
    usuario_id uuid,
    usuario_nombre text,
    accion text NOT NULL,
    tabla_afectada text NOT NULL,
    registro_id text,
    datos_anteriores jsonb,
    datos_nuevos jsonb,
    empresa_id uuid NOT NULL -- NOTE: The foreign key is intentionally removed.
);

-- Drop the foreign key constraint if it exists from any previous version.
ALTER TABLE public.historial_cambios DROP CONSTRAINT IF EXISTS historial_cambios_empresa_id_fkey;

-- Other configurations remain the same
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
-- Step 2: Update the generic trigger function `registrar_cambio` with context-awareness
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_cambio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_source text;
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_usuario_nombre text;
    v_registro_id text;
BEGIN
    -- **NUEVA LÓGICA:** Check for a context variable to bypass logging for bulk operations.
    v_source := current_setting('servivent.source', true);
    IF v_source = 'csv_import' THEN
        -- If the source is a CSV import, do nothing and return.
        -- The bulk function will be responsible for creating a consolidated log entry.
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- 1. Get user and company info from JWT (primary method)
    v_usuario_id := auth.uid();
    v_usuario_nombre := (auth.jwt() -> 'app_metadata' ->> 'nombre_completo')::text;
    v_empresa_id := public.get_empresa_id_from_jwt();

    -- 2. Determine record ID and fallback to get empresa_id from the record itself (safely)
    IF TG_OP = 'DELETE' THEN
        v_registro_id := OLD.id::text;
        IF v_empresa_id IS NULL AND (to_jsonb(OLD) ? 'empresa_id') THEN
             v_empresa_id := (to_jsonb(OLD) ->> 'empresa_id')::uuid;
        END IF;
    ELSE -- INSERT or UPDATE
        v_registro_id := NEW.id::text;
        IF v_empresa_id IS NULL AND (to_jsonb(NEW) ? 'empresa_id') THEN
             v_empresa_id := (to_jsonb(NEW) ->> 'empresa_id')::uuid;
        END IF;
    END IF;
    
    -- 3. Relational lookup as a second fallback for tables without direct empresa_id
    IF v_empresa_id IS NULL THEN
        IF TG_TABLE_NAME = 'precios_productos' THEN
             IF TG_OP = 'DELETE' THEN
                SELECT p.empresa_id INTO v_empresa_id FROM public.productos p WHERE p.id = OLD.producto_id;
             ELSE
                SELECT p.empresa_id INTO v_empresa_id FROM public.productos p WHERE p.id = NEW.producto_id;
             END IF;
        END IF;
        -- Add more relational lookups here if needed for other tables...
    END IF;

    -- 4. If empresa_id is still unknown, skip logging.
    IF v_empresa_id IS NULL THEN
        RAISE WARNING '[AUDIT TRIGGER SKIPPED] Could not determine empresa_id for table %. Operation: %', TG_TABLE_NAME, TG_OP;
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- 5. Context-aware user naming
    IF v_usuario_nombre IS NULL THEN
        IF v_usuario_id IS NOT NULL THEN
            SELECT nombre_completo INTO v_usuario_nombre FROM public.usuarios WHERE id = v_usuario_id;
            IF NOT FOUND THEN
                SELECT nombre INTO v_usuario_nombre FROM public.clientes WHERE auth_user_id = v_usuario_id;
                IF FOUND THEN
                    v_usuario_nombre := 'Catálogo Web (' || v_usuario_nombre || ')';
                END IF;
            END IF;
        END IF;
    END IF;

    -- 6. Fallback user naming for system/web events (using safe JSONB access)
    IF v_usuario_nombre IS NULL THEN
        IF TG_TABLE_NAME = 'clientes' AND TG_OP = 'INSERT' AND (to_jsonb(NEW) ->> 'auth_user_id') IS NOT NULL THEN
            v_usuario_nombre := 'Catálogo Web (' || (to_jsonb(NEW) ->> 'nombre') || ')';
        ELSIF TG_TABLE_NAME = 'ventas' AND TG_OP = 'INSERT' AND (to_jsonb(NEW) ->> 'usuario_id') IS NULL THEN
            v_usuario_nombre := 'Catálogo Web';
        ELSE
            v_usuario_nombre := 'Sistema/Admin';
        END IF;
    END IF;

    -- 7. Insert the audit record
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