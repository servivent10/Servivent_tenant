-- =============================================================================
-- PROFORMA INTELLIGENT LOGISTICS FLOW - V1
-- =============================================================================
-- This script implements the backend infrastructure for the new intelligent
-- logistics flow, allowing users to request stock transfers from other branches
-- and streamlining the transfer creation process for the recipient.
--
-- WHAT IT DOES:
-- 1. Creates the `solicitudes_traspaso` table to log transfer requests.
-- 2. Changes `notificar_cambio` to `SECURITY INVOKER` to guarantee instant
--    real-time notifications, resolving the delay issue.
-- 3. Updates `solicitar_traspaso_desde_proforma` to register the request in
--    the new table and generate a smarter notification.
-- 4. Creates `get_solicitud_traspaso_details` for the frontend to fetch data
--    and pre-fill the new transfer form.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create the `solicitudes_traspaso` table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.solicitudes_traspaso (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    proforma_id uuid NOT NULL REFERENCES public.proformas(id) ON DELETE CASCADE,
    sucursal_origen_id uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
    sucursal_destino_id uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
    items jsonb NOT NULL, -- [{"producto_id": "uuid", "cantidad": 10}, ...]
    estado text DEFAULT 'pendiente' NOT NULL, -- 'pendiente', 'completado'
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.solicitudes_traspaso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.solicitudes_traspaso;
CREATE POLICY "Enable all for own company" ON public.solicitudes_traspaso
FOR ALL USING (empresa_id = public.get_empresa_id_from_jwt());

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitudes_traspaso;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Table "solicitudes_traspaso" is already in the publication.';
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 2: Fix Real-Time Notification Delay
-- -----------------------------------------------------------------------------
-- Changing from SECURITY DEFINER to SECURITY INVOKER (the default) makes this
-- function compatible with Supabase's realtime `postgres_changes` system,
-- ensuring instant notifications. This is safe due to the JWT-based RLS architecture.
CREATE OR REPLACE FUNCTION public.notificar_cambio(
    p_tipo_evento text,
    p_mensaje text,
    p_entidad_id uuid,
    p_sucursal_ids uuid[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
-- SECURITY INVOKER is the default, but we state it for clarity.
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
    v_usuario_id uuid;
    v_usuario_nombre text;
BEGIN
    v_usuario_id := auth.uid();
    -- Because this is now SECURITY INVOKER, it respects RLS.
    -- We must get the empresa_id from the JWT to avoid recursion.
    v_empresa_id := public.get_empresa_id_from_jwt();
    v_usuario_nombre := (auth.jwt() -> 'app_metadata' ->> 'nombre_completo')::text;

    IF v_usuario_nombre IS NULL AND v_usuario_id IS NOT NULL THEN
        SELECT nombre_completo INTO v_usuario_nombre FROM public.usuarios WHERE id = v_usuario_id;
    END IF;
    IF v_usuario_nombre IS NULL THEN v_usuario_nombre := 'Sistema'; END IF;

    IF v_empresa_id IS NOT NULL THEN
        INSERT INTO public.notificaciones (empresa_id, usuario_generador_id, usuario_generador_nombre, mensaje, tipo_evento, entidad_id, sucursales_destino_ids)
        VALUES (v_empresa_id, v_usuario_id, v_usuario_nombre, p_mensaje, p_tipo_evento, p_entidad_id, p_sucursal_ids);
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 3: Update `solicitar_traspaso_desde_proforma` to be more powerful
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS solicitar_traspaso_desde_proforma(uuid, uuid, uuid, numeric);
CREATE OR REPLACE FUNCTION solicitar_traspaso_desde_proforma(
    p_proforma_id uuid,
    p_sucursal_origen_id uuid,
    p_items jsonb -- Now accepts an array of items for bulk requests
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_sucursal_id uuid := (SELECT u.sucursal_id FROM public.usuarios u WHERE u.id = auth.uid());
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    v_proforma_folio text;
    v_origen_nombre text;
    v_destino_nombre text;
    v_mensaje text;
    v_new_solicitud_id uuid;
    v_item_count int;
BEGIN
    SELECT folio INTO v_proforma_folio FROM public.proformas WHERE id = p_proforma_id;
    SELECT nombre INTO v_origen_nombre FROM public.sucursales WHERE id = p_sucursal_origen_id;
    SELECT nombre INTO v_destino_nombre FROM public.sucursales WHERE id = caller_sucursal_id;
    
    v_item_count := jsonb_array_length(p_items);

    -- 1. Create a record of the request in the new table
    INSERT INTO public.solicitudes_traspaso(empresa_id, proforma_id, sucursal_origen_id, sucursal_destino_id, items)
    VALUES (caller_empresa_id, p_proforma_id, p_sucursal_origen_id, caller_sucursal_id, p_items)
    RETURNING id INTO v_new_solicitud_id;

    -- 2. Generate a smarter notification message
    IF v_item_count > 1 THEN
        v_mensaje := format(
            '<b>%s</b> solicita traspaso de <b>%s productos</b> para la proforma <b>%s</b>.',
            v_destino_nombre, v_item_count, v_proforma_folio
        );
    ELSE
        v_mensaje := format(
            '<b>%s</b> solicita traspaso de <b>%s x %s</b> para la proforma <b>%s</b>.',
            v_destino_nombre,
            p_items -> 0 ->> 'cantidad',
            (SELECT p.nombre FROM productos p WHERE p.id = (p_items -> 0 ->> 'producto_id')::uuid),
            v_proforma_folio
        );
    END IF;
    
    -- 3. Send the notification to the origin branch, linking to the new request ID
    PERFORM notificar_cambio(
        'SOLICITUD_TRASPASO',
        v_mensaje,
        v_new_solicitud_id, -- The entity is now the request, not the proforma
        ARRAY[p_sucursal_origen_id] -- Notify ONLY the origin branch
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 4: New RPC `get_solicitud_traspaso_details` for pre-filling the form
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_solicitud_traspaso_details(p_solicitud_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    solicitud_rec record;
    items_details json;
BEGIN
    SELECT * INTO solicitud_rec FROM public.solicitudes_traspaso
    WHERE id = p_solicitud_id AND empresa_id = public.get_empresa_id_from_jwt();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada o no pertenece a tu empresa.';
    END IF;

    SELECT json_agg(item_info) INTO items_details
    FROM (
        SELECT
            (i.item ->> 'producto_id')::uuid as producto_id,
            (i.item ->> 'cantidad')::numeric as cantidad_solicitada,
            p.nombre as producto_nombre,
            p.modelo as producto_modelo,
            (SELECT img.imagen_url FROM public.imagenes_productos img WHERE img.producto_id = p.id ORDER BY img.orden, img.created_at LIMIT 1) as producto_imagen,
            COALESCE((SELECT inv.cantidad FROM inventarios inv WHERE inv.producto_id = p.id AND inv.sucursal_id = solicitud_rec.sucursal_origen_id), 0) as stock_origen
        FROM jsonb_array_elements(solicitud_rec.items) WITH ORDINALITY i(item, rn)
        JOIN productos p ON p.id = (i.item ->> 'producto_id')::uuid
    ) as item_info;

    RETURN json_build_object(
        'proforma_folio', (SELECT folio FROM proformas WHERE id = solicitud_rec.proforma_id),
        'sucursal_origen_id', solicitud_rec.sucursal_origen_id,
        'sucursal_destino_id', solicitud_rec.sucursal_destino_id,
        'items', COALESCE(items_details, '[]'::json)
    );
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================