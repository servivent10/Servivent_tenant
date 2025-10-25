-- =============================================================================
-- HOTFIX: WEB ORDER PAYMENT & CONFIRMATION FLOW (V1)
-- =============================================================================
-- This script provides a definitive fix for the issue where the web order
-- management panel disappears after payments are made.
--
-- PROBLEM:
-- When a web order is fully paid, the `registrar_pago_venta` function changes
-- its `estado_pago` to 'Pagada'. This is the same final state set by
-- `confirmar_pedido_web`, making it impossible for the frontend to know if a
-- 'Pagada' order is simply paid or if it has also been processed (stock deducted).
-- This ambiguity causes the management panel to disappear prematurely.
--
-- SOLUTION:
-- This script updates the `get_sale_details` function to be the single source
-- of truth about an order's processing status. It adds a new boolean field,
-- `stock_deducido`, by checking for the existence of inventory movements related
-- to the sale. This is a robust indicator that `confirmar_pedido_web` has been
-- successfully executed. The frontend can now reliably show the management panel
-- for any web order where `stock_deducido` is false.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
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
    v_stock_deducido boolean; -- **NUEVO CAMPO**
BEGIN
    -- 1. Get company timezone for date calculations
    SELECT e.timezone INTO v_company_timezone
    FROM public.empresas e
    WHERE e.id = public.get_empresa_id_from_jwt();
    
    IF v_company_timezone IS NULL THEN
        v_company_timezone := 'UTC'; -- Fallback
    END IF;

    -- 2. Fetch the main sale record and all related details in one query
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

    -- **NUEVA LÓGICA**: Check if inventory movements exist for this sale. This is the
    -- definitive proof that the order has been processed.
    SELECT EXISTS(
        SELECT 1 FROM public.movimientos_inventario 
        WHERE referencia_id = p_venta_id AND tipo_movimiento = 'Venta'
    )
    INTO v_stock_deducido;

    -- 3. Fetch related items
    SELECT COALESCE(jsonb_agg(i ORDER BY p.nombre), '[]'::jsonb) INTO items_list 
    FROM (
        SELECT vi.*, p.nombre as producto_nombre 
        FROM public.venta_items vi JOIN public.productos p ON vi.producto_id = p.id 
        WHERE vi.venta_id = p_venta_id
    ) i;
    
    -- 4. Fetch related payments
    SELECT COALESCE(jsonb_agg(p ORDER BY p.fecha_pago), '[]'::jsonb) INTO payments_list 
    FROM public.pagos_ventas p 
    WHERE p.venta_id = p_venta_id;

    -- 5. Fetch delivery address if it exists
    SELECT to_jsonb(da) INTO address_data
    FROM public.direcciones_clientes da
    WHERE da.id = sale_base_data.direccion_entrega_id;

    -- 6. Construct the final, complete JSON object, including the new flag
    sale_details := to_jsonb(sale_base_data) || jsonb_build_object(
        'stock_deducido', v_stock_deducido, -- **AÑADIDO**
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
-- End of script.
-- =============================================================================