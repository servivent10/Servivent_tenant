-- =============================================================================
-- REVERT SCRIPT FOR: SALE DETAILS RPC SYNTAX HOTFIX (V1)
-- =============================================================================
-- This script reverts the changes made by `100_HOTFIX_sale_details_syntax.md`.
-- It restores the previous version of the `get_sale_details` function from
-- script 99, which contained the syntax error.
--
-- WARNING:
-- Running this script will re-introduce the "missing FROM-clause entry" error
-- when viewing the sale detail page.
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_sale_details(p_venta_id uuid);
CREATE OR REPLACE FUNCTION get_sale_details(p_venta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sale_base_data record;
    sale_details jsonb;
    items_list jsonb;
    payments_list jsonb;
    address_data jsonb;
    v_company_timezone text;
    v_stock_deducido boolean;
BEGIN
    -- This is the version from script 99, with the bug.
    SELECT e.timezone INTO v_company_timezone
    FROM public.empresas e
    WHERE e.id = public.get_empresa_id_from_jwt();
    
    IF v_company_timezone IS NULL THEN
        v_company_timezone := 'UTC'; -- Fallback
    END IF;

    SELECT 
        v.*,
        c.nombre as cliente_nombre,
        c.nit_ci as cliente_nit_ci,
        c.telefono as cliente_telefono,
        u.nombre_completo as usuario_nombre,
        s.nombre as sucursal_nombre,
        s.direccion as sucursal_direccion,
        s.telefono as sucursal_telefono
    INTO sale_base_data
    FROM public.ventas v
    LEFT JOIN public.clientes c ON v.cliente_id = c.id
    LEFT JOIN public.usuarios u ON v.usuario_id = u.id
    LEFT JOIN public.sucursales s ON v.sucursal_id = s.id
    WHERE v.id = p_venta_id
    AND v.empresa_id = public.get_empresa_id_from_jwt();

    IF NOT FOUND THEN 
        RAISE EXCEPTION 'Venta no encontrada o no pertenece a tu empresa.'; 
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM public.movimientos_inventario 
        WHERE referencia_id = p_venta_id AND tipo_movimiento = 'Venta'
    )
    INTO v_stock_deducido;

    -- The line with the error
    SELECT COALESCE(jsonb_agg(i ORDER BY p.nombre), '[]'::jsonb) INTO items_list 
    FROM (
        SELECT vi.*, p.nombre as producto_nombre 
        FROM public.venta_items vi JOIN public.productos p ON vi.producto_id = p.id 
        WHERE vi.venta_id = p_venta_id
    ) i;
    
    SELECT COALESCE(jsonb_agg(p ORDER BY p.fecha_pago), '[]'::jsonb) INTO payments_list 
    FROM public.pagos_ventas p 
    WHERE p.venta_id = p_venta_id;

    SELECT to_jsonb(da) INTO address_data
    FROM public.direcciones_clientes da
    WHERE da.id = sale_base_data.direccion_entrega_id;

    sale_details := to_jsonb(sale_base_data) || jsonb_build_object(
        'stock_deducido', v_stock_deducido,
        'estado_vencimiento', CASE
            WHEN sale_base_data.estado_pago = 'Pagada' THEN 'Pagada'
            WHEN sale_base_data.tipo_venta = 'Contado' THEN 'Pagada'
            WHEN sale_base_data.fecha_vencimiento IS NULL THEN 'N/A'
            WHEN sale_base_data.fecha_vencimiento < (now() AT TIME ZONE v_company_timezone)::date THEN 'Vencida'
            ELSE 'Al día'
        END,
        'dias_diferencia', CASE
            WHEN sale_base_data.tipo_venta = 'Crédito' AND sale_base_data.fecha_vencimiento IS NOT NULL 
            THEN (sale_base_data.fecha_vencimiento - (now() AT TIME ZONE v_company_timezone)::date)
            ELSE NULL
        END,
        'items', items_list,
        'pagos', payments_list,
        'direccion_entrega', address_data
    );

    RETURN sale_details;
END;
$$;


-- =============================================================================
-- End of revert script.
-- =============================================================================