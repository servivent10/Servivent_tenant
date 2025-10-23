-- =============================================================================
-- REVERT SCRIPT FOR: SUPERADMIN FEATURE - SUCURSAL MAPS & CONTACTS (V1)
-- =============================================================================
-- This script reverts the changes made by `89_FEATURE_superadmin_sucursal_maps.md`.
-- It restores the previous version of the `get_company_details` function.
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
    -- Comprobación de seguridad
    IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'SuperAdmin') THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de SuperAdmin.';
    END IF;

    -- 1. Obtener detalles enriquecidos de la empresa
    SELECT to_json(details) INTO company_details FROM (
        SELECT
            e.id,
            e.nombre,
            e.nit,
            e.logo,
            e.moneda,
            e.timezone,
            e.created_at,
            s.direccion,
            s.telefono,
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

    -- 2. Obtener lista de usuarios
    SELECT json_agg(u) INTO users_list
    FROM (
        SELECT id, nombre_completo, rol, correo, created_at 
        FROM public.usuarios 
        WHERE empresa_id = p_empresa_id
        ORDER BY rol DESC, created_at
    ) u;

    -- 3. Obtener lista de sucursales
    SELECT json_agg(s) INTO branches_list
    FROM (
        SELECT id, nombre, direccion, telefono, created_at
        FROM public.sucursales 
        WHERE empresa_id = p_empresa_id
        ORDER BY created_at
    ) s;
    
    -- 4. Obtener lista de pagos
    SELECT json_agg(p) INTO payments_list
    FROM (
        SELECT id, monto, fecha_pago, metodo_pago, notas 
        FROM public.pagos_licencia
        WHERE empresa_id = p_empresa_id
        ORDER BY fecha_pago DESC
    ) p;

    -- 5. Calcular KPIs
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
    
    -- 6. Combinar todo en un único objeto JSON de respuesta
    RETURN json_build_object(
        'details', company_details,
        'kpis', kpis,
        'users', COALESCE(users_list, '[]'::json),
        'branches', COALESCE(branches_list, '[]'::json),
        'payments', COALESCE(payments_list, '[]'::json)
    );

END;
$$;
