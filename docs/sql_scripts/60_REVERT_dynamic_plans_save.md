-- =============================================================================
-- REVERT SCRIPT FOR: DYNAMIC PLANS SAVE FUNCTIONALITY (V1)
-- =============================================================================
-- This script reverts the changes made by `60_FEATURE_dynamic_plans_save.md`.
-- It drops the comprehensive `upsert_plan_with_features` function and its
-- associated types, restoring the previous simple `upsert_plan` function.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor to roll back.
-- =============================================================================

-- Step 1: Drop the new function and its custom types
DROP FUNCTION IF EXISTS public.upsert_plan_with_features(jsonb, public.plan_caracteristica_input[], public.plan_feature_display_input[]);
DROP TYPE IF EXISTS public.plan_caracteristica_input CASCADE;
DROP TYPE IF EXISTS public.plan_feature_display_input CASCADE;

-- Step 2: Restore the previous, simpler `upsert_plan` function from script 58
CREATE OR REPLACE FUNCTION upsert_plan(p_plan jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'SuperAdmin') THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de SuperAdmin.';
    END IF;

    v_plan_id := (p_plan->>'id')::uuid;

    IF v_plan_id IS NULL THEN
        INSERT INTO public.planes (nombre, descripcion, precio_mensual, precio_anual, precio_unico, es_publico, es_recomendado)
        VALUES (
            p_plan->>'nombre', p_plan->>'descripcion', (p_plan->>'precio_mensual')::numeric,
            (p_plan->>'precio_anual')::numeric, (p_plan->>'precio_unico')::numeric,
            (p_plan->>'es_publico')::boolean, (p_plan->>'es_recomendado')::boolean
        ) RETURNING id INTO v_plan_id;
    ELSE
        UPDATE public.planes SET
            nombre = p_plan->>'nombre',
            descripcion = p_plan->>'descripcion',
            precio_mensual = (p_plan->>'precio_mensual')::numeric,
            precio_anual = (p_plan->>'precio_anual')::numeric,
            precio_unico = (p_plan->>'precio_unico')::numeric,
            es_publico = (p_plan->>'es_publico')::boolean,
            es_recomendado = (p_plan->>'es_recomendado')::boolean
        WHERE id = v_plan_id;
    END IF;
    RETURN v_plan_id;
END;
$$;

-- =============================================================================
-- End of revert script.
-- =============================================================================