-- =============================================================================
-- USER MANAGEMENT FIX & COMPLETE FUNCTIONS (v5 - Edge Function Migration)
-- =============================================================================
-- Este script actualiza la gestión de usuarios para reflejar que la eliminación
-- ahora se maneja a través de una Edge Function, eliminando la función RPC
-- `delete_company_user` que causaba errores de permisos.
--
-- INSTRUCCIONES:
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Prerrequisito: Añadir columna `sucursal_id` a la tabla `usuarios`
-- -----------------------------------------------------------------------------
ALTER TABLE public.usuarios
ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES public.sucursales(id);

-- -----------------------------------------------------------------------------
-- Función 1: Obtener usuarios y sucursales de la empresa
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_company_users()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
    caller_sucursal_id uuid;
    users_list json;
    branches_list json;
BEGIN
    -- Obtener datos del usuario que llama a la función
    SELECT empresa_id, rol, sucursal_id INTO caller_empresa_id, caller_rol, caller_sucursal_id
    FROM public.usuarios
    WHERE id = auth.uid();

    -- Comprobar si el usuario tiene un rol válido
    IF caller_rol NOT IN ('Propietario', 'Administrador') THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;

    -- Obtener la lista de usuarios según el rol
    IF caller_rol = 'Propietario' THEN
        SELECT json_agg(u) INTO users_list
        FROM (
            SELECT u.id, u.nombre_completo, u.correo, u.rol, u.avatar, u.created_at, u.sucursal_id, s.nombre as sucursal_nombre
            FROM usuarios u
            LEFT JOIN sucursales s ON u.sucursal_id = s.id
            WHERE u.empresa_id = caller_empresa_id
            ORDER BY u.created_at DESC
        ) u;
    ELSE -- Es Administrador
        SELECT json_agg(u) INTO users_list
        FROM (
            SELECT u.id, u.nombre_completo, u.correo, u.rol, u.avatar, u.created_at, u.sucursal_id, s.nombre as sucursal_nombre
            FROM usuarios u
            LEFT JOIN sucursales s ON u.sucursal_id = s.id
            WHERE u.empresa_id = caller_empresa_id AND u.sucursal_id = caller_sucursal_id
            ORDER BY u.created_at DESC
        ) u;
    END IF;

    -- Obtener siempre la lista de todas las sucursales de la empresa (para el dropdown)
    SELECT json_agg(s) INTO branches_list
    FROM (
        SELECT id, nombre FROM sucursales WHERE empresa_id = caller_empresa_id ORDER BY nombre
    ) s;

    -- Devolver el resultado combinado
    RETURN json_build_object(
        'users', COALESCE(users_list, '[]'::json),
        'branches', COALESCE(branches_list, '[]'::json)
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- Función 2: Actualizar el perfil del propio usuario
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_my_profile(
    p_nombre_completo text,
    p_avatar text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.usuarios
    SET
        nombre_completo = p_nombre_completo,
        avatar = p_avatar
    WHERE id = auth.uid();
END;
$$;

-- -----------------------------------------------------------------------------
-- Función 3: Actualizar un usuario existente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_company_user(
    p_user_id_to_update uuid,
    p_nombre_completo text,
    p_rol text,
    p_sucursal_id uuid,
    p_avatar text,
    p_password text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
    caller_sucursal_id uuid;
    target_empresa_id uuid;
    target_rol text;
BEGIN
    SELECT empresa_id, rol, sucursal_id INTO caller_empresa_id, caller_rol, caller_sucursal_id
    FROM public.usuarios WHERE id = auth.uid();

    IF caller_rol NOT IN ('Propietario', 'Administrador') THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;

    SELECT empresa_id, rol INTO target_empresa_id, target_rol FROM public.usuarios WHERE id = p_user_id_to_update;
    IF target_empresa_id IS NULL OR target_empresa_id != caller_empresa_id THEN
        RAISE EXCEPTION 'Usuario no encontrado o no pertenece a tu empresa.';
    END IF;

    IF target_rol = 'Propietario' AND auth.uid() != p_user_id_to_update THEN
        RAISE EXCEPTION 'Un Administrador no puede editar al Propietario de la empresa.';
    END IF;
    IF target_rol = 'Propietario' AND p_rol != 'Propietario' THEN
        RAISE EXCEPTION 'El rol del Propietario no puede ser modificado.';
    END IF;

    UPDATE public.usuarios
    SET
        nombre_completo = p_nombre_completo,
        rol = p_rol,
        sucursal_id = p_sucursal_id,
        avatar = p_avatar
    WHERE id = p_user_id_to_update;

    IF p_password IS NOT NULL AND p_password != '' THEN
        IF char_length(p_password) < 6 THEN
            RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres.';
        END IF;
        
        UPDATE auth.users
        SET encrypted_password = crypt(p_password, gen_salt('bf'))
        WHERE id = p_user_id_to_update;
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Función 4: Eliminar un usuario de la empresa (OBSOLETA)
-- -----------------------------------------------------------------------------
-- La función `delete_company_user` ha sido eliminada. La lógica ahora se maneja
-- en la Edge Function 'delete-company-user' para evitar problemas de permisos.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.delete_company_user(uuid);


-- -----------------------------------------------------------------------------
-- Función 5: Obtener el perfil del usuario que llama (para Edge Functions)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_caller_profile_safely()
RETURNS TABLE (
    empresa_id uuid,
    rol text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.empresa_id,
        u.rol
    FROM
        usuarios u
    WHERE
        u.id = auth.uid()
    LIMIT 1;
END;
$$;

-- =============================================================================
-- Fin del script.
-- =============================================================================