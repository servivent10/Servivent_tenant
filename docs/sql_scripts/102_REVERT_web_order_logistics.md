-- =============================================================================
-- REVERT SCRIPT FOR: WEB ORDER INTELLIGENT LOGISTICS FLOW (V1)
-- =============================================================================
-- This script reverts all changes made by `102_FEATURE_web_order_logistics.md`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Revert `get_solicitud_traspaso_details`
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_solicitud_traspaso_details(uuid);
-- Restore the version from script 85
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

-- -----------------------------------------------------------------------------
-- Step 2: Drop `solicitar_traspaso_desde_venta` RPC
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.solicitar_traspaso_desde_venta(uuid, uuid, jsonb);

-- -----------------------------------------------------------------------------
-- Step 3: Revert `verificar_stock_para_venta`
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.verificar_stock_para_venta(uuid);
-- Restore the version from script 97
CREATE OR REPLACE FUNCTION verificar_stock_para_venta(p_venta_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sucursal_id uuid;
BEGIN
    SELECT sucursal_id INTO v_sucursal_id FROM public.ventas WHERE id = p_venta_id;
    IF v_sucursal_id IS NULL THEN
        RAISE EXCEPTION 'Esta venta no tiene una sucursal de despacho asignada.';
    END IF;

    RETURN (SELECT json_agg(s_info) FROM (
        SELECT
            p.nombre as producto_nombre,
            vi.cantidad as cantidad_requerida,
            COALESCE(i.cantidad, 0) as cantidad_disponible
        FROM public.venta_items vi
        JOIN public.productos p ON vi.producto_id = p.id
        LEFT JOIN public.inventarios i ON vi.producto_id = i.producto_id AND i.sucursal_id = v_sucursal_id
        WHERE vi.venta_id = p_venta_id
    ) AS s_info);
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 4: Revert changes to `solicitudes_traspaso` table
-- -----------------------------------------------------------------------------
ALTER TABLE public.solicitudes_traspaso DROP CONSTRAINT IF EXISTS chk_solicitud_link;
ALTER TABLE public.solicitudes_traspaso ALTER COLUMN proforma_id SET NOT NULL;
ALTER TABLE public.solicitudes_traspaso DROP COLUMN IF EXISTS venta_id;

-- =============================================================================
-- End of revert script.
-- =============================================================================
