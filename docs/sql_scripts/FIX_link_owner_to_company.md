-- =============================================================================
-- SCRIPT DE REPARACIÓN DE DATOS (VERSIÓN FINAL Y DEFINITIVA)
-- =============================================================================
-- Este script es la solución final para el error "violates row-level
-- security policy" que ocurre si tu cuenta de Propietario no está
-- correctamente vinculada a tu empresa en la base de datos.
--
-- **¿POR QUÉ ES NECESARIO?**
-- Las primeras versiones de la aplicación tenían un flujo de registro que,
-- en algunos casos, no creaba correctamente el enlace entre el usuario
-- Propietario y la empresa. Este script corrige esa omisión de forma manual y segura.
--
-- =============================================================================
-- **INSTRUCCIONES CRÍTICAS (Por favor, sigue estos 3 pasos con atención):**
--
-- 1. **EDITA LAS DOS LÍNEAS SIGUIENTES:**
--    Reemplaza 'EMAIL_DEL_PROPIETARIO_AQUI' con el correo electrónico EXACTO de tu
--    cuenta de Propietario (la que usas para iniciar sesión).
--    Reemplaza 'NIT_DE_LA_EMPRESA_AQUI' con el NIT EXACTO de tu empresa.
--
-- 2. **EJECUTA EL SCRIPT COMPLETO:**
--    Copia TODO el contenido de este archivo (desde la primera línea hasta la
--    última), pégalo en el Editor SQL de Supabase y haz clic en "RUN".
--
-- 3. **REVISA LOS MENSAJES:**
--    En la pestaña "Results" que aparecerá abajo, verás mensajes de ÉXITO
--    o de ERROR. Si todo sale bien, te confirmará que la reparación fue exitosa.
-- =============================================================================

DO $$
DECLARE
    -- =============== PASO 1: EDITA ESTAS DOS LÍNEAS ===============
    v_propietario_email text := 'EMAIL_DEL_PROPIETARIO_AQUI';
    v_empresa_nit       text := 'NIT_DE_LA_EMPRESA_AQUI';
    -- ==============================================================

    v_propietario_id    uuid;
    v_empresa_id        uuid;
    v_current_empresa_id uuid;
    v_main_branch_id    uuid;
BEGIN
    -- Validar que se hayan editado los valores por defecto
    IF v_propietario_email = 'EMAIL_DEL_PROPIETARIO_AQUI' OR v_empresa_nit = 'NIT_DE_LA_EMPRESA_AQUI' THEN
        RAISE EXCEPTION 'ERROR: Por favor, edita las líneas 19 y 20 de este script con tu email y NIT antes de ejecutarlo.';
    END IF;

    RAISE NOTICE '--- Iniciando script de reparación de datos para ServiVENT ---';
    RAISE NOTICE 'Buscando Propietario con email: %', v_propietario_email;
    RAISE NOTICE 'Buscando Empresa con NIT: %', v_empresa_nit;
    RAISE NOTICE '-------------------------------------------------------------';

    -- Paso 2: Encontrar al usuario Propietario por su email
    SELECT id, empresa_id INTO v_propietario_id, v_current_empresa_id
    FROM public.usuarios
    WHERE correo = v_propietario_email AND rol = 'Propietario';

    IF v_propietario_id IS NULL THEN
        RAISE EXCEPTION 'ERROR CRÍTICO: No se encontró ningún usuario con el rol "Propietario" y el email "%". Verifica que el correo sea correcto y que no haya errores de tipeo.', v_propietario_email;
    END IF;
    RAISE NOTICE '-> ÉXITO: Usuario Propietario encontrado con ID: %', v_propietario_id;

    -- Paso 3: Encontrar la empresa por su NIT
    SELECT id INTO v_empresa_id
    FROM public.empresas
    WHERE nit = v_empresa_nit;

    IF v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'ERROR CRÍTICO: No se encontró ninguna empresa con el NIT "%". Verifica que el NIT sea correcto y que no haya errores de tipeo.', v_empresa_nit;
    END IF;
    RAISE NOTICE '-> ÉXITO: Empresa encontrada con ID: %', v_empresa_id;
    RAISE NOTICE '-------------------------------------------------------------';

    -- Paso 4: Comprobar si ya está vinculado
    IF v_current_empresa_id IS NOT NULL THEN
        IF v_current_empresa_id = v_empresa_id THEN
            RAISE NOTICE '-> VERIFICACIÓN: El usuario ya está correctamente vinculado a la empresa. No se necesita ninguna acción.';
        ELSE
            RAISE WARNING '-> ADVERTENCIA: El usuario está vinculado a una empresa DIFERENTE (ID: %). El script no continuará para evitar conflictos. Por favor, contacta a soporte.', v_current_empresa_id;
            RETURN;
        END IF;
    ELSE
        -- Paso 5: Realizar la vinculación
        RAISE NOTICE '-> ACCIÓN: El usuario Propietario no tiene una empresa asignada. Procediendo a vincularlo...';
        UPDATE public.usuarios
        SET empresa_id = v_empresa_id
        WHERE id = v_propietario_id;
        RAISE NOTICE '-> ÉXITO: El usuario Propietario ha sido vinculado correctamente a la empresa.';
    END IF;
    
    -- Paso 6: Asegurar que el Propietario esté asignado a la sucursal principal
    -- (Combina la lógica de USER_ASSIGNMENT_FIX.md para una reparación completa)
    SELECT sucursal_id INTO v_main_branch_id FROM public.usuarios WHERE id = v_propietario_id;
    IF v_main_branch_id IS NULL THEN
        RAISE NOTICE '-> ACCIÓN: El Propietario no tiene sucursal asignada. Buscando sucursal principal...';
        
        SELECT id INTO v_main_branch_id
        FROM public.sucursales
        WHERE empresa_id = v_empresa_id
        ORDER BY created_at
        LIMIT 1;

        IF v_main_branch_id IS NOT NULL THEN
            UPDATE public.usuarios
            SET sucursal_id = v_main_branch_id
            WHERE id = v_propietario_id;
            RAISE NOTICE '-> ÉXITO: El Propietario ha sido asignado a la sucursal principal (ID: %).', v_main_branch_id;
        ELSE
            RAISE WARNING '-> ADVERTENCIA: No se encontró una sucursal principal para asignar al Propietario. Es posible que la empresa no tenga sucursales creadas.';
        END IF;
    ELSE
         RAISE NOTICE '-> VERIFICACIÓN: El Propietario ya tiene una sucursal asignada.';
    END IF;

    RAISE NOTICE '-------------------------------------------------------------';
    RAISE NOTICE '--- REPARACIÓN DE DATOS COMPLETADA EXITOSAMENTE ---';
    RAISE NOTICE 'Por favor, cierra sesión y vuelve a iniciar sesión en la aplicación. El problema debería estar resuelto.';
    RAISE NOTICE '-------------------------------------------------------------';

END $$;