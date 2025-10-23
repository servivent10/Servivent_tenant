-- =============================================================================
-- SCRIPT DE ELIMINACIÓN: GOOGLE CONTACTS INTEGRATION (V1)
-- =============================================================================
-- Este script elimina por completo la infraestructura de base de datos para la
-- integración con Google Contacts.
--
-- QUÉ HACE:
-- 1. Elimina las funciones RPC relacionadas con la integración.
-- 2. Elimina la tabla `integraciones_google`.
--
-- INSTRUCCIONES:
-- Ejecuta este script para limpiar la base de datos de la funcionalidad.
-- =============================================================================

-- Paso 1: Eliminar las funciones RPC
DROP FUNCTION IF EXISTS public.store_google_tokens(uuid, text, text, text, integer);
DROP FUNCTION IF EXISTS public.get_decrypted_google_tokens();
DROP FUNCTION IF EXISTS public.get_google_integration_status();
DROP FUNCTION IF EXISTS public.disconnect_google_integration();

-- Paso 2: Eliminar la tabla
DROP TABLE IF EXISTS public.integraciones_google;

-- =============================================================================
-- Fin del script de eliminación.
-- =============================================================================
