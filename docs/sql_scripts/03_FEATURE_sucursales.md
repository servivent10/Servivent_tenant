-- =============================================================================
-- SUCURSALES & USER MANAGEMENT FUNCTIONS (V3 - ROBUST FIX)
-- =============================================================================
-- Este script refactoriza la función `get_company_sucursales` para que sea
-- consistente y robusta, resolviendo un error fatal en el frontend.
--
-- PROBLEMA: La función devolvía un tipo de dato diferente para Propietarios
-- (un array) que para otros roles (un objeto). Esto causaba un error
-- `TypeError: .map is not a function` en componentes que esperaban siempre un array.
--
-- SOLUCIÓN: La función ahora SIEMPRE devuelve la lista completa de sucursales.
-- La lógica de redirección para no-propietarios se facilita añadiendo el
-- `user_sucursal_id` al nivel raíz del JSON de respuesta.
--
-- **INSTRUCCIONES:**
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Función 1: Obtener la lista de sucursales de la empresa (CORREGIDA)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_company_sucursales()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
    caller_sucursal_id uuid;
    sucursales_list json;
    kpis json;
BEGIN
    -- Obtener datos del usuario que llama a la función
    SELECT empresa_id, rol, sucursal_id INTO caller_empresa_id, caller_rol, caller_sucursal_id
    FROM public.usuarios
    WHERE id = auth.uid();

    IF caller_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: Usuario no encontrado.';
    END IF;

    -- SIEMPRE obtener la lista completa de sucursales para consistencia.
    SELECT json_agg(s_info) INTO sucursales_list FROM (
        SELECT
            s.id,
            s.nombre,
            s.direccion,
            s.telefono,
            s.latitud,
            s.longitud,
            (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = s.id) as user_count,
            (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = s.id AND rol = 'Propietario') as propietarios_count,
            (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = s.id AND rol = 'Administrador') as administradores_count,
            (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = s.id AND rol = 'Empleado') as empleados_count
        FROM sucursales s
        WHERE s.empresa_id = caller_empresa_id
        ORDER BY s.nombre
    ) AS s_info;
    
    -- Los KPIs globales solo se calculan si el rol es Propietario.
    IF caller_rol = 'Propietario' THEN
        SELECT json_build_object(
            'total_sucursales', (SELECT COUNT(*) FROM sucursales WHERE empresa_id = caller_empresa_id),
            'total_empleados', (SELECT COUNT(*) FROM usuarios WHERE empresa_id = caller_empresa_id),
            'propietarios_count', (SELECT COUNT(*) FROM usuarios WHERE empresa_id = caller_empresa_id AND rol = 'Propietario'),
            'administradores_count', (SELECT COUNT(*) FROM usuarios WHERE empresa_id = caller_empresa_id AND rol = 'Administrador'),
            'empleados_count', (SELECT COUNT(*) FROM usuarios WHERE empresa_id = caller_empresa_id AND rol = 'Empleado')
        ) INTO kpis;
    ELSE
        kpis := '{}'::json;
    END IF;
    
    -- Devolver un objeto consistente.
    RETURN json_build_object(
        'sucursales', COALESCE(sucursales_list, '[]'::json),
        'kpis', kpis,
        'user_sucursal_id', caller_sucursal_id -- Devolver esto para la lógica de redirección
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- Función 2: Obtener los detalles de una sucursal específica (sin cambios)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_sucursal_details(p_sucursal_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    target_empresa_id uuid;
    sucursal_details json;
    users_list json;
    kpis json;
BEGIN
    SELECT empresa_id INTO caller_empresa_id FROM usuarios WHERE id = auth.uid();
    SELECT empresa_id INTO target_empresa_id FROM sucursales WHERE id = p_sucursal_id;

    IF caller_empresa_id IS NULL OR target_empresa_id IS NULL OR caller_empresa_id != target_empresa_id THEN
        RAISE EXCEPTION 'Acceso denegado a esta sucursal.';
    END IF;

    SELECT to_json(s) INTO sucursal_details FROM (
        SELECT id, nombre, direccion, telefono, latitud, longitud FROM sucursales WHERE id = p_sucursal_id
    ) s;

    SELECT json_agg(u) INTO users_list FROM (
        SELECT id, nombre_completo, correo, rol, avatar, created_at, sucursal_id
        FROM usuarios
        WHERE sucursal_id = p_sucursal_id
        ORDER BY rol, nombre_completo
    ) u;

    SELECT json_build_object(
        'total_company_users', (SELECT COUNT(*) FROM public.usuarios WHERE empresa_id = caller_empresa_id),
        'propietarios_count', (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = p_sucursal_id AND rol = 'Propietario'),
        'administradores_count', (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = p_sucursal_id AND rol = 'Administrador'),
        'empleados_count', (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = p_sucursal_id AND rol = 'Empleado')
    ) INTO kpis;
    
    RETURN json_build_object(
        'details', sucursal_details,
        'users', COALESCE(users_list, '[]'::json),
        'kpis', kpis
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- Función 3: Crear una nueva sucursal (sin cambios)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_sucursal(
    p_nombre text,
    p_direccion text,
    p_telefono text,
    p_latitud numeric,
    p_longitud numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
    plan_id_from_license uuid;
    sucursal_count int;
    max_sucursales int;
    new_sucursal_id uuid;
BEGIN
    SELECT empresa_id, rol INTO caller_empresa_id, caller_rol
    FROM public.usuarios WHERE id = auth.uid();

    IF caller_rol != 'Propietario' THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de Propietario.';
    END IF;

    SELECT l.plan_id INTO plan_id_from_license FROM public.licencias l WHERE l.empresa_id = caller_empresa_id;
    IF plan_id_from_license IS NULL THEN
        RAISE EXCEPTION 'Error de consistencia de datos: La licencia de la empresa no está vinculada a un plan.';
    END IF;

    SELECT pc.valor::int INTO max_sucursales
    FROM public.plan_caracteristicas pc
    JOIN public.caracteristicas c ON pc.caracteristica_id = c.id
    WHERE pc.plan_id = plan_id_from_license AND c.codigo_interno = 'MAX_BRANCHES';
    IF max_sucursales IS NULL THEN
        RAISE EXCEPTION 'La configuración de límite de sucursales no está definida para el plan actual.';
    END IF;

    SELECT COUNT(*) INTO sucursal_count FROM public.sucursales WHERE empresa_id = caller_empresa_id;
    IF sucursal_count >= max_sucursales THEN
        RAISE EXCEPTION 'Límite de sucursales alcanzado para el plan actual.';
    END IF;
    
    INSERT INTO public.sucursales(empresa_id, nombre, direccion, telefono, latitud, longitud)
    VALUES (caller_empresa_id, p_nombre, p_direccion, p_telefono, p_latitud, p_longitud)
    RETURNING id INTO new_sucursal_id;

    RETURN new_sucursal_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- Función 4: Actualizar una sucursal existente (sin cambios)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_sucursal(
    p_sucursal_id uuid,
    p_nombre text,
    p_direccion text,
    p_telefono text,
    p_latitud numeric,
    p_longitud numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
    target_empresa_id uuid;
BEGIN
    SELECT empresa_id, rol INTO caller_empresa_id, caller_rol FROM public.usuarios WHERE id = auth.uid();
    IF caller_rol NOT IN ('Propietario', 'Administrador') THEN RAISE EXCEPTION 'Acceso denegado.'; END IF;

    SELECT empresa_id INTO target_empresa_id FROM public.sucursales WHERE id = p_sucursal_id;
    IF target_empresa_id IS NULL OR target_empresa_id != caller_empresa_id THEN
        RAISE EXCEPTION 'Sucursal no encontrada o no pertenece a tu empresa.';
    END IF;

    UPDATE public.sucursales
    SET nombre = p_nombre, direccion = p_direccion, telefono = p_telefono, latitud = p_latitud, longitud = p_longitud
    WHERE id = p_sucursal_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- Función 5: Eliminar una sucursal (sin cambios)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_sucursal(p_sucursal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
    target_empresa_id uuid;
    branch_count int;
    assigned_users_list text;
BEGIN
    SELECT empresa_id, rol INTO caller_empresa_id, caller_rol
    FROM public.usuarios WHERE id = auth.uid();

    IF caller_rol != 'Propietario' THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de Propietario.';
    END IF;

    SELECT empresa_id INTO target_empresa_id FROM public.sucursales WHERE id = p_sucursal_id;
    IF target_empresa_id IS NULL OR target_empresa_id != caller_empresa_id THEN
        RAISE EXCEPTION 'Sucursal no encontrada o no pertenece a tu empresa.';
    END IF;
    
    SELECT COUNT(*) INTO branch_count FROM public.sucursales WHERE empresa_id = caller_empresa_id;
    IF branch_count <= 1 THEN
        RAISE EXCEPTION 'No se puede eliminar la única sucursal de la empresa.';
    END IF;
    
    SELECT string_agg(nombre_completo, ', ') INTO assigned_users_list
    FROM public.usuarios
    WHERE sucursal_id = p_sucursal_id;

    IF assigned_users_list IS NOT NULL THEN
        RAISE EXCEPTION 'No se puede eliminar la sucursal. Los siguientes usuarios aún están asignados a ella: %. Por favor, reasigna o elimina a estos usuarios primero desde la página de detalle de la sucursal.', assigned_users_list;
    END IF;

    DELETE FROM public.sucursales WHERE id = p_sucursal_id;
END;
$$;

-- =============================================================================
-- Fin del script.
-- =============================================================================