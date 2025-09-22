-- =============================================================================
-- REGISTRATION TRIGGER REMOVAL SCRIPT (ANTES FIX)
-- =============================================================================
-- Este script **ELIMINA** el trigger de base de datos que anteriormente se usaba
-- para la creación de perfiles. Este trigger causaba errores porque no podía
-- asignar la `empresa_id` al nuevo usuario, un campo que es obligatorio.
--
-- La nueva lógica se maneja directamente en la Edge Function `create-company-user`,
-- que ahora realiza un `INSERT` directo y completo en la tabla `usuarios`.
--
-- **INSTRUCCIONES:**
-- 1. Ve al "SQL Editor" en tu proyecto de Supabase.
-- 2. Copia y pega el contenido completo de este archivo.
-- 3. Haz clic en "RUN" para ejecutarlo.
--
-- ¿QUÉ HACE ESTE SCRIPT?
-- 1. Elimina el trigger `on_auth_user_created` de la tabla `auth.users`.
-- 2. Elimina la función `handle_new_user` que ya no es necesaria.
--
-- Esto es crucial para evitar errores de "clave duplicada" con la nueva lógica.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Eliminar el trigger de la tabla auth.users
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;


-- -----------------------------------------------------------------------------
-- Paso 2: Eliminar la función que manejaba el trigger (ya no es necesaria)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.handle_new_user();


-- =============================================================================
-- Fin del script.
-- =============================================================================
