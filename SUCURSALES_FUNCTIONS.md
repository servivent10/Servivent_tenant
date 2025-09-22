-- =============================================================================
-- SUCURSALES & USER MANAGEMENT FUNCTIONS
-- =============================================================================
-- Este script crea las funciones PostgreSQL necesarias para el nuevo módulo
-- de gestión de Sucursales y la gestión de usuarios integrada.
--
-- **INSTRUCCIONES:**
-- Por favor, ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Función 1: Obtener la lista de sucursales de la empresa (v2)
-- -----------------------------------------------------------------------------
-- Descripción:
-- Recupera datos para la página principal de "Sucursales". AHORA INCLUYE
-- un desglose de roles tanto en los KPIs globales como en cada sucursal.
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

    -- Comprobar si el usuario tiene un rol válido
    IF caller_rol IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: Usuario no encontrado.';
    END IF;

    -- Lógica para Propietario
    IF caller_rol = 'Propietario' THEN
        -- Construir la lista de sucursales con conteo de usuarios y desglose de roles
        SELECT json_agg(s_info) INTO sucursales_list FROM (
            SELECT
                s.id,
                s.nombre,
                s.direccion,
                s.telefono,
                (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = s.id) as user_count,
                (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = s.id AND rol = 'Propietario') as propietarios_count,
                (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = s.id AND rol = 'Administrador') as administradores_count,
                (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = s.id AND rol = 'Empleado') as empleados_count
            FROM sucursales s
            WHERE s.empresa_id = caller_empresa_id
            ORDER BY s.nombre
        ) AS s_info;
        
        -- Calcular KPIs globales con desglose de roles
        SELECT json_build_object(
            'total_sucursales', (SELECT COUNT(*) FROM sucursales WHERE empresa_id = caller_empresa_id),
            'total_empleados', (SELECT COUNT(*) FROM usuarios WHERE empresa_id = caller_empresa_id),
            'propietarios_count', (SELECT COUNT(*) FROM usuarios WHERE empresa_id = caller_empresa_id AND rol = 'Propietario'),
            'administradores_count', (SELECT COUNT(*) FROM usuarios WHERE empresa_id = caller_empresa_id AND rol = 'Administrador'),
            'empleados_count', (SELECT COUNT(*) FROM usuarios WHERE empresa_id = caller_empresa_id AND rol = 'Empleado')
        ) INTO kpis;

    ELSE -- Lógica para Administrador y Empleado
        -- No necesitan la lista, solo el ID de su sucursal para la redirección
        SELECT json_build_object('user_sucursal_id', caller_sucursal_id) INTO sucursales_list;
        kpis := '{}'::json;
    END IF;

    RETURN json_build_object(
        'sucursales', COALESCE(sucursales_list, '[]'::json),
        'kpis', kpis
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- Función 2: Obtener los detalles de una sucursal específica (v3)
-- -----------------------------------------------------------------------------
-- Descripción:
-- Recupera toda la información necesaria para la página de detalle de una
-- sucursal. AHORA INCLUYE un desglose de roles para la sucursal actual en
-- el objeto `kpis`.
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
    -- Validar que el usuario pertenece a la misma empresa que la sucursal
    SELECT empresa_id INTO caller_empresa_id FROM usuarios WHERE id = auth.uid();
    SELECT empresa_id INTO target_empresa_id FROM sucursales WHERE id = p_sucursal_id;

    IF caller_empresa_id IS NULL OR target_empresa_id IS NULL OR caller_empresa_id != target_empresa_id THEN
        RAISE EXCEPTION 'Acceso denegado a esta sucursal.';
    END IF;

    -- Obtener detalles de la sucursal
    SELECT to_json(s) INTO sucursal_details FROM (
        SELECT id, nombre, direccion, telefono FROM sucursales WHERE id = p_sucursal_id
    ) s;

    -- Obtener lista de usuarios de esa sucursal
    SELECT json_agg(u) INTO users_list FROM (
        SELECT id, nombre_completo, correo, rol, avatar, created_at, sucursal_id
        FROM usuarios
        WHERE sucursal_id = p_sucursal_id
        ORDER BY rol, nombre_completo
    ) u;

    -- Calcular KPIs: Total de usuarios en TODA la empresa y desglose de roles en ESTA sucursal.
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
-- Función 3: Crear una nueva sucursal
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_sucursal(
    p_nombre text,
    p_direccion text,
    p_telefono text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
    sucursal_count int;
    max_sucursales int;
    plan_type text;
    new_sucursal_id uuid;
BEGIN
    -- 1. Validar permisos del que llama (solo Propietario)
    SELECT empresa_id, rol INTO caller_empresa_id, caller_rol
    FROM public.usuarios WHERE id = auth.uid();

    IF caller_rol != 'Propietario' THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de Propietario.';
    END IF;

    -- 2. Verificar el límite de sucursales del plan
    SELECT tipo_licencia INTO plan_type FROM public.licencias WHERE empresa_id = caller_empresa_id;
    SELECT COUNT(*) INTO sucursal_count FROM public.sucursales WHERE empresa_id = caller_empresa_id;

    IF plan_type LIKE '%Emprendedor%' THEN max_sucursales := 1;
    ELSIF plan_type LIKE '%Profesional%' OR plan_type LIKE '%Prueba Gratuita%' THEN max_sucursales := 3;
    ELSE max_sucursales := 9999; -- Corporativo o desconocido
    END IF;

    IF sucursal_count >= max_sucursales THEN
        RAISE EXCEPTION 'Límite de sucursales alcanzado para el plan actual.';
    END IF;
    
    -- 3. Insertar la nueva sucursal
    INSERT INTO public.sucursales(empresa_id, nombre, direccion, telefono)
    VALUES (caller_empresa_id, p_nombre, p_direccion, p_telefono)
    RETURNING id INTO new_sucursal_id;

    RETURN new_sucursal_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- Función 4: Actualizar una sucursal existente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_sucursal(
    p_sucursal_id uuid,
    p_nombre text,
    p_direccion text,
    p_telefono text
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
    -- 1. Validar permisos (Propietario o Administrador)
    SELECT empresa_id, rol INTO caller_empresa_id, caller_rol
    FROM public.usuarios WHERE id = auth.uid();

    IF caller_rol NOT IN ('Propietario', 'Administrador') THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;

    -- 2. Verificar que la sucursal a editar pertenece a la empresa
    SELECT empresa_id INTO target_empresa_id FROM public.sucursales WHERE id = p_sucursal_id;
    IF target_empresa_id IS NULL OR target_empresa_id != caller_empresa_id THEN
        RAISE EXCEPTION 'Sucursal no encontrada o no pertenece a tu empresa.';
    END IF;

    -- 3. Actualizar
    UPDATE public.sucursales
    SET
        nombre = p_nombre,
        direccion = p_direccion,
        telefono = p_telefono
    WHERE id = p_sucursal_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- Función 5: Eliminar una sucursal
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
    user_count int;
    branch_count int;
BEGIN
    -- 1. Validar permisos (solo Propietario)
    SELECT empresa_id, rol INTO caller_empresa_id, caller_rol
    FROM public.usuarios WHERE id = auth.uid();

    IF caller_rol != 'Propietario' THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de Propietario.';
    END IF;

    -- 2. Verificar que la sucursal pertenece a la empresa
    SELECT empresa_id INTO target_empresa_id FROM public.sucursales WHERE id = p_sucursal_id;
    IF target_empresa_id IS NULL OR target_empresa_id != caller_empresa_id THEN
        RAISE EXCEPTION 'Sucursal no encontrada o no pertenece a tu empresa.';
    END IF;
    
    -- 3. Verificar que no es la última sucursal
    SELECT COUNT(*) INTO branch_count FROM public.sucursales WHERE empresa_id = caller_empresa_id;
    IF branch_count <= 1 THEN
        RAISE EXCEPTION 'No se puede eliminar la única sucursal de la empresa.';
    END IF;
    
    -- 4. Verificar que no hay usuarios asignados a esta sucursal
    SELECT COUNT(*) INTO user_count FROM public.usuarios WHERE sucursal_id = p_sucursal_id;
    IF user_count > 0 THEN
        RAISE EXCEPTION 'No se puede eliminar una sucursal con usuarios asignados. Por favor, reasigna los usuarios primero.';
    END IF;

    -- 5. Eliminar
    DELETE FROM public.sucursales WHERE id = p_sucursal_id;
END;
$$;

-- =============================================================================
-- Fin del script.
-- =============================================================================