-- =============================================================================
-- INVENTORY HISTORY (MOVIMIENTOS) MODULE - DATABASE SETUP (V2 - FIX)
-- =============================================================================
-- This script creates the backend logic for the new Inventory History page,
-- which provides a detailed operational audit of all stock movements.
-- VERSION 2 FIX: Corrects the main query to join with the `productos` table
-- to filter by `empresa_id`, resolving a "column does not exist" error.
--
-- WHAT IT DOES:
-- 1. Creates `get_movimientos_inventario()`: A comprehensive RPC function that
--    retrieves and filters the inventory movement history, calculates KPIs, and
--    provides data for the frontend filter dropdowns.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create the main RPC function `get_movimientos_inventario`
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_movimientos_inventario(
    p_start_date date,
    p_end_date date,
    p_timezone text,
    p_producto_id uuid DEFAULT NULL,
    p_sucursal_id uuid DEFAULT NULL,
    p_usuario_id uuid DEFAULT NULL,
    p_tipo_movimiento text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    caller_rol text;
    caller_user_sucursal_id uuid;
    
    v_start_utc timestamptz := (p_start_date::timestamp AT TIME ZONE p_timezone);
    v_end_utc timestamptz := ((p_end_date + interval '1 day')::timestamp AT TIME ZONE p_timezone);

    kpis jsonb;
    historial_list json;
    filter_options json;
BEGIN
    -- Get caller's role and branch for logic, not for RLS
    SELECT rol, sucursal_id INTO caller_rol, caller_user_sucursal_id
    FROM public.usuarios WHERE id = auth.uid();

    -- Create a temporary table to hold the filtered movement data for reuse
    CREATE TEMP TABLE filtered_movements AS
    SELECT mi.*
    FROM public.movimientos_inventario mi
    JOIN public.productos p ON mi.producto_id = p.id -- FIX: Join with productos to filter by company
    WHERE p.empresa_id = caller_empresa_id
      AND mi.created_at >= v_start_utc
      AND mi.created_at < v_end_utc
      AND (caller_rol = 'Propietario' OR mi.sucursal_id = caller_user_sucursal_id) -- Role-based branch filtering
      AND (p_producto_id IS NULL OR mi.producto_id = p_producto_id)
      AND (p_sucursal_id IS NULL OR mi.sucursal_id = p_sucursal_id)
      AND (p_usuario_id IS NULL OR mi.usuario_id = p_usuario_id)
      AND (p_tipo_movimiento IS NULL OR p_tipo_movimiento = 'Todos' OR mi.tipo_movimiento = p_tipo_movimiento);

    -- 1. Calculate KPIs from the filtered data
    SELECT jsonb_build_object(
        'total_entradas', COALESCE(SUM(CASE WHEN fm.cantidad_ajustada > 0 THEN fm.cantidad_ajustada ELSE 0 END), 0),
        'total_salidas', COALESCE(SUM(CASE WHEN fm.cantidad_ajustada < 0 THEN fm.cantidad_ajustada ELSE 0 END), 0) * -1
    ) INTO kpis
    FROM filtered_movements fm;

    -- 2. Get the history list with joined names
    SELECT json_agg(h_info) INTO historial_list FROM (
        SELECT 
            fm.id,
            fm.created_at,
            fm.tipo_movimiento,
            fm.cantidad_ajustada,
            fm.stock_anterior,
            fm.stock_nuevo,
            fm.referencia_id,
            fm.motivo,
            p.nombre as producto_nombre,
            s.nombre as sucursal_nombre,
            u.nombre_completo as usuario_nombre
        FROM filtered_movements fm
        JOIN public.productos p ON fm.producto_id = p.id
        JOIN public.sucursales s ON fm.sucursal_id = s.id
        LEFT JOIN public.usuarios u ON fm.usuario_id = u.id
        ORDER BY fm.created_at DESC
        LIMIT 500 -- Add a limit for performance
    ) h_info;

    -- 3. Get filter options for dropdowns
    SELECT json_build_object(
        'productos', (SELECT json_agg(p_opts) FROM (SELECT id, nombre FROM public.productos WHERE empresa_id = caller_empresa_id ORDER BY nombre) p_opts),
        'sucursales', (SELECT json_agg(s_opts) FROM (SELECT id, nombre FROM public.sucursales WHERE empresa_id = caller_empresa_id ORDER BY nombre) s_opts),
        'usuarios', (SELECT json_agg(u_opts) FROM (SELECT id, nombre_completo FROM public.usuarios WHERE empresa_id = caller_empresa_id ORDER BY nombre_completo) u_opts)
    ) INTO filter_options;
    
    -- Drop the temporary table
    DROP TABLE filtered_movements;

    -- 4. Build final response object
    RETURN jsonb_build_object(
        'kpis', kpis,
        'historial', COALESCE(historial_list, '[]'::json),
        'filterOptions', filter_options
    );
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================