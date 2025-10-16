-- =============================================================================
-- SCRIPT DE CREACIÓN/RESTAURACIÓN DE USUARIO SUPERADMIN (VERSIÓN 3 - ROBUSTA)
-- =============================================================================
-- OBJETIVO:
-- Este script crea o restaura la cuenta de SuperAdmin. Esta versión es más
-- robusta y asegura que la extensión necesaria para el hasheo de contraseñas
-- (`pgcrypto`) esté habilitada antes de proceder. Esto resuelve el problema
-- de "Correo o contraseña incorrectos" después de ejecutar el script.
--
-- INSTRUCCIONES:
-- 1. Copia y pega el contenido completo de este script en el Editor SQL de
--    tu proyecto de Supabase.
-- 2. Haz clic en "RUN" para ejecutarlo.
-- 3. Inicia sesión con las credenciales proporcionadas en el script.
-- =============================================================================

-- --- Paso 0: Habilitar la extensión pgcrypto (CRÍTICO) ---
-- Esto asegura que la función de encriptación de contraseñas (`crypt`) esté disponible.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
    -- --- DATOS DEL SUPERADMIN A CREAR ---
    v_email text           := 'servivent10@gmail.com';
    v_password text        := '123456';
    v_nombre_completo text := 'Ronny Chavez Cuellar';
    -- ------------------------------------

    v_user_id uuid;
BEGIN
    RAISE NOTICE '--- Iniciando creación/restauración de SuperAdmin ---';
    RAISE NOTICE 'Usuario: %', v_email;

    -- Validar longitud de la contraseña
    IF char_length(v_password) < 6 THEN
        RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres.';
    END IF;

    -- --- Paso 1: Asegurar que el usuario existe en `auth.users` ---
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

    IF v_user_id IS NULL THEN
        -- El usuario no existe en auth, lo creamos
        RAISE NOTICE ' -> Usuario no encontrado en auth.users. Creando nuevo usuario...';
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role)
        VALUES (gen_random_uuid(), v_email, crypt(v_password, gen_salt('bf')), now(), 'authenticated')
        RETURNING id INTO v_user_id;
        RAISE NOTICE ' -> ÉXITO: Usuario creado en auth.users con ID: %', v_user_id;
    ELSE
        -- El usuario ya existe, actualizamos su contraseña
        RAISE NOTICE ' -> Usuario encontrado en auth.users (ID: %). Actualizando contraseña...', v_user_id;
        UPDATE auth.users
        SET encrypted_password = crypt(v_password, gen_salt('bf'))
        WHERE id = v_user_id;
        RAISE NOTICE ' -> ÉXITO: Contraseña actualizada.';
    END IF;

    -- --- Paso 2: Asegurar que el perfil existe en `public.usuarios` ---
    RAISE NOTICE ' -> Verificando perfil en public.usuarios...';
    INSERT INTO public.usuarios (id, nombre_completo, correo, rol, empresa_id, sucursal_id)
    VALUES (v_user_id, v_nombre_completo, v_email, 'SuperAdmin', NULL, NULL)
    ON CONFLICT (id) DO UPDATE SET
        nombre_completo = EXCLUDED.nombre_completo,
        correo = EXCLUDED.correo,
        rol = EXCLUDED.rol,
        empresa_id = NULL,
        sucursal_id = NULL;
    RAISE NOTICE ' -> ÉXITO: Perfil de SuperAdmin creado/actualizado en public.usuarios.';

    RAISE NOTICE '--- Proceso completado exitosamente. Ya puedes iniciar sesión. ---';

END $$;