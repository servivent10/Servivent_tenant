-- =============================================================================
-- USER ASSIGNMENT FIX SCRIPT
-- =============================================================================
-- Este script de corrección soluciona un problema donde los usuarios con rol
-- de 'Propietario' pueden no tener una sucursal asignada, lo que causa que
-- no aparezcan en las listas de usuarios de las sucursales.
--
-- **INSTRUCCIONES:**
-- Ejecuta este script en el Editor SQL de tu proyecto de Supabase para asignar
-- la sucursal principal a cualquier Propietario que no la tenga.
-- =============================================================================

DO $$
DECLARE
    owner_record RECORD;
    main_branch_id uuid;
BEGIN
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

            RAISE NOTICE 'Propietario con ID % asignado a la sucursal %.', owner_record.id, main_branch_id;
        ELSE
            RAISE WARNING 'El Propietario con ID % no tiene sucursales en su empresa para ser asignado.', owner_record.id;
        END IF;
    END LOOP;
END $$;

-- =============================================================================
-- Fin del script.
-- =============================================================================