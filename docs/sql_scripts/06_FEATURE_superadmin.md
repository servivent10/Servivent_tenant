-- =============================================================================
-- SUPERADMIN FUNCTIONS (v19 - Full Edge Function Logic)
-- =============================================================================
-- Este script elimina la función de preparación de base de datos que causaba
-- errores de permisos. Toda la lógica de eliminación, incluyendo la de los
-- usuarios, ahora reside de forma segura y correcta dentro de la Edge Function.
--
-- INSTRUCCIONES:
-- Ejecuta este script para limpiar tu base de datos de la función obsoleta.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Limpieza de todas las funciones de eliminación anteriores
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.delete_company_as_superadmin(uuid);
DROP FUNCTION IF EXISTS public.delete_company_forcefully_as_superadmin(uuid);
DROP FUNCTION IF EXISTS public.get_all_companies();
-- **NUEVO:** Eliminar la función de preparación que causaba el error de permisos.
DROP FUNCTION IF EXISTS public._prepare_company_for_deletion(uuid);


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


-- =============================================================================
-- Fin del script.
-- =============================================================================