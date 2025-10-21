-- =============================================================================
-- REVERT SCRIPT FOR: PROFORMA ADVANCED STOCK CHECK & TRANSFER REQUEST (V1)
-- =============================================================================
-- This script reverts the changes made by `84_FEATURE_proforma_stock_check_v2.md`.
-- =============================================================================

-- Step 1: Revert `verificar_stock_proforma` to its previous version
DROP FUNCTION IF EXISTS public.verificar_stock_proforma(uuid);
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


-- Step 2: Drop the new function `solicitar_traspaso_desde_proforma`
DROP FUNCTION IF EXISTS public.solicitar_traspaso_desde_proforma(uuid, uuid, uuid, numeric);

-- =============================================================================
-- End of revert script.
-- =============================================================================