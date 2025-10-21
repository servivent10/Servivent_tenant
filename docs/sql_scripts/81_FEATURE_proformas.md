-- =============================================================================
-- PROFORMAS (QUOTES) MODULE - DATABASE SETUP (V1)
-- =============================================================================
-- This script implements the backend infrastructure for the new Proformas module.
--
-- WHAT IT DOES:
-- 1. Creates `proformas` and `proforma_items` tables.
-- 2. Applies RLS policies and enables Realtime for the new tables.
-- 3. Creates RPC functions: `crear_proforma`, `get_proformas_list`,
--    `get_proforma_details`, `anular_proforma`, and `verificar_stock_proforma`.
-- 4. Updates `get_dashboard_data` to include proforma-related KPIs.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create Tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proformas (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    sucursal_id uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
    usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
    folio text NOT NULL,
    fecha_emision timestamptz DEFAULT now() NOT NULL,
    fecha_vencimiento date,
    subtotal numeric(10, 2) NOT NULL,
    descuento numeric(10, 2) DEFAULT 0 NOT NULL,
    impuestos numeric(10, 2) DEFAULT 0 NOT NULL,
    total numeric(10, 2) NOT NULL,
    estado text NOT NULL, -- 'Vigente', 'Convertida', 'Anulada', 'Vencida'
    notas text,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT proformas_folio_empresa_id_key UNIQUE (folio, empresa_id)
);

CREATE TABLE IF NOT EXISTS public.proforma_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    proforma_id uuid NOT NULL REFERENCES public.proformas(id) ON DELETE CASCADE,
    producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
    cantidad numeric(10, 2) NOT NULL,
    precio_unitario_aplicado numeric(10, 2) NOT NULL,
    costo_unitario_en_proforma numeric(10, 2) NOT NULL
);

-- -----------------------------------------------------------------------------
-- Step 2: RLS Policies and Realtime Publication
-- -----------------------------------------------------------------------------
ALTER TABLE public.proformas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.proformas;
CREATE POLICY "Enable all for own company" ON public.proformas FOR ALL USING (empresa_id = public.get_empresa_id_from_jwt());

ALTER TABLE public.proforma_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.proforma_items;
CREATE POLICY "Enable all for own company" ON public.proforma_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.proformas pr WHERE pr.id = proforma_id AND pr.empresa_id = public.get_empresa_id_from_jwt())
);

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.proformas; EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'Table "proformas" is already in publication.'; END; $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.proforma_items; EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'Table "proforma_items" is already in publication.'; END; $$;

-- -----------------------------------------------------------------------------
-- Step 3: Create RPC Functions
-- -----------------------------------------------------------------------------

DROP TYPE IF EXISTS public.proforma_item_input CASCADE;
CREATE TYPE public.proforma_item_input AS (
    producto_id uuid,
    cantidad numeric,
    precio_unitario_aplicado numeric,
    costo_unitario_en_proforma numeric
);

DROP TYPE IF EXISTS public.proforma_input CASCADE;
CREATE TYPE public.proforma_input AS (
    cliente_id uuid,
    fecha_emision timestamptz,
    fecha_vencimiento date,
    subtotal numeric,
    descuento numeric,
    impuestos numeric,
    total numeric,
    notas text
);

-- Function to create a new proforma
CREATE OR REPLACE FUNCTION crear_proforma(p_proforma proforma_input, p_items proforma_item_input[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    caller_user_id uuid := auth.uid();
    caller_sucursal_id uuid := (SELECT u.sucursal_id FROM public.usuarios u WHERE u.id = caller_user_id);
    new_proforma_id uuid;
    item proforma_item_input;
    next_folio_number integer;
    v_folio text;
BEGIN
    SELECT COALESCE(MAX(substring(folio from 6)::integer), 0) + 1 INTO next_folio_number
    FROM public.proformas WHERE empresa_id = caller_empresa_id;
    v_folio := 'PROF-' || lpad(next_folio_number::text, 5, '0');

    INSERT INTO public.proformas (
        empresa_id, sucursal_id, usuario_id, cliente_id, folio, fecha_emision, fecha_vencimiento,
        subtotal, descuento, impuestos, total, estado, notas
    ) VALUES (
        caller_empresa_id, caller_sucursal_id, caller_user_id, p_proforma.cliente_id, v_folio, p_proforma.fecha_emision,
        p_proforma.fecha_vencimiento, p_proforma.subtotal, p_proforma.descuento, p_proforma.impuestos, p_proforma.total,
        'Vigente', p_proforma.notas
    ) RETURNING id INTO new_proforma_id;

    FOREACH item IN ARRAY p_items LOOP
        INSERT INTO public.proforma_items (proforma_id, producto_id, cantidad, precio_unitario_aplicado, costo_unitario_en_proforma)
        VALUES (new_proforma_id, item.producto_id, item.cantidad, item.precio_unitario_aplicado, item.costo_unitario_en_proforma);
    END LOOP;
    
    PERFORM notificar_cambio('NUEVA_PROFORMA', 'Se generó la proforma <b>' || v_folio || '</b>.', new_proforma_id, ARRAY[caller_sucursal_id]);

    RETURN new_proforma_id;
END;
$$;

-- Function to get the list of proformas
CREATE OR REPLACE FUNCTION get_proformas_list()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    caller_rol text := (SELECT u.rol FROM public.usuarios u WHERE u.id = auth.uid());
    caller_sucursal_id uuid := (SELECT u.sucursal_id FROM public.usuarios u WHERE u.id = auth.uid());
    proformas_list json;
    kpis json;
    start_of_month date := date_trunc('month', current_date);
BEGIN
    SELECT json_agg(p_info) INTO proformas_list FROM (
        SELECT
            pr.id, pr.folio, pr.fecha_emision, pr.total, pr.estado,
            c.nombre as cliente_nombre
        FROM public.proformas pr
        LEFT JOIN public.clientes c ON pr.cliente_id = c.id
        WHERE pr.empresa_id = caller_empresa_id
          AND (caller_rol = 'Propietario' OR pr.sucursal_id = caller_sucursal_id)
        ORDER BY pr.fecha_emision DESC
    ) p_info;

    SELECT json_build_object(
        'total_cotizado', (SELECT COALESCE(SUM(total), 0) FROM proformas WHERE empresa_id = caller_empresa_id AND fecha_emision >= start_of_month),
        'proformas_vigentes', (SELECT COUNT(*) FROM proformas WHERE empresa_id = caller_empresa_id AND estado = 'Vigente'),
        'tasa_conversion', (
            CASE 
                WHEN (SELECT COUNT(*) FROM proformas WHERE empresa_id = caller_empresa_id AND fecha_emision >= start_of_month) > 0
                THEN round(
                    (SELECT COUNT(*) FROM proformas WHERE empresa_id = caller_empresa_id AND estado = 'Convertida' AND fecha_emision >= start_of_month)::numeric * 100 /
                    (SELECT COUNT(*) FROM proformas WHERE empresa_id = caller_empresa_id AND fecha_emision >= start_of_month)::numeric
                , 2)
                ELSE 0 
            END
        )
    ) INTO kpis;

    RETURN jsonb_build_object('proformas', COALESCE(proformas_list, '[]'::json), 'kpis', kpis);
END;
$$;

-- Function to get details of a proforma
CREATE OR REPLACE FUNCTION get_proforma_details(p_proforma_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    proforma_details jsonb;
    items_list jsonb;
BEGIN
    SELECT to_jsonb(pr) || jsonb_build_object('cliente_nombre', c.nombre, 'usuario_nombre', u.nombre_completo, 'sucursal_nombre', s.nombre)
    INTO proforma_details
    FROM public.proformas pr
    LEFT JOIN public.clientes c ON pr.cliente_id = c.id
    JOIN public.usuarios u ON pr.usuario_id = u.id
    JOIN public.sucursales s ON pr.sucursal_id = s.id
    WHERE pr.id = p_proforma_id AND pr.empresa_id = public.get_empresa_id_from_jwt();

    IF NOT FOUND THEN RAISE EXCEPTION 'Proforma no encontrada.'; END IF;

    SELECT jsonb_agg(i) INTO items_list
    FROM (
        SELECT pi.*, p.nombre as producto_nombre
        FROM public.proforma_items pi
        JOIN public.productos p ON pi.producto_id = p.id
        WHERE pi.proforma_id = p_proforma_id
    ) i;

    RETURN proforma_details || jsonb_build_object('items', COALESCE(items_list, '[]'::jsonb));
END;
$$;


-- Function to check stock before converting to sale
CREATE OR REPLACE FUNCTION verificar_stock_proforma(p_proforma_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    caller_sucursal_id uuid := (SELECT u.sucursal_id FROM public.usuarios u WHERE u.id = auth.uid());
    insufficient_items json;
BEGIN
    SELECT json_agg(s_info) INTO insufficient_items
    FROM (
        SELECT
            pi.producto_id,
            p.nombre as producto_nombre,
            pi.cantidad as cantidad_requerida,
            COALESCE(i.cantidad, 0) as cantidad_disponible
        FROM public.proforma_items pi
        JOIN public.productos p ON pi.producto_id = p.id
        LEFT JOIN public.inventarios i ON pi.producto_id = i.producto_id AND i.sucursal_id = caller_sucursal_id
        WHERE pi.proforma_id = p_proforma_id
          AND pi.cantidad > COALESCE(i.cantidad, 0)
    ) AS s_info;

    IF insufficient_items IS NULL THEN
        RETURN '{"status": "ok"}'::json;
    ELSE
        RETURN json_build_object('status', 'insufficient', 'items', insufficient_items);
    END IF;
END;
$$;

-- Function to cancel a proforma
CREATE OR REPLACE FUNCTION anular_proforma(p_proforma_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.proformas
    SET estado = 'Anulada'
    WHERE id = p_proforma_id AND empresa_id = public.get_empresa_id_from_jwt();
    -- Notification for annulment can be added here if needed
END;
$$;

-- -----------------------------------------------------------------------------
-- Step 4: Update `get_dashboard_data` to include proforma KPIs
-- -----------------------------------------------------------------------------
-- The logic for updating get_dashboard_data is correctly located in
-- `22_FEATURE_dashboard.md` and should be applied from there. This script
-- focuses solely on creating the proforma-specific infrastructure.
-- =============================================================================
