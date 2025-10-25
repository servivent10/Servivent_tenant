-- =============================================================================
-- WEB ORDER INTELLIGENT LOGISTICS FLOW - V1
-- =============================================================================
-- This script replicates the intelligent logistics and transfer request
-- functionality from the Proformas module for the Web Orders module.
--
-- WHAT IT DOES:
-- 1. Alters the `solicitudes_traspaso` table to also link to sales (`ventas`).
-- 2. Updates `verificar_stock_para_venta` to provide stock details from other branches.
-- 3. Creates `solicitar_traspaso_desde_venta` to log transfer requests for sales.
-- 4. Updates `get_solicitud_traspaso_details` to handle requests originating from sales.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Alter the `solicitudes_traspaso` table
-- -----------------------------------------------------------------------------
-- Add a nullable column to link to the 'ventas' table
ALTER TABLE public.solicitudes_traspaso
ADD COLUMN IF NOT EXISTS venta_id uuid REFERENCES public.ventas(id) ON DELETE CASCADE;

-- Make 'proforma_id' nullable to allow linking to either a proforma or a sale
ALTER TABLE public.solicitudes_traspaso
ALTER COLUMN proforma_id DROP NOT NULL;

-- Add a CHECK constraint to ensure that each request is linked to EITHER a proforma OR a sale, but not both or neither.
-- First, drop any existing constraint to make this script idempotent.
ALTER TABLE public.solicitudes_traspaso
DROP CONSTRAINT IF EXISTS chk_solicitud_link;

ALTER TABLE public.solicitudes_traspaso
ADD CONSTRAINT chk_solicitud_link CHECK (num_nonnulls(proforma_id, venta_id) = 1);


-- -----------------------------------------------------------------------------
-- Step 2: Update `verificar_stock_para_venta` with multi-branch visibility
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.verificar_stock_para_venta(uuid);
CREATE OR REPLACE FUNCTION verificar_stock_para_venta(p_venta_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sucursal_id uuid;
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    insufficient_items json;
BEGIN
    SELECT sucursal_id INTO v_sucursal_id FROM public.ventas WHERE id = p_venta_id;
    IF v_sucursal_id IS NULL THEN
        RAISE EXCEPTION 'Esta venta no tiene una sucursal de despacho asignada.';
    END IF;

    -- Check if stock has already been deducted for this sale
    IF EXISTS (SELECT 1 FROM public.movimientos_inventario WHERE referencia_id = p_venta_id AND tipo_movimiento = 'Venta') THEN
        RETURN '{"status": "ok"}'::json;
    END IF;

    SELECT json_agg(s_info) INTO insufficient_items
    FROM (
        SELECT
            vi.producto_id,
            p.nombre as producto_nombre,
            vi.cantidad as cantidad_requerida,
            COALESCE(i.cantidad, 0) as cantidad_disponible,
            (
                SELECT json_agg(
                    json_build_object(
                        'id', s.id,
                        'nombre', s.nombre,
                        'cantidad', inv.cantidad
                    ) ORDER BY inv.cantidad DESC
                )
                FROM public.inventarios inv
                JOIN public.sucursales s ON inv.sucursal_id = s.id
                WHERE inv.producto_id = vi.producto_id
                  AND inv.sucursal_id != v_sucursal_id
                  AND inv.cantidad > 0
                  AND s.empresa_id = caller_empresa_id
            ) as other_branches_stock
        FROM public.venta_items vi
        JOIN public.productos p ON vi.producto_id = p.id
        LEFT JOIN public.inventarios i ON vi.producto_id = i.producto_id AND i.sucursal_id = v_sucursal_id
        WHERE vi.venta_id = p_venta_id
          AND vi.cantidad > COALESCE(i.cantidad, 0)
    ) AS s_info;

    IF insufficient_items IS NULL THEN
        RETURN '{"status": "ok"}'::json;
    ELSE
        RETURN json_build_object('status', 'insufficient', 'items', insufficient_items);
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 3: Create `solicitar_traspaso_desde_venta` RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION solicitar_traspaso_desde_venta(
    p_venta_id uuid,
    p_sucursal_origen_id uuid,
    p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_sucursal_id uuid := (SELECT u.sucursal_id FROM public.usuarios u WHERE u.id = auth.uid());
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    v_venta_folio text;
    v_origen_nombre text;
    v_destino_nombre text;
    v_mensaje text;
    v_new_solicitud_id uuid;
    v_item_count int;
BEGIN
    SELECT folio INTO v_venta_folio FROM public.ventas WHERE id = p_venta_id;
    SELECT nombre INTO v_origen_nombre FROM public.sucursales WHERE id = p_sucursal_origen_id;
    SELECT nombre INTO v_destino_nombre FROM public.sucursales WHERE id = caller_sucursal_id;
    
    v_item_count := jsonb_array_length(p_items);

    INSERT INTO public.solicitudes_traspaso(empresa_id, venta_id, sucursal_origen_id, sucursal_destino_id, items)
    VALUES (caller_empresa_id, p_venta_id, p_sucursal_origen_id, caller_sucursal_id, p_items)
    RETURNING id INTO v_new_solicitud_id;

    IF v_item_count > 1 THEN
        v_mensaje := format(
            '<b>%s</b> solicita traspaso de <b>%s productos</b> para el pedido web <b>%s</b>.',
            v_destino_nombre, v_item_count, v_venta_folio
        );
    ELSE
        v_mensaje := format(
            '<b>%s</b> solicita traspaso de <b>%s x %s</b> para el pedido web <b>%s</b>.',
            v_destino_nombre,
            p_items -> 0 ->> 'cantidad',
            (SELECT p.nombre FROM productos p WHERE p.id = (p_items -> 0 ->> 'producto_id')::uuid),
            v_venta_folio
        );
    END IF;
    
    PERFORM notificar_cambio(
        'SOLICITUD_TRASPASO',
        v_mensaje,
        v_new_solicitud_id,
        ARRAY[p_sucursal_origen_id]
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- Step 4: Update `get_solicitud_traspaso_details`
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
        'folio', CASE 
            WHEN solicitud_rec.proforma_id IS NOT NULL THEN (SELECT folio FROM proformas WHERE id = solicitud_rec.proforma_id)
            WHEN solicitud_rec.venta_id IS NOT NULL THEN (SELECT folio FROM ventas WHERE id = solicitud_rec.venta_id)
            ELSE 'N/A'
        END,
        'tipo', CASE
            WHEN solicitud_rec.proforma_id IS NOT NULL THEN 'la proforma'
            WHEN solicitud_rec.venta_id IS NOT NULL THEN 'el pedido web'
            ELSE 'el documento'
        END,
        'sucursal_origen_id', solicitud_rec.sucursal_origen_id,
        'sucursal_destino_id', solicitud_rec.sucursal_destino_id,
        'items', COALESCE(items_details, '[]'::json)
    );
END;
$$;
