-- =============================================================================
-- SUPERADMIN FUNCTIONS
-- =============================================================================
-- Este script crea las funciones PostgreSQL necesarias para el panel de SuperAdmin.
-- Por favor, ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Función 1: Obtener todas las empresas
-- -----------------------------------------------------------------------------
-- Descripción:
-- Esta función recupera una lista de todas las empresas registradas, uniendo
-- información clave del propietario (usuario) y el estado de su licencia.
-- Es SECURITY DEFINER para que pueda ser llamada por el SuperAdmin sin que las
-- políticas de RLS interfieran. Incluye una comprobación de seguridad para
-- asegurar que solo un SuperAdmin pueda ejecutarla.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_all_companies()
RETURNS TABLE (
    id uuid,
    nombre text,
    nit text,
    propietario_email text,
    plan_actual text,
    estado_licencia text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Comprobación de seguridad: Asegura que el usuario que llama tiene el rol 'SuperAdmin'
    IF NOT EXISTS (
        SELECT 1
        FROM public.usuarios
        WHERE public.usuarios.id = auth.uid() AND public.usuarios.rol = 'SuperAdmin'
    ) THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de SuperAdmin.';
    END IF;

    -- Devuelve la consulta con la información de todas las empresas
    RETURN QUERY
    SELECT
        e.id,
        e.nombre,
        e.nit,
        u.correo AS propietario_email,
        l.tipo_licencia AS plan_actual,
        l.estado AS estado_licencia,
        e.created_at
    FROM
        public.empresas e
    LEFT JOIN
        -- Une con usuarios para encontrar al propietario de cada empresa
        public.usuarios u ON e.id = u.empresa_id AND u.rol = 'Propietario'
    LEFT JOIN
        -- Une con licencias para obtener el plan y el estado
        public.licencias l ON e.id = l.empresa_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- Función 2: Actualizar el estado de una empresa
-- -----------------------------------------------------------------------------
-- Descripción:
-- Permite al SuperAdmin cambiar el estado de la licencia de una empresa
-- (por ejemplo, de 'Activa' a 'Suspendida' y viceversa).
-- También es SECURITY DEFINER y contiene la misma comprobación de rol.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_company_status_as_superadmin(
    p_empresa_id uuid,
    p_new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Comprobación de seguridad: Asegura que el usuario que llama tiene el rol 'SuperAdmin'
    IF NOT EXISTS (
        SELECT 1
        FROM public.usuarios
        WHERE id = auth.uid() AND rol = 'SuperAdmin'
    ) THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de SuperAdmin.';
    END IF;

    -- Actualiza el estado de la licencia para la empresa especificada
    UPDATE public.licencias
    SET estado = p_new_status
    WHERE empresa_id = p_empresa_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- Función 3: Eliminar una empresa y todos sus datos
-- -----------------------------------------------------------------------------
-- Descripción:
-- Esta es una función crítica que elimina permanentemente una empresa y toda
-- la información asociada a ella, incluyendo:
-- - Licencia
-- - Sucursales
-- - Perfiles de usuario (en la tabla `public.usuarios`)
-- - La propia empresa (en la tabla `public.empresas`)
-- - Las cuentas de autenticación de los usuarios (en `auth.users`)
-- IMPORTANTE: Esta función debe ser propiedad de un superusuario (como `postgres`)
-- para tener los permisos necesarios para eliminar de `auth.users`.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION delete_company_as_superadmin(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
-- SECURITY DEFINER es crucial aquí para permitir operaciones con privilegios elevados
SECURITY DEFINER
-- Asegura que podamos acceder a los esquemas 'public' y 'auth'
SET search_path = public, auth
AS $$
DECLARE
    v_user_id uuid;
    user_ids uuid[];
BEGIN
    -- 1. Comprobación de seguridad: Asegura que el que llama es SuperAdmin
    IF NOT EXISTS (
        SELECT 1
        FROM public.usuarios
        WHERE id = auth.uid() AND rol = 'SuperAdmin'
    ) THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de SuperAdmin.';
    END IF;

    -- 2. Recolecta todos los IDs de usuario asociados a la empresa a eliminar
    SELECT array_agg(id) INTO user_ids FROM public.usuarios WHERE empresa_id = p_empresa_id;

    -- 3. Elimina datos relacionados en el orden correcto para evitar errores de clave foránea
    DELETE FROM public.licencias WHERE empresa_id = p_empresa_id;
    DELETE FROM public.sucursales WHERE empresa_id = p_empresa_id;
    DELETE FROM public.usuarios WHERE empresa_id = p_empresa_id;
    DELETE FROM public.empresas WHERE id = p_empresa_id;

    -- 4. Elimina los usuarios del sistema de autenticación de Supabase (auth.users)
    -- Esta es la operación más delicada y requiere privilegios de superusuario.
    IF user_ids IS NOT NULL THEN
        FOREACH v_user_id IN ARRAY user_ids
        LOOP
            -- Ejecuta la eliminación en el esquema 'auth'
            DELETE FROM auth.users WHERE id = v_user_id;
        END LOOP;
    END IF;

END;
$$;

-- =============================================================================
-- Fin del script.
-- =============================================================================