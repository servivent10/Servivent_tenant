-- =============================================================================
-- COMPANY LOGO MANAGEMENT SETUP
-- =============================================================================
-- Este archivo contiene las instrucciones y los scripts SQL necesarios para
-- habilitar la funcionalidad de gestión de logos de empresa.
--
-- INSTRUCCIONES:
-- 1. Crea un nuevo Bucket en Supabase Storage.
-- 2. Ejecuta el script SQL en el Editor SQL de tu proyecto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Crear el Bucket de Storage para Logos
-- -----------------------------------------------------------------------------
-- 1. Ve a la sección "Storage" en tu panel de Supabase.
-- 2. Haz clic en "New bucket".
-- 3. Nombre del bucket: `logos`
-- 4. Asegúrate de que la opción "Public bucket" esté marcada (ON).
-- 5. Haz clic en "Create bucket".
--
-- A continuación, vamos a aplicar políticas de seguridad para restringir quién
-- puede subir o modificar los logos.

-- -----------------------------------------------------------------------------
-- Paso 2: Ejecutar este script SQL completo
-- -----------------------------------------------------------------------------
-- Este script crea las políticas de seguridad para el bucket `logos` y la
-- función necesaria para que los propietarios actualicen la información de su
-- empresa.
-- =============================================================================

-- POLÍTICAS DE SEGURIDAD PARA EL BUCKET 'logos'
-- Estas políticas aseguran que un usuario solo pueda subir/actualizar el logo
-- de su propia empresa.

-- 1. Política de INSERCIÓN de logos
-- Permite que un usuario autenticado suba un logo SÓLO si la ruta
-- coincide con el ID de su propia empresa.
CREATE POLICY "Permitir inserción de logos de empresa"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'logos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (
    SELECT empresa_id::text FROM public.usuarios WHERE id = auth.uid()
  )
);

-- 2. Política de ACTUALIZACIÓN de logos
-- Permite que un usuario autenticado actualice un logo SÓLO si la ruta
-- coincide con el ID de su propia empresa.
CREATE POLICY "Permitir actualización de logos de empresa"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'logos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (
    SELECT empresa_id::text FROM public.usuarios WHERE id = auth.uid()
  )
);


-- FUNCIÓN RPC PARA ACTUALIZAR LA INFORMACIÓN DE LA EMPRESA

-- 1. Función para actualizar los datos de la empresa
-- Permite a un Propietario actualizar el nombre, NIT, dirección, teléfono
-- y la URL del logo de su propia empresa.
CREATE OR REPLACE FUNCTION update_company_info(
    p_nombre text,
    p_nit text,
    p_direccion text,
    p_telefono text,
    p_logo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
BEGIN
    -- 1. Validar permisos del que llama (solo Propietario)
    SELECT empresa_id, rol INTO caller_empresa_id, caller_rol
    FROM public.usuarios WHERE id = auth.uid();

    IF caller_rol != 'Propietario' THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de Propietario.';
    END IF;

    -- 2. Actualizar la tabla de empresas
    UPDATE public.empresas
    SET
        nombre = p_nombre,
        nit = p_nit,
        direccion = p_direccion,
        telefono = p_telefono,
        logo = p_logo
    WHERE id = caller_empresa_id;
END;
$$;


-- =============================================================================
-- Fin del script.
-- =============================================================================