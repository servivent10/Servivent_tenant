-- =============================================================================
-- SCRIPT MAESTRO DE REPARACIÓN DE INTEGRIDAD DE DATOS (V1)
-- =============================================================================
-- Este script unifica y corrige los problemas más comunes de integridad de datos
-- que pueden ocurrir en instalaciones antiguas o debido a flujos de registro
-- interrumpidos. Es seguro ejecutarlo varias veces.
--
-- ¿QUÉ HACE ESTE SCRIPT?
-- 1. Elimina un trigger de registro obsoleto que causa conflictos.
-- 2. Asigna una sucursal principal a cualquier Propietario que no la tenga.
-- 3. Permite vincular manualmente un Propietario a su empresa si el enlace se
--    perdió durante el registro.
--
-- INSTRUCCIONES:
-- 1. Ejecuta la Sección 1 y la Sección 2 directamente.
-- 2. Si AÚN tienes problemas para iniciar sesión, edita y ejecuta la Sección 3.
-- =============================================================================

-- =============================================================================
-- SECCIÓN 1: LIMPIEZA DE TRIGGER OBSOLETO
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '--- Iniciando Sección 1: Limpieza de Trigger Obsoleto ---';
    -- Eliminar el trigger de la tabla auth.users
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    RAISE NOTICE ' -> Trigger "on_auth_user_created" eliminado si existía.';

    -- Eliminar la función que manejaba el trigger (ya no es necesaria)
    DROP FUNCTION IF EXISTS public.handle_new_user();
    RAISE NOTICE ' -> Función "handle_new_user" eliminada si existía.';
    RAISE NOTICE '--- Sección 1 completada. ---';
END;
$$;


-- =============================================================================
-- SECCIÓN 2: ASIGNACIÓN DE SUCURSAL A PROPIETARIOS
-- =============================================================================
DO $$
DECLARE
    owner_record RECORD;
    main_branch_id uuid;
BEGIN
    RAISE NOTICE '--- Iniciando Sección 2: Asignación de Sucursal a Propietarios ---';
    -- Itera sobre cada Propietario que no tenga una sucursal asignada
    FOR owner_record IN
        SELECT id, empresa_id FROM public.usuarios
        WHERE rol = 'Propietario' AND sucursal_id IS NULL
    LOOP
        -- Encuentra la primera (o principal) sucursal para la empresa de ese Propietario
        SELECT id INTO main_branch_id
        FROM public.sucursales
        WHERE empresa_id = owner_record.empresa_id
        ORDER BY created_at
        LIMIT 1;

        -- Si se encuentra una sucursal, actualiza el perfil del Propietario
        IF main_branch_id IS NOT NULL THEN
            UPDATE public.usuarios
            SET sucursal_id = main_branch_id
            WHERE id = owner_record.id;
            -- CORRECCIÓN DE SINTAXIS: Se pasan los argumentos a RAISE NOTICE
            RAISE NOTICE ' -> Propietario con ID % asignado a la sucursal %.', owner_record.id, main_branch_id;
        ELSE
            RAISE WARNING ' -> El Propietario con ID % no tiene sucursales en su empresa para ser asignado.', owner_record.id;
        END IF;
    END LOOP;
    RAISE NOTICE '--- Sección 2 completada. ---';
END;
$$;


-- =============================================================================
-- SECCIÓN 3: REPARACIÓN MANUAL DE VÍNCULO EMPRESA-PROPIETARIO
-- =============================================================================
-- INSTRUCCIONES PARA ESTA SECCIÓN:
-- 1. Descomenta el bloque de código (elimina `/*` al inicio y `*/` al final).
-- 2. Edita las líneas con 'EMAIL_DEL_PROPIETARIO_AQUI' y 'NIT_DE_LA_EMPRESA_AQUI'.
-- 3. Selecciona únicamente este bloque de código y ejecútalo.
-- =============================================================================
/*
DO $$
DECLARE
    -- =============== EDITA ESTAS DOS LÍNEAS ===============
    v_propietario_email text := 'EMAIL_DEL_PROPIETARIO_AQUI';
    v_empresa_nit       text := 'NIT_DE_LA_EMPRESA_AQUI';
    -- ==============================================================

    v_propietario_id    uuid;
    v_empresa_id        uuid;
    v_current_empresa_id uuid;
    v_main_branch_id    uuid;
BEGIN
    IF v_propietario_email = 'EMAIL_DEL_PROPIETARIO_AQUI' OR v_empresa_nit = 'NIT_DE_LA_EMPRESA_AQUI' THEN
        RAISE EXCEPTION 'ERROR: Por favor, edita las líneas de este script con tu email y NIT antes de ejecutarlo.';
    END IF;

    RAISE NOTICE '--- Iniciando Sección 3: Reparación Manual de Vínculo ---';
    RAISE NOTICE 'Buscando Propietario con email: %', v_propietario_email;
    RAISE NOTICE 'Buscando Empresa con NIT: %', v_empresa_nit;

    -- Encontrar al usuario Propietario por su email
    SELECT id, empresa_id INTO v_propietario_id, v_current_empresa_id
    FROM public.usuarios WHERE correo = v_propietario_email AND rol = 'Propietario';

    IF v_propietario_id IS NULL THEN
        RAISE EXCEPTION 'ERROR CRÍTICO: No se encontró ningún usuario "Propietario" con el email "%".', v_propietario_email;
    END IF;
    RAISE NOTICE ' -> ÉXITO: Usuario Propietario encontrado con ID: %', v_propietario_id;

    -- Encontrar la empresa por su NIT
    SELECT id INTO v_empresa_id FROM public.empresas WHERE nit = v_empresa_nit;

    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'ERROR CRÍTICO: No se encontró ninguna empresa con el NIT "%".', v_empresa_nit;
    END IF;
    RAISE NOTICE ' -> ÉXITO: Empresa encontrada con ID: %', v_empresa_id;

    -- Comprobar y realizar la vinculación
    IF v_current_empresa_id IS NOT NULL AND v_current_empresa_id = v_empresa_id THEN
        RAISE NOTICE ' -> VERIFICACIÓN: El usuario ya está correctamente vinculado a la empresa.';
    ELSE
        RAISE NOTICE ' -> ACCIÓN: Vinculando Propietario a la empresa...';
        UPDATE public.usuarios SET empresa_id = v_empresa_id WHERE id = v_propietario_id;
        RAISE NOTICE ' -> ÉXITO: El Propietario ha sido vinculado.';
    END IF;
    
    RAISE NOTICE '--- Sección 3 completada. ---';
END $$;
*/
-- =============================================================================
-- FIN DEL SCRIPT MAESTRO DE REPARACIÓN
-- =============================================================================