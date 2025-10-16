-- =============================================================================
-- DATA INTEGRITY FIX: BACKFILL `plan_id` IN `licencias` TABLE (V1)
-- =============================================================================
-- This is a one-time migration script designed to fix data integrity by
-- correctly populating the `plan_id` foreign key in the `licencias` table.
--
-- PROBLEM:
-- Many existing licenses have a NULL or incorrect `plan_id`, relying on the
-- fragile `tipo_licencia` text field to determine the plan. This breaks if
-- a plan is ever renamed.
--
-- SOLUTION:
-- This script iterates through all licenses where `plan_id` is not correctly set.
-- For each one, it looks up the correct `plan_id` from the `planes` table by
-- matching the plan name found in the `tipo_licencia` string (e.g., "Profesional").
-- It then updates the `plan_id` field, permanently fixing the data link.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor. It is safe to
-- run multiple times, as it will only affect rows that need fixing.
-- =============================================================================

DO $$
DECLARE
    licencia_rec RECORD;
    plan_rec RECORD;
    plan_name_from_type TEXT;
    updated_count INT := 0;
BEGIN
    RAISE NOTICE '--- Iniciando script de backfill para `licencias.plan_id` ---';

    FOR licencia_rec IN
        SELECT l.id, l.tipo_licencia, l.plan_id, p.id as correct_plan_id
        FROM public.licencias l
        LEFT JOIN public.planes p ON l.plan_id = p.id
        -- Select rows where plan_id is NULL or doesn't point to a valid plan
        WHERE p.id IS NULL
    LOOP
        -- Extract the base name of the plan from the license type string
        plan_name_from_type := (regexp_match(licencia_rec.tipo_licencia, '^\w+'))[1];
        
        -- Handle special case for "Básico" -> "Emprendedor"
        IF plan_name_from_type = 'Básico' THEN
            plan_name_from_type := 'Emprendedor';
        END IF;

        -- Find the correct plan in the `planes` table based on the extracted name
        SELECT id INTO plan_rec FROM public.planes WHERE nombre = plan_name_from_type;

        IF FOUND THEN
            -- If a matching plan is found, update the license record
            UPDATE public.licencias
            SET plan_id = plan_rec.id
            WHERE id = licencia_rec.id;
            
            updated_count := updated_count + 1;
            RAISE NOTICE ' -> Licencia ID % actualizada. Se asignó el plan_id % (''%'').', licencia_rec.id, plan_rec.id, plan_name_from_type;
        ELSE
            RAISE WARNING ' -> ADVERTENCIA: No se encontró un plan coincidente para el tipo de licencia "%". Licencia ID % no fue actualizada.', licencia_rec.tipo_licencia, licencia_rec.id;
        END IF;
    END LOOP;

    RAISE NOTICE '--- Backfill completado. Total de licencias actualizadas: % ---', updated_count;
END;
$$;

-- =============================================================================
-- End of script.
-- =============================================================================