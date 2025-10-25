-- =============================================================================
-- REVERT SCRIPT FOR: LANDED COST (V1)
-- =============================================================================
-- Este script revierte todos los cambios realizados por `93_FEATURE_landed_cost.md`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Eliminar Funciones RPC
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.aplicar_costos_adicionales_a_compra(uuid, text);
DROP FUNCTION IF EXISTS public.add_gasto_compra(uuid, text, numeric);
DROP FUNCTION IF EXISTS public.delete_gasto_compra(uuid);


-- -----------------------------------------------------------------------------
-- Paso 2: Eliminar Tabla y Columnas
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.gastos_compra;

ALTER TABLE public.compras DROP COLUMN IF EXISTS costos_aplicados;
ALTER TABLE public.compra_items DROP COLUMN IF EXISTS costo_unitario_real;


-- -----------------------------------------------------------------------------
-- Paso 3: Revertir `get_purchase_details` a su estado anterior
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_purchase_details(uuid);
CREATE OR REPLACE FUNCTION get_purchase_details(p_compra_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    purchase_details jsonb;
    items_list json;
    payments_list json;
BEGIN
    SELECT to_jsonb(c) || jsonb_build_object(
        'proveedor_nombre', p.nombre,
        'usuario_nombre', u.nombre_completo
    )
    INTO purchase_details
    FROM public.compras c
    JOIN public.proveedores p ON c.proveedor_id = p.id
    LEFT JOIN public.usuarios u ON c.usuario_id = u.id
    WHERE c.id = p_compra_id AND c.empresa_id = public.get_empresa_id_from_jwt();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Compra no encontrada o no pertenece a tu empresa.';
    END IF;

    SELECT json_agg(i) INTO items_list
    FROM (
        SELECT ci.*, p.nombre as producto_nombre
        FROM public.compra_items ci
        JOIN public.productos p ON ci.producto_id = p.id
        WHERE ci.compra_id = p_compra_id
    ) i;

    SELECT json_agg(p) INTO payments_list
    FROM (
        SELECT * FROM public.pagos_compras
        WHERE compra_id = p_compra_id
        ORDER BY fecha_pago
    ) p;

    RETURN purchase_details || jsonb_build_object(
        'items', COALESCE(items_list, '[]'::json),
        'pagos', COALESCE(payments_list, '[]'::json)
    );
END;
$$;

-- =============================================================================
-- Fin del script de reversión.
-- =============================================================================