-- =============================================================================
-- HOTFIX SCRIPT FOR SALE DETAILS RPC (V4 - Definitive RLS & Syntax Fix)
-- =============================================================================
-- This script provides a critical hotfix for the `get_sale_details` function.
--
-- PROBLEM:
-- The previous version (77) introduced a syntax error in the subquery that
-- fetches sale items. An `ORDER BY` clause was placed in the outer query where
-- the table alias 'p' was not in scope, causing a "missing FROM-clause entry"
-- error whenever the sale detail page was opened.
--
-- SOLUTION:
-- This version moves the `ORDER BY p.nombre` clause to the correct location,
-- *inside* the subquery aliased as `i`. This ensures the items are sorted
-- correctly before being aggregated into a JSON array, fixing the error
-- while retaining all previous security and data enrichment enhancements.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor. This will
-- fix the error when viewing sale details.
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
BEGIN
    -- 1. Get the company's timezone for date calculations
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

    -- 3. Fetch related items (FIXED a `p` is not a known variable ERROR)
    SELECT COALESCE(jsonb_agg(i), '[]'::jsonb) INTO items_list 
    FROM (
        SELECT vi.*, p.nombre as producto_nombre 
        FROM public.venta_items vi 
        JOIN public.productos p ON vi.producto_id = p.id 
        WHERE vi.venta_id = p_venta_id
        ORDER BY p.nombre -- **HOTFIX**: Moved ORDER BY inside the subquery
    ) i;

    -- 4. Fetch related payments
    SELECT COALESCE(jsonb_agg(p ORDER BY p.fecha_pago), '[]'::jsonb) INTO payments_list 
    FROM public.pagos_ventas p 
    WHERE p.venta_id = p_venta_id;

    -- 5. Fetch delivery address if it exists
    SELECT to_jsonb(da) INTO address_data
    FROM public.direcciones_clientes da
    WHERE da.id = sale_base_data.direccion_entrega_id;

    -- 6. Construct the final, complete JSON object
    sale_details := to_jsonb(sale_base_data) || jsonb_build_object(
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