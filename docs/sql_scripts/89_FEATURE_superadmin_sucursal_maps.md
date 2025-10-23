-- =============================================================================
-- SUPERADMIN FEATURE: SUCURSAL MAPS & CONTACTS (V1)
-- =============================================================================
-- This script enhances the SuperAdmin's company detail view by adding geographic
-- and contact information to the branches.
--
-- WHAT IT DOES:
-- 1. Updates `get_company_details` to include `latitud`, `longitud`, and
--    `user_count` for each branch, enabling the new card-based view with maps.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_company_details(uuid);
CREATE OR REPLACE FUNCTION get_company_details(p_empresa_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    company_details json;
    kpis json;
    users_list json;
    branches_list json;
    payments_list json;
    license_end_date date;
    days_remaining integer;
BEGIN
    -- Security check
    IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'SuperAdmin') THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de SuperAdmin.';
    END IF;

    -- 1. Get enriched company details
    SELECT to_json(details) INTO company_details FROM (
        SELECT
            e.id, e.nombre, e.nit, e.logo, e.moneda, e.timezone, e.created_at,
            s.direccion, s.telefono,
            u.nombre_completo as propietario_nombre,
            u.correo as propietario_email
        FROM public.empresas e
        LEFT JOIN (
            SELECT * FROM public.sucursales 
            WHERE empresa_id = p_empresa_id 
            ORDER BY created_at ASC 
            LIMIT 1
        ) s ON e.id = s.empresa_id
        LEFT JOIN (
            SELECT * FROM public.usuarios
            WHERE empresa_id = p_empresa_id AND rol = 'Propietario'
            LIMIT 1
        ) u ON e.id = u.empresa_id
        WHERE e.id = p_empresa_id
    ) details;

    -- 2. Get user list
    SELECT json_agg(u) INTO users_list
    FROM (
        SELECT id, nombre_completo, rol, correo, created_at 
        FROM public.usuarios 
        WHERE empresa_id = p_empresa_id
        ORDER BY rol DESC, created_at
    ) u;

    -- 3. Get branch list, now with lat/lng and user count
    SELECT json_agg(s) INTO branches_list
    FROM (
        SELECT id, nombre, direccion, telefono, latitud, longitud, created_at,
               (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = s.id) as user_count
        FROM public.sucursales s
        WHERE empresa_id = p_empresa_id
        ORDER BY created_at
    ) s;
    
    -- 4. Get payment list
    SELECT json_agg(p) INTO payments_list
    FROM (
        SELECT id, monto, fecha_pago, metodo_pago, notas 
        FROM public.pagos_licencia
        WHERE empresa_id = p_empresa_id
        ORDER BY fecha_pago DESC
    ) p;

    -- 5. Calculate KPIs
    SELECT l.fecha_fin INTO license_end_date FROM public.licencias l WHERE l.empresa_id = p_empresa_id;
    
    IF license_end_date IS NOT NULL THEN
        days_remaining := license_end_date - CURRENT_DATE;
    ELSE
        days_remaining := 0;
    END IF;

    SELECT json_build_object(
        'total_users', (SELECT COUNT(*) FROM public.usuarios WHERE empresa_id = p_empresa_id),
        'total_branches', (SELECT COUNT(*) FROM public.sucursales WHERE empresa_id = p_empresa_id),
        'license_status', (SELECT estado FROM public.licencias WHERE empresa_id = p_empresa_id),
        'license_type', (SELECT tipo_licencia FROM public.licencias WHERE empresa_id = p_empresa_id),
        'days_remaining', days_remaining,
        'license_end_date', license_end_date
    ) INTO kpis;
    
    -- 6. Combine everything into a single JSON object
    RETURN json_build_object(
        'details', company_details,
        'kpis', kpis,
        'users', COALESCE(users_list, '[]'::json),
        'branches', COALESCE(branches_list, '[]'::json),
        'payments', COALESCE(payments_list, '[]'::json)
    );

END;
$$;
