-- =============================================================================
-- SCRIPT DE ELIMINACIÓN MANUAL Y SEGURA DE USUARIO
-- =============================================================================
-- OBJETIVO:
-- Elimina un usuario de `auth.users` que no se puede borrar desde la interfaz
-- debido a restricciones de clave foránea (foreign key) en `public.clientes`.
--
-- INSTRUCCIONES:
-- 1. ★★★ EDITA LA SIGUIENTE LÍNEA CON EL CORREO DEL USUARIO QUE QUIERES ELIMINAR ★★★
-- 2. Ejecuta el script completo.
-- =============================================================================

DO $$
DECLARE
    -- ▼▼▼ EDITA ESTA LÍNEA ▼▼▼
    v_user_email_to_delete text := 'EMAIL_DEL_USUARIO_A_ELIMINAR';
    -- ▲▲▲ EDITA ESTA LÍNEA ▲▲▲

    v_user_id_to_delete uuid;
    v_cliente_id_vinculado uuid;
BEGIN
    RAISE NOTICE '--- Iniciando eliminación segura para el usuario: % ---', v_user_email_to_delete;

    -- Paso 1: Buscar el ID del usuario en la tabla de autenticación.
    SELECT id INTO v_user_id_to_delete FROM auth.users WHERE email = v_user_email_to_delete;

    IF v_user_id_to_delete IS NULL THEN
        RAISE EXCEPTION 'ERROR: No se encontró ningún usuario en el sistema de autenticación con el correo "%". Verifica que el correo sea correcto.', v_user_email_to_delete;
    END IF;
    RAISE NOTICE ' -> Usuario encontrado en auth.users con ID: %', v_user_id_to_delete;

    -- Paso 2: Buscar y eliminar el perfil de cliente vinculado en `public.clientes`.
    SELECT id INTO v_cliente_id_vinculado FROM public.clientes WHERE auth_user_id = v_user_id_to_delete;

    IF v_cliente_id_vinculado IS NOT NULL THEN
        RAISE NOTICE ' -> Perfil de cliente vinculado encontrado (ID: %). Eliminándolo para romper la dependencia...', v_cliente_id_vinculado;
        DELETE FROM public.clientes WHERE id = v_cliente_id_vinculado;
        RAISE NOTICE ' -> ÉXITO: Perfil de cliente eliminado.';
    ELSE
        RAISE NOTICE ' -> INFO: No se encontró ningún perfil de cliente vinculado en la tabla `public.clientes`.';
    END IF;

    -- Paso 3: Ahora que la dependencia está rota, eliminar el usuario de `auth.users`.
    RAISE NOTICE ' -> Procediendo a eliminar el usuario de auth.users...';
    DELETE FROM auth.users WHERE id = v_user_id_to_delete;
    RAISE NOTICE ' -> ÉXITO: Usuario eliminado del sistema de autenticación.';

    RAISE NOTICE '--- Proceso completado exitosamente. ---';

END $$;