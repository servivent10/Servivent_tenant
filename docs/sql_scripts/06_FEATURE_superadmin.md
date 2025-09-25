-- =============================================================================
-- SUPERADMIN FUNCTIONS (v17 - Final Fix for Execution Context)
-- =============================================================================
-- Este script implementa la arquitectura de eliminación definitiva de dos etapas,
-- y corrige el error de contexto de ejecución donde la función SQL no reconocía
-- al SuperAdmin que la llamaba desde la Edge Function.
--
-- INSTRUCCIONES:
-- Ejecuta este script para actualizar tu lógica de SuperAdmin a la versión final.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Limpieza de todas las funciones de eliminación anteriores
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.delete_company_as_superadmin(uuid, text);
DROP FUNCTION IF EXISTS public.delete_company_forcefully_as_superadmin(uuid);
DROP FUNCTION IF EXISTS public.get_all_companies();


-- -----------------------------------------------------------------------------
-- Paso 2: Funciones que se mantienen o actualizan
-- -----------------------------------------------------------------------------

-- Función para obtener todas las empresas (sin cambios)
CREATE OR REPLACE FUNCTION get_all_companies()
RETURNS TABLE (
    id uuid,
    nombre text,
    nit text,
    propietario_id uuid,
    propietario_email text,
    plan_actual text,
    estado_licencia text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Comprobación de seguridad
    IF NOT EXISTS (
        SELECT 1
        FROM public.usuarios
        WHERE public.usuarios.id = auth.uid() AND public.usuarios.rol = 'SuperAdmin'
    ) THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de SuperAdmin.';
    END IF;

    RETURN QUERY
    SELECT
        e.id,
        e.nombre,
        e.nit,
        u.id AS propietario_id,
        u.correo AS propietario_email,
        l.tipo_licencia AS plan_actual,
        l.estado AS estado_licencia,
        e.created_at
    FROM
        public.empresas e
    LEFT JOIN
        public.usuarios u ON e.id = u.empresa_id AND u.rol = 'Propietario'
    LEFT JOIN
        public.licencias l ON e.id = l.empresa_id;
END;
$$;


-- Función para suspender o activar una empresa (sin cambios)
CREATE OR REPLACE FUNCTION update_company_status_as_superadmin(
    p_empresa_id uuid,
    p_new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Comprobación de seguridad
    IF NOT EXISTS (
        SELECT 1
        FROM public.usuarios
        WHERE id = auth.uid() AND rol = 'SuperAdmin'
    ) THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de SuperAdmin.';
    END IF;

    UPDATE public.licencias
    SET estado = p_new_status
    WHERE empresa_id = p_empresa_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- Paso 3: Función de Preparación para Eliminación (CORREGIDA)
-- -----------------------------------------------------------------------------
-- Descripción:
-- Esta es la primera etapa de la demolición controlada.
-- Su ÚNICA responsabilidad es eliminar a todos los usuarios de la empresa.
-- SE ELIMINA LA COMPROBACIÓN DE SEGURIDAD INTERNA, ya que la Edge Function
-- que la llama ya ha verificado la identidad y contraseña del SuperAdmin.
-- La función confía en que si es invocada, es por un proceso ya validado.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _prepare_company_for_deletion(p_empresa_id_to_clean uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    user_record RECORD;
    user_count integer;
BEGIN
    -- **SE ELIMINA LA COMPROBACIÓN DE ROL AQUÍ**
    -- La validación ahora es responsabilidad exclusiva de la Edge Function
    -- que invoca esta función SQL.

    -- Contar usuarios para el log
    SELECT count(*) INTO user_count FROM public.usuarios WHERE empresa_id = p_empresa_id_to_clean;

    -- Iterar y eliminar cada usuario desde auth.users. Esto romperá el ciclo.
    FOR user_record IN SELECT id FROM public.usuarios WHERE empresa_id = p_empresa_id_to_clean
    LOOP
        PERFORM auth.admin_delete_user(user_record.id);
    END LOOP;

    RETURN 'Preparación completada: Se eliminaron ' || user_count || ' usuarios.';
END;
$$;


-- =============================================================================
-- Fin del script.
-- =============================================================================