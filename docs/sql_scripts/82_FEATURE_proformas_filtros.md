-- =============================================================================
-- PROFORMAS (QUOTES) MODULE: ADVANCED FILTERING (V1)
-- =============================================================================
-- This script implements the backend infrastructure for the new advanced
-- filtering panel on the Proformas history page.
--
-- WHAT IT DOES:
-- 1. Creates `get_proformas_data_filtered`: A comprehensive RPC function that
--    retrieves filtered proformas, calculates KPIs based on those filters, and
--    provides data for the filter dropdowns, all while respecting role-based security.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_proformas_list();

CREATE OR REPLACE FUNCTION get_proformas_data_filtered(
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_timezone text DEFAULT 'UTC',
    p_estado text DEFAULT NULL,
    p_cliente_id uuid DEFAULT NULL,
    p_usuario_ids uuid[] DEFAULT NULL,
    p_sucursal_ids uuid[] DEFAULT NULL
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
    
    v_start_utc timestamptz;
    v_end_utc timestamptz;

    kpis jsonb;
    proformas_list json;
    filter_options json;
BEGIN
    -- Get caller's role and branch for business logic (not RLS)
    SELECT rol, sucursal_id INTO caller_rol, caller_user_sucursal_id
    FROM public.usuarios WHERE id = auth.uid();

    -- Convert local dates from the filter to UTC based on the company's timezone
    IF p_start_date IS NOT NULL THEN
        v_start_utc := (p_start_date::timestamp AT TIME ZONE p_timezone);
    END IF;
    IF p_end_date IS NOT NULL THEN
        v_end_utc := ((p_end_date + interval '1 day')::timestamp AT TIME ZONE p_timezone);
    END IF;
    
    -- Create a temporary table to hold the filtered proformas for reuse across calculations
    CREATE TEMP TABLE filtered_proformas AS
    SELECT pr.*
    FROM public.proformas pr
    WHERE pr.empresa_id = caller_empresa_id
      AND (v_start_utc IS NULL OR pr.fecha_emision >= v_start_utc)
      AND (v_end_utc IS NULL OR pr.fecha_emision < v_end_utc)
      AND (p_estado IS NULL OR pr.estado = p_estado)
      AND (p_cliente_id IS NULL OR pr.cliente_id = p_cliente_id)
      AND (p_usuario_ids IS NULL OR array_length(p_usuario_ids, 1) IS NULL OR pr.usuario_id = ANY(p_usuario_ids))
      AND ( -- Role-based branch filtering
          (caller_rol = 'Propietario' AND (p_sucursal_ids IS NULL OR array_length(p_sucursal_ids, 1) IS NULL OR pr.sucursal_id = ANY(p_sucursal_ids)))
          OR
          (caller_rol != 'Propietario' AND pr.sucursal_id = caller_user_sucursal_id)
      );

    -- 1. Calculate KPIs from the filtered data
    SELECT jsonb_build_object(
        'total_cotizado', COALESCE(SUM(fp.total), 0),
        'proformas_vigentes', COALESCE(COUNT(*) FILTER (WHERE fp.estado = 'Vigente'), 0),
        'tasa_conversion', 
            CASE 
                WHEN COUNT(*) > 0
                THEN round( (COUNT(*) FILTER (WHERE fp.estado = 'Convertida'))::numeric * 100 / COUNT(*)::numeric , 2)
                ELSE 0 
            END
    ) INTO kpis
    FROM filtered_proformas fp;

    -- 2. Get the history list to display
    SELECT json_agg(p_info) INTO proformas_list FROM (
        SELECT 
            fp.id, fp.folio, fp.fecha_emision, fp.total, fp.estado,
            c.nombre as cliente_nombre
        FROM filtered_proformas fp
        LEFT JOIN public.clientes c ON fp.cliente_id = c.id
        ORDER BY fp.fecha_emision DESC
    ) p_info;

    -- 3. Get all available options for the filter dropdowns
    SELECT json_build_object(
        'clients', (SELECT json_agg(c_opts) FROM (SELECT id, nombre FROM public.clientes WHERE empresa_id = caller_empresa_id ORDER BY nombre) c_opts),
        'users', (SELECT json_agg(u_opts) FROM (SELECT id, nombre_completo FROM public.usuarios WHERE empresa_id = caller_empresa_id ORDER BY nombre_completo) u_opts),
        'branches', (SELECT json_agg(s_opts) FROM (SELECT id, nombre FROM public.sucursales WHERE empresa_id = caller_empresa_id ORDER BY nombre) s_opts)
    ) INTO filter_options;
    
    -- Drop the temporary table after use
    DROP TABLE filtered_proformas;

    -- 4. Build and return the final JSON object
    RETURN jsonb_build_object(
        'proformas', COALESCE(proformas_list, '[]'::json),
        'kpis', kpis,
        'filterOptions', filter_options
    );
END;
$$;
