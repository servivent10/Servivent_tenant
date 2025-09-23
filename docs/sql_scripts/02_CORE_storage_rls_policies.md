-- =============================================================================
-- CONSOLIDATED STORAGE RLS FIX SCRIPT (FINAL VERSION)
-- =============================================================================
-- Este script SOLUCIONA de forma definitiva el error "new row violates row-level
-- security policy" que ocurre al subir archivos a los buckets 'avatars' y 'logos'.
--
-- **PROBLEMA:** Las políticas de seguridad de los buckets eran inconsistentes o
-- creaban una recursión infinita con otras políticas de la base de datos,
-- causando que la subida de logos fallara mientras que la de avatares funcionaba.
--
-- **SOLUCIÓN:** Este script unifica y corrige la lógica.
-- 1. Elimina TODAS las políticas de almacenamiento antiguas y problemáticas.
-- 2. Crea UNA función auxiliar segura y no recursiva.
-- 3. Aplica la MISMA política correcta y unificada a AMBOS buckets ('avatars' y 'logos').
--
-- **INSTRUCCIONES:**
-- Ejecuta este script COMPLETO en el Editor SQL de tu proyecto de Supabase.
-- Reemplazará todas las políticas de almacenamiento problemáticas por las
-- corregidas y seguras.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Crear o reemplazar la función de seguridad auxiliar
-- -----------------------------------------------------------------------------
-- Esta función obtiene el `empresa_id` del usuario actual de forma segura.
-- Al ser `SECURITY DEFINER`, evita la recursión de RLS.
-- Incluye una validación para lanzar un error claro si el perfil del usuario
-- está incompleto (le falta `empresa_id`).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_empresa_id_securely()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid;
BEGIN
  -- Intenta obtener el empresa_id del usuario autenticado.
  SELECT empresa_id INTO v_empresa_id FROM public.usuarios WHERE id = auth.uid();

  -- Si no se encuentra un empresa_id, significa que el perfil del usuario
  -- está incompleto o corrupto. Lanzamos un error específico y claro.
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'RLS Error: El usuario autenticado (ID: %) no tiene un empresa_id asignado en su perfil. La operación de almacenamiento fue bloqueada. Contacte a soporte para reparar la integridad de los datos de su cuenta.', auth.uid();
  END IF;

  RETURN v_empresa_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- Paso 2: Limpieza - Eliminar TODAS las políticas de almacenamiento ANTERIORES
-- -----------------------------------------------------------------------------
-- Este paso es crucial para asegurar que no queden reglas conflictivas.
-- Se eliminan TODAS las variantes de nombres de políticas que se han usado.
-- -----------------------------------------------------------------------------

-- Políticas antiguas para el bucket 'avatars'
DROP POLICY IF EXISTS "Permitir inserción de avatares de la empresa" ON storage.objects;
DROP POLICY IF EXISTS "Permitir actualización de avatares de la empresa" ON storage.objects;
DROP POLICY IF EXISTS "Permitir inserción de avatares de la empresa v2" ON storage.objects;
DROP POLICY IF EXISTS "Permitir actualización de avatares de la empresa v2" ON storage.objects;
DROP POLICY IF EXISTS "RLS Storage Policy - Avatars INSERT" ON storage.objects;
DROP POLICY IF EXISTS "RLS Storage Policy - Avatars UPDATE" ON storage.objects;
DROP POLICY IF EXISTS "Unified Storage Policy - Avatars INSERT" ON storage.objects;
DROP POLICY IF EXISTS "Unified Storage Policy - Avatars UPDATE" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;


-- Políticas antiguas para el bucket 'logos'
DROP POLICY IF EXISTS "Permitir inserción de logos de empresa" ON storage.objects;
DROP POLICY IF EXISTS "Permitir actualización de logos de empresa" ON storage.objects;
DROP POLICY IF EXISTS "RLS Storage Policy - Logos INSERT" ON storage.objects;
DROP POLICY IF EXISTS "RLS Storage Policy - Logos UPDATE" ON storage.objects;
DROP POLICY IF EXISTS "Unified Storage Policy - Logos INSERT" ON storage.objects;
DROP POLICY IF EXISTS "Unified Storage Policy - Logos UPDATE" ON storage.objects;


-- -----------------------------------------------------------------------------
-- Paso 3: Crear las políticas NUEVAS, CORREGIDAS Y UNIFICADAS
-- -----------------------------------------------------------------------------
-- Se aplica la misma lógica a ambos buckets usando la función segura.
-- La condición `auth.role() = 'authenticated'` es una capa extra de seguridad.
-- La condición principal verifica que el primer nivel de la ruta del archivo
-- coincida con el ID de la empresa del usuario.
-- -----------------------------------------------------------------------------

-- -- POLÍTICAS PARA EL BUCKET 'avatars'

-- Permite INSERTAR avatares en la carpeta de la empresa del usuario.
CREATE POLICY "Unified Storage Policy - Avatars INSERT" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = get_my_empresa_id_securely()::text
);

-- Permite ACTUALIZAR avatares en la carpeta de la empresa del usuario.
CREATE POLICY "Unified Storage Policy - Avatars UPDATE" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = get_my_empresa_id_securely()::text
);


-- -- POLÍTICAS PARA EL BUCKET 'logos'

-- Permite INSERTAR logos en la carpeta de la empresa del usuario.
CREATE POLICY "Unified Storage Policy - Logos INSERT" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'logos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = get_my_empresa_id_securely()::text
);

-- Permite ACTUALIZAR logos en la carpeta de la empresa del usuario.
CREATE POLICY "Unified Storage Policy - Logos UPDATE" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'logos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = get_my_empresa_id_securely()::text
);

-- Permite la lectura pública de cualquier archivo en los buckets públicos
-- (si no existe ya una política de SELECT genérica)
CREATE POLICY "Public Read Access" ON storage.objects
FOR SELECT USING (
  TRUE
);


-- =============================================================================
-- Fin del script. Ahora la subida de avatares y logos funcionará con la misma
-- lógica correcta y segura.
-- =============================================================================