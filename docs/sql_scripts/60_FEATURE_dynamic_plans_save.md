-- =============================================================================
-- DYNAMIC PLANS SAVE FUNCTIONALITY - DATABASE SETUP (V1)
-- =============================================================================
-- This script implements the backend logic to save plan configurations from
-- the SuperAdmin panel. It replaces the simple `upsert_plan` function with a
-- comprehensive one that handles the plan and all its related features in a
-- single transactional call.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Drop the old, simple upsert function
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.upsert_plan(jsonb);


-- -----------------------------------------------------------------------------
-- Step 2: Create custom types for the new function's array parameters
-- -----------------------------------------------------------------------------
DROP TYPE IF EXISTS public.plan_caracteristica_input CASCADE;
CREATE TYPE public.plan_caracteristica_input AS (
    id uuid,
    valor text
);

DROP TYPE IF EXISTS public.plan_feature_display_input CASCADE;
CREATE TYPE public.plan_feature_display_input AS (
    texto_caracteristica text,
    incluida boolean,
    orden integer
);


-- -----------------------------------------------------------------------------
-- Step 3: Create the new, comprehensive `upsert_plan_with_features` function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_plan_with_features(
    p_plan jsonb,
    p_caracteristicas_logicas plan_caracteristica_input[],
    p_features_display plan_feature_display_input[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan_id uuid;
    feature_logic plan_caracteristica_input;
    feature_display plan_feature_display_input;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'SuperAdmin') THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de SuperAdmin.';
    END IF;

    -- Step 1: Upsert the main plan details
    v_plan_id := (p_plan->>'id')::uuid;

    IF v_plan_id IS NULL OR v_plan_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
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

    -- Step 2: Upsert logical features (limits/booleans)
    IF p_caracteristicas_logicas IS NOT NULL THEN
        FOREACH feature_logic IN ARRAY p_caracteristicas_logicas
        LOOP
            INSERT INTO public.plan_caracteristicas (plan_id, caracteristica_id, valor)
            VALUES (v_plan_id, feature_logic.id, feature_logic.valor)
            ON CONFLICT (plan_id, caracteristica_id) DO UPDATE
            SET valor = EXCLUDED.valor;
        END LOOP;
    END IF;

    -- Step 3: Replace all display features for this plan
    DELETE FROM public.plan_features_display WHERE plan_id = v_plan_id;
    
    IF p_features_display IS NOT NULL THEN
        FOREACH feature_display IN ARRAY p_features_display
        LOOP
            IF TRIM(feature_display.texto_caracteristica) <> '' THEN
                INSERT INTO public.plan_features_display (plan_id, texto_caracteristica, incluida, orden)
                VALUES (v_plan_id, feature_display.texto_caracteristica, feature_display.incluida, feature_display.orden);
            END IF;
        END LOOP;
    END IF;

    RETURN v_plan_id;
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================