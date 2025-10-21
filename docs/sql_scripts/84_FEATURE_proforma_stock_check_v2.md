-- =============================================================================
-- PROFORMA ADVANCED STOCK CHECK & TRANSFER REQUEST - V1
-- =============================================================================
-- This script implements the backend infrastructure for the advanced
-- insufficient stock management feature in the Proformas module.
--
-- WHAT IT DOES:
-- 1. Updates `verificar_stock_proforma` to return stock levels from other
--    branches when an item is insufficient.
-- 2. Creates `solicitar_traspaso_desde_proforma`, a new RPC to generate a
--    smart notification requesting an inventory transfer.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Update `verificar_stock_proforma` with multi-branch visibility
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION verificar_stock_proforma(p_proforma_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    caller_sucursal_id uuid := (SELECT u.sucursal_id FROM public.usuarios u WHERE u.id = auth.uid());
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    insufficient_items json;
BEGIN
    SELECT json_agg(s_info) INTO insufficient_items
    FROM (
        SELECT
            pi.producto_id,
            p.nombre as producto_nombre,
            pi.cantidad as cantidad_requerida,
            COALESCE(i.cantidad, 0) as cantidad_disponible,
            (
                SELECT json_agg(
                    json_build_object(
                        'id', s.id,
                        'nombre', s.nombre,
                        'cantidad', inv.cantidad
                    )
                )
                FROM public.inventarios inv
                JOIN public.sucursales s ON inv.sucursal_id = s.id
                WHERE inv.producto_id = pi.producto_id
                  AND inv.sucursal_id != caller_sucursal_id
                  AND inv.cantidad >= pi.cantidad
                  AND s.empresa_id = caller_empresa_id
            ) as other_branches_stock
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

-- -----------------------------------------------------------------------------
-- Step 2: Create `solicitar_traspaso_desde_proforma` RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION solicitar_traspaso_desde_proforma(
    p_proforma_id uuid,
    p_producto_id uuid,
    p_sucursal_origen_id uuid,
    p_cantidad_solicitada numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    caller_sucursal_id uuid := (SELECT u.sucursal_id FROM public.usuarios u WHERE u.id = auth.uid());
    v_proforma_folio text;
    v_producto_nombre text;
    v_origen_nombre text;
    v_destino_nombre text;
    v_mensaje text;
BEGIN
    SELECT folio INTO v_proforma_folio FROM public.proformas WHERE id = p_proforma_id;
    SELECT nombre INTO v_producto_nombre FROM public.productos WHERE id = p_producto_id;
    SELECT nombre INTO v_origen_nombre FROM public.sucursales WHERE id = p_sucursal_origen_id;
    SELECT nombre INTO v_destino_nombre FROM public.sucursales WHERE id = caller_sucursal_id;

    v_mensaje := format(
        '<b>%s</b> solicita traspaso de <b>%s x %s</b> para la proforma <b>%s</b>.',
        v_destino_nombre,
        p_cantidad_solicitada,
        v_producto_nombre,
        v_proforma_folio
    );
    
    PERFORM notificar_cambio(
        'SOLICITUD_TRASPASO',
        v_mensaje,
        p_proforma_id,
        ARRAY[p_sucursal_origen_id] -- Notify ONLY the origin branch
    );
END;
$$;

-- =============================================================================
-- End of script.
-- =============================================================================