-- =============================================================================
-- COMPANY DETAILS & PAYMENTS FUNCTIONS (v2 - Enriched Details)
-- =============================================================================
-- Este script actualiza la función de detalles para que incluya información
-- de la sucursal principal (dirección, teléfono) y del propietario, y la
-- moneda de la empresa, centralizando toda la información clave en un solo
-- objeto para una visualización más completa en el panel de SuperAdmin.
--
-- INSTRUCCIONES:
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabla 1: pagos_licencia (sin cambios, idempotente)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pagos_licencia (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    licencia_id uuid NOT NULL REFERENCES public.licencias(id) ON DELETE CASCADE,
    monto numeric(10, 2) NOT NULL,
    fecha_pago timestamptz NOT NULL,
    metodo_pago text,
    notas text,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- -----------------------------------------------------------------------------
-- Función 1: Obtener detalles completos de una empresa (ACTUALIZADA)
-- -----------------------------------------------------------------------------
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


-- -----------------------------------------------------------------------------
-- Función 2: Añadir un pago y actualizar la licencia (sin cambios)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION add_license_payment(
    p_empresa_id uuid, 
    p_monto numeric, 
    p_metodo_pago text, 
    p_notas text,
    p_plan_tipo text,
    p_nueva_fecha_fin date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_licencia_id uuid;
BEGIN
    -- Comprobación de seguridad
    IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'SuperAdmin') THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de SuperAdmin.';
    END IF;

    SELECT id INTO v_licencia_id FROM public.licencias WHERE empresa_id = p_empresa_id;

    IF v_licencia_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró una licencia para la empresa especificada.';
    END IF;
    
    IF p_nueva_fecha_fin IS NULL THEN
        RAISE EXCEPTION 'La nueva fecha de fin no puede ser nula.';
    END IF;

    -- 1. Insertar el registro del pago
    INSERT INTO public.pagos_licencia(empresa_id, licencia_id, monto, fecha_pago, metodo_pago, notas)
    VALUES (p_empresa_id, v_licencia_id, p_monto, NOW(), p_metodo_pago, p_notas);

    -- 2. Actualizar la licencia con la nueva información
    UPDATE public.licencias
    SET 
        tipo_licencia = p_plan_tipo,
        fecha_fin = p_nueva_fecha_fin,
        estado = 'Activa' -- Siempre se activa/reactiva al hacer un pago
    WHERE id = v_licencia_id;

END;
$$;


-- -----------------------------------------------------------------------------
-- Función 3: Resetear la contraseña del propietario (sin cambios)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reset_owner_password_as_superadmin(
    p_user_id uuid,
    p_new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
-- Añadir 'extensions' al search_path es crucial para que pgcrypto (y por tanto crypt) esté disponible.
SET search_path = extensions, auth, public
AS $$
BEGIN
    -- Comprobación de seguridad
    IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'SuperAdmin') THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de SuperAdmin.';
    END IF;

    -- Valida la longitud de la contraseña
    IF char_length(p_new_password) < 6 THEN
        RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres.';
    END IF;

    -- Actualiza la contraseña del usuario en la tabla de autenticación de Supabase.
    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
    WHERE id = p_user_id;

END;
$$;


-- =============================================================================
-- Fin del script.
-- =============================================================================