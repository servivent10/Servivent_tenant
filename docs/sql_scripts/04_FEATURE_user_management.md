-- =============================================================================
-- USER MANAGEMENT FIX & COMPLETE FUNCTIONS
-- =============================================================================
-- Este script SOLUCIONA el error "function not found" y habilita la
-- funcionalidad completa del módulo de gestión de usuarios.
--
-- **INSTRUCCIONES:**
-- Por favor, ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- También necesitarás tener un Bucket de Storage llamado 'avatars' con
-- políticas para permitir la subida y lectura pública de imágenes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Prerrequisito: Añadir columna `sucursal_id` a la tabla `usuarios`
-- -----------------------------------------------------------------------------
-- Esta columna es CRUCIAL para asignar usuarios a sucursales.
ALTER TABLE public.usuarios
ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES public.sucursales(id);

-- -----------------------------------------------------------------------------
-- Función 1: Obtener usuarios y sucursales de la empresa (CORREGIDA)
-- -----------------------------------------------------------------------------
-- Descripción:
-- Recupera la lista de usuarios para el Propietario o Administrador y la lista
-- de sucursales de la empresa.
-- - Propietario: Ve todos los usuarios de la empresa.
-- - Administrador: Ve solo los usuarios de su propia sucursal.
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
-- Función 3: Actualizar un usuario existente (CON CAMBIO DE CONTRASEÑA)
-- -----------------------------------------------------------------------------
-- Corrección (v2): Se reemplaza la llamada a `auth.admin_update_user_by_id` por
-- un `UPDATE` directo con encriptación usando `crypt`, para ser consistente con
-- las otras funciones de admin y evitar posibles problemas de permisos.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_company_user(
    p_user_id_to_update uuid,
    p_nombre_completo text,
    p_rol text,
    p_sucursal_id uuid,
    p_avatar text,
    p_password text DEFAULT NULL -- Parámetro opcional para contraseña
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions -- 'extensions' es necesario para pgcrypto (crypt)
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
    caller_sucursal_id uuid;
    target_empresa_id uuid;
    target_rol text;
BEGIN
    -- 1. Validar permisos del que llama
    SELECT empresa_id, rol, sucursal_id INTO caller_empresa_id, caller_rol, caller_sucursal_id
    FROM public.usuarios WHERE id = auth.uid();

    IF caller_rol NOT IN ('Propietario', 'Administrador') THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;

    -- 2. Asegurarse de que el usuario a editar pertenece a la misma empresa y obtener su rol
    SELECT empresa_id, rol INTO target_empresa_id, target_rol FROM public.usuarios WHERE id = p_user_id_to_update;
    IF target_empresa_id IS NULL OR target_empresa_id != caller_empresa_id THEN
        RAISE EXCEPTION 'Usuario no encontrado o no pertenece a tu empresa.';
    END IF;

    -- 2.1. Reglas de seguridad adicionales
    IF target_rol = 'Propietario' AND auth.uid() != p_user_id_to_update THEN
        RAISE EXCEPTION 'Un Administrador no puede editar al Propietario de la empresa.';
    END IF;
    IF target_rol = 'Propietario' AND p_rol != 'Propietario' THEN
        RAISE EXCEPTION 'El rol del Propietario no puede ser modificado.';
    END IF;

    -- 3. Actualizar la tabla public.usuarios
    UPDATE public.usuarios
    SET
        nombre_completo = p_nombre_completo,
        rol = p_rol,
        sucursal_id = p_sucursal_id,
        avatar = p_avatar
    WHERE id = p_user_id_to_update;

    -- 4. Si se proporcionó una nueva contraseña, actualizarla en auth.users
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
-- Función 4: Eliminar un usuario de la empresa
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_company_user(
    p_user_id_to_delete uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
    target_empresa_id uuid;
    target_rol text;
BEGIN
    -- 1. Validar permisos del que llama
    SELECT empresa_id, rol INTO caller_empresa_id, caller_rol
    FROM public.usuarios WHERE id = auth.uid();

    IF caller_rol NOT IN ('Propietario', 'Administrador') THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;
    
    -- No se puede auto-eliminar
    IF auth.uid() = p_user_id_to_delete THEN
        RAISE EXCEPTION 'No puedes eliminarte a ti mismo.';
    END IF;

    -- 2. Asegurarse de que el usuario a eliminar pertenece a la misma empresa
    SELECT empresa_id, rol INTO target_empresa_id, target_rol FROM public.usuarios WHERE id = p_user_id_to_delete;
    IF target_empresa_id IS NULL OR target_empresa_id != caller_empresa_id THEN
        RAISE EXCEPTION 'Usuario no encontrado o no pertenece a tu empresa.';
    END IF;

    -- Un Propietario no puede ser eliminado.
    IF target_rol = 'Propietario' THEN
      RAISE EXCEPTION 'No se puede eliminar a un usuario con el rol de Propietario.';
    END IF;

    -- 3. Eliminar de public.usuarios primero
    DELETE FROM public.usuarios WHERE id = p_user_id_to_delete;
    
    -- 4. Eliminar de auth.users
    PERFORM auth.admin_delete_user(p_user_id_to_delete);
END;
$$;

-- -----------------------------------------------------------------------------
-- Función 5: Obtener el perfil del usuario que llama (para Edge Functions)
-- -----------------------------------------------------------------------------
-- Descripción:
-- Esta función es una alternativa segura a un SELECT directo en la tabla de usuarios
-- desde una Edge Function. Al ser SECURITY DEFINER, evita problemas causados por
-- políticas RLS complejas o defectuosas que podrían impedir que la función verifique
-- los permisos del usuario que la invoca.
-- Devuelve la empresa y el rol del usuario autenticado que realiza la llamada.
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