-- =============================================================================
-- CASH REGISTER HISTORY FEATURE SCRIPT
-- =============================================================================
-- This script creates the backend logic for the new Cash Register History page.
--
-- WHAT IT DOES:
-- 1. Creates `get_historial_cajas()`: A comprehensive RPC function that
--    retrieves filtered cash session history, calculates KPIs, and provides
--    data for filter dropdowns.
-- 2. Adds the `sesiones_caja` table to the realtime publication.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create the main RPC function `get_historial_cajas`
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_historial_cajas(
    p_start_date date,
    p_end_date date,
    p_timezone text,
    p_sucursal_id uuid DEFAULT NULL,
    p_usuario_id uuid DEFAULT NULL,
    p_estado_arqueo text DEFAULT NULL -- 'Todos', 'Cuadrado', 'Faltante', 'Sobrante'
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
    -- Get caller's role and branch
    SELECT rol, sucursal_id INTO caller_rol, caller_user_sucursal_id
    FROM public.usuarios WHERE id = auth.uid();

    -- Create a temporary table to hold the filtered session data
    CREATE TEMP TABLE filtered_sessions AS
    SELECT *
    FROM public.sesiones_caja sc
    WHERE sc.empresa_id = caller_empresa_id
      AND sc.estado = 'CERRADA'
      AND (p_start_date IS NULL OR sc.fecha_cierre >= v_start_utc)
      AND (p_end_date IS NULL OR sc.fecha_cierre < v_end_utc)
      AND (caller_rol = 'Propietario' OR sc.sucursal_id = caller_user_sucursal_id) -- Role-based filtering
      AND (p_sucursal_id IS NULL OR sc.sucursal_id = p_sucursal_id)
      AND (p_usuario_id IS NULL OR sc.usuario_cierre_id = p_usuario_id)
      AND (
          p_estado_arqueo IS NULL OR p_estado_arqueo = 'Todos' OR
          (p_estado_arqueo = 'Cuadrado' AND sc.diferencia_efectivo BETWEEN -0.005 AND 0.005) OR
          (p_estado_arqueo = 'Faltante' AND sc.diferencia_efectivo < -0.005) OR
          (p_estado_arqueo = 'Sobrante' AND sc.diferencia_efectivo > 0.005)
      );

    -- 1. Calculate KPIs from the filtered data
    SELECT jsonb_build_object(
        'total_ventas_efectivo', COALESCE(SUM(fs.total_ventas_efectivo), 0),
        'total_faltantes', COALESCE(SUM(CASE WHEN fs.diferencia_efectivo < -0.005 THEN fs.diferencia_efectivo END), 0) * -1,
        'total_sobrantes', COALESCE(SUM(CASE WHEN fs.diferencia_efectivo > 0.005 THEN fs.diferencia_efectivo END), 0),
        'total_ventas_digitales', COALESCE(SUM(fs.total_ventas_tarjeta + fs.total_ventas_qr + fs.total_ventas_transferencia), 0)
    ) INTO kpis
    FROM filtered_sessions fs;

    -- 2. Get the history list
    SELECT json_agg(h_info) INTO historial_list FROM (
        SELECT 
            fs.*,
            s.nombre as sucursal_nombre,
            ua.nombre_completo as usuario_apertura_nombre,
            uc.nombre_completo as usuario_cierre_nombre
        FROM filtered_sessions fs
        JOIN public.sucursales s ON fs.sucursal_id = s.id
        JOIN public.usuarios ua ON fs.usuario_apertura_id = ua.id
        LEFT JOIN public.usuarios uc ON fs.usuario_cierre_id = uc.id
        ORDER BY fs.fecha_cierre DESC
    ) h_info;

    -- 3. Get filter options
    SELECT json_build_object(
        'sucursales', (SELECT json_agg(s_opts) FROM (SELECT id, nombre FROM public.sucursales WHERE empresa_id = caller_empresa_id ORDER BY nombre) s_opts),
        'usuarios', (SELECT json_agg(u_opts) FROM (SELECT id, nombre_completo FROM public.usuarios WHERE empresa_id = caller_empresa_id ORDER BY nombre_completo) u_opts)
    ) INTO filter_options;
    
    -- Drop the temporary table
    DROP TABLE filtered_sessions;

    -- 4. Build final response
    RETURN jsonb_build_object(
        'kpis', kpis,
        'historial', COALESCE(historial_list, '[]'::json),
        'filterOptions', filter_options
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- Step 2: Add `sesiones_caja` to the realtime publication
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sesiones_caja;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "sesiones_caja" ya está en la publicación.';
END;
$$;

-- =============================================================================
-- End of script.
-- =============================================================================