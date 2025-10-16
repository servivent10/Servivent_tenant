-- =============================================================================
-- DYNAMIC PLANS & FEATURES MANAGEMENT - DATABASE SETUP (V4 - Reordering)
-- =============================================================================
-- This script implements the entire backend infrastructure for the dynamic
-- plan management system and includes several critical bug fixes.
-- VERSION 4 adds an `orden` column and an RPC function to allow SuperAdmins
-- to reorder how plans are displayed publicly.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor. It is idempotent
-- and safe to run multiple times.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create/Alter the new tables for dynamic plan management
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planes (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    nombre text NOT NULL UNIQUE,
    descripcion text,
    precio_mensual numeric(10, 2),
    precio_anual numeric(10, 2),
    precio_unico numeric(10, 2),
    es_publico boolean DEFAULT true NOT NULL,
    es_recomendado boolean DEFAULT false NOT NULL,
    orden integer DEFAULT 0 NOT NULL, -- **NEW**
    created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.planes ADD COLUMN IF NOT EXISTS orden integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS public.caracteristicas (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    codigo_interno text NOT NULL UNIQUE,
    nombre_visible text NOT NULL,
    descripcion text,
    tipo text NOT NULL CHECK (tipo IN ('BOOLEAN', 'LIMIT'))
);

CREATE TABLE IF NOT EXISTS public.plan_caracteristicas (
    plan_id uuid NOT NULL REFERENCES public.planes(id) ON DELETE CASCADE,
    caracteristica_id uuid NOT NULL REFERENCES public.caracteristicas(id) ON DELETE CASCADE,
    valor text NOT NULL,
    PRIMARY KEY (plan_id, caracteristica_id)
);

CREATE TABLE IF NOT EXISTS public.plan_features_display (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    plan_id uuid NOT NULL REFERENCES public.planes(id) ON DELETE CASCADE,
    texto_caracteristica text NOT NULL,
    orden integer DEFAULT 0,
    incluida boolean DEFAULT true NOT NULL
);

-- -----------------------------------------------------------------------------
-- Step 2: Alter `licencias` table and enable RLS/Realtime on new tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.licencias ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.planes(id) ON DELETE SET NULL;

ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caracteristicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_caracteristicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features_display ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable public read access" ON public.planes;
CREATE POLICY "Enable public read access" ON public.planes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable public read access" ON public.caracteristicas;
CREATE POLICY "Enable public read access" ON public.caracteristicas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable public read access" ON public.plan_caracteristicas;
CREATE POLICY "Enable public read access" ON public.plan_caracteristicas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable public read access" ON public.plan_features_display;
CREATE POLICY "Enable public read access" ON public.plan_features_display FOR SELECT USING (true);

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.planes; EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'Table "planes" is already in publication.'; END; $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.caracteristicas; EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'Table "caracteristicas" is already in publication.'; END; $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_caracteristicas; EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'Table "plan_caracteristicas" is already in publication.'; END; $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_features_display; EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'Table "plan_features_display" is already in publication.'; END; $$;


-- -----------------------------------------------------------------------------
-- Step 3: One-Time Data Migration from `plansConfig.ts`
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    plan_emprendedor_id uuid := 'e4f0a02f-2236-4251-9685-18c81804b8a2';
    plan_profesional_id uuid := 'a1d3d8d6-4e5c-4a37-9d7a-7b5b5b5b5b5b';
    plan_corporativo_id uuid := 'c1b2b1b0-3e4d-4c36-8d6a-6b4b4b4b4b4b';
    feat_max_users_id uuid; feat_max_branches_id uuid; feat_traspasos_id uuid;
    feat_soporte_id uuid; feat_listas_precios_id uuid;
BEGIN
    RAISE NOTICE '--- Iniciando migración de planes estáticos a la base de datos ---';
    INSERT INTO public.caracteristicas (codigo_interno, nombre_visible, descripcion, tipo) VALUES ('MAX_USERS', 'Límite de Usuarios', 'Número máximo de usuarios permitidos.', 'LIMIT') ON CONFLICT (codigo_interno) DO NOTHING RETURNING id INTO feat_max_users_id;
    INSERT INTO public.caracteristicas (codigo_interno, nombre_visible, descripcion, tipo) VALUES ('MAX_BRANCHES', 'Límite de Sucursales', 'Número máximo de sucursales permitidas.', 'LIMIT') ON CONFLICT (codigo_interno) DO NOTHING RETURNING id INTO feat_max_branches_id;
    INSERT INTO public.caracteristicas (codigo_interno, nombre_visible, descripcion, tipo) VALUES ('MODULO_TRASPASOS', 'Módulo de Traspasos', 'Permite transferir stock entre sucursales.', 'BOOLEAN') ON CONFLICT (codigo_interno) DO NOTHING RETURNING id INTO feat_traspasos_id;
    INSERT INTO public.caracteristicas (codigo_interno, nombre_visible, descripcion, tipo) VALUES ('SOPORTE_PRIORITARIO', 'Soporte Prioritario', 'Acceso a soporte de alta prioridad.', 'BOOLEAN') ON CONFLICT (codigo_interno) DO NOTHING RETURNING id INTO feat_soporte_id;
    INSERT INTO public.caracteristicas (codigo_interno, nombre_visible, descripcion, tipo) VALUES ('LISTAS_PRECIOS', 'Gestión de Listas de Precios', 'Permite crear y gestionar múltiples listas de precios.', 'BOOLEAN') ON CONFLICT (codigo_interno) DO NOTHING RETURNING id INTO feat_listas_precios_id;
    IF feat_max_users_id IS NULL THEN SELECT id INTO feat_max_users_id FROM public.caracteristicas WHERE codigo_interno = 'MAX_USERS'; END IF;
    IF feat_max_branches_id IS NULL THEN SELECT id INTO feat_max_branches_id FROM public.caracteristicas WHERE codigo_interno = 'MAX_BRANCHES'; END IF;
    IF feat_traspasos_id IS NULL THEN SELECT id INTO feat_traspasos_id FROM public.caracteristicas WHERE codigo_interno = 'MODULO_TRASPASOS'; END IF;
    IF feat_soporte_id IS NULL THEN SELECT id INTO feat_soporte_id FROM public.caracteristicas WHERE codigo_interno = 'SOPORTE_PRIORITARIO'; END IF;
    IF feat_listas_precios_id IS NULL THEN SELECT id INTO feat_listas_precios_id FROM public.caracteristicas WHERE codigo_interno = 'LISTAS_PRECIOS'; END IF;

    INSERT INTO public.planes (id, nombre, descripcion, precio_mensual, precio_anual, precio_unico, es_publico, es_recomendado, orden) VALUES (plan_emprendedor_id, 'Emprendedor', 'Ideal para negocios pequeños y startups en crecimiento.', 100, 1000, 3000, true, false, 0) ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.planes (id, nombre, descripcion, precio_mensual, precio_anual, precio_unico, es_publico, es_recomendado, orden) VALUES (plan_profesional_id, 'Profesional', 'La solución completa para empresas establecidas con múltiples sucursales.', 200, 2000, 6000, true, true, 1) ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.planes (id, nombre, descripcion, precio_mensual, precio_anual, precio_unico, es_publico, es_recomendado, orden) VALUES (plan_corporativo_id, 'Corporativo', 'Para grandes cadenas o empresas con necesidades a medida.', null, null, null, true, false, 2) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.plan_caracteristicas (plan_id, caracteristica_id, valor) VALUES (plan_emprendedor_id, feat_max_users_id, '3') ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_caracteristicas (plan_id, caracteristica_id, valor) VALUES (plan_emprendedor_id, feat_max_branches_id, '1') ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_caracteristicas (plan_id, caracteristica_id, valor) VALUES (plan_emprendedor_id, feat_traspasos_id, 'false') ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_caracteristicas (plan_id, caracteristica_id, valor) VALUES (plan_emprendedor_id, feat_listas_precios_id, 'false') ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_caracteristicas (plan_id, caracteristica_id, valor) VALUES (plan_profesional_id, feat_max_users_id, '10') ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_caracteristicas (plan_id, caracteristica_id, valor) VALUES (plan_profesional_id, feat_max_branches_id, '3') ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_caracteristicas (plan_id, caracteristica_id, valor) VALUES (plan_profesional_id, feat_traspasos_id, 'true') ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_caracteristicas (plan_id, caracteristica_id, valor) VALUES (plan_profesional_id, feat_soporte_id, 'true') ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_caracteristicas (plan_id, caracteristica_id, valor) VALUES (plan_profesional_id, feat_listas_precios_id, 'true') ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_caracteristicas (plan_id, caracteristica_id, valor) VALUES (plan_corporativo_id, feat_max_users_id, '99999') ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_caracteristicas (plan_id, caracteristica_id, valor) VALUES (plan_corporativo_id, feat_max_branches_id, '99999') ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_caracteristicas (plan_id, caracteristica_id, valor) VALUES (plan_corporativo_id, feat_traspasos_id, 'true') ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_caracteristicas (plan_id, caracteristica_id, valor) VALUES (plan_corporativo_id, feat_soporte_id, 'true') ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_caracteristicas (plan_id, caracteristica_id, valor) VALUES (plan_corporativo_id, feat_listas_precios_id, 'true') ON CONFLICT DO NOTHING;

    DELETE FROM public.plan_features_display;
    INSERT INTO public.plan_features_display (plan_id, texto_caracteristica, incluida, orden) VALUES (plan_emprendedor_id, 'Hasta 3 usuarios', true, 1), (plan_emprendedor_id, '1 sucursal', true, 2), (plan_emprendedor_id, 'Productos y ventas ilimitadas', true, 3), (plan_emprendedor_id, 'Reportes de ventas', true, 4), (plan_emprendedor_id, 'Soporte por correo', true, 5), (plan_emprendedor_id, 'Módulo de Traspasos', false, 6), (plan_emprendedor_id, 'Múltiples Listas de Precios', false, 7);
    INSERT INTO public.plan_features_display (plan_id, texto_caracteristica, incluida, orden) VALUES (plan_profesional_id, 'Hasta 10 usuarios', true, 1), (plan_profesional_id, 'Hasta 3 sucursales', true, 2), (plan_profesional_id, 'Roles y permisos avanzados', true, 3), (plan_profesional_id, 'Traspasos entre sucursales', true, 4), (plan_profesional_id, 'Soporte prioritario', true, 5), (plan_profesional_id, 'Múltiples Listas de Precios', true, 6);
    INSERT INTO public.plan_features_display (plan_id, texto_caracteristica, incluida, orden) VALUES (plan_corporativo_id, 'Usuarios y sucursales ilimitados', true, 1), (plan_corporativo_id, 'Analítica y reportes a medida', true, 2), (plan_corporativo_id, 'Gestor de cuenta dedicado', true, 3), (plan_corporativo_id, 'Soporte Prioritario y SLA', true, 4), (plan_corporativo_id, 'Múltiples Listas de Precios', true, 5);
    
    UPDATE public.licencias SET plan_id = plan_emprendedor_id WHERE tipo_licencia ILIKE 'Emprendedor%' AND plan_id IS NULL;
    UPDATE public.licencias SET plan_id = plan_profesional_id WHERE tipo_licencia ILIKE 'Profesional%' AND plan_id IS NULL;
    UPDATE public.licencias SET plan_id = plan_corporativo_id WHERE tipo_licencia ILIKE 'Corporativo%' AND plan_id IS NULL;
    UPDATE public.licencias SET plan_id = plan_profesional_id WHERE tipo_licencia ILIKE 'Prueba Gratuita%' AND plan_id IS NULL;
    RAISE NOTICE '--- Migración de planes completada. ---';
END $$;

-- -----------------------------------------------------------------------------
-- Step 4: Create/Update RPC Functions
-- -----------------------------------------------------------------------------

-- **UPDATED**: Added ORDER BY p.orden
DROP FUNCTION IF EXISTS public.get_all_plans_management();
CREATE OR REPLACE FUNCTION get_all_plans_management()
RETURNS TABLE (id uuid, nombre text, es_publico boolean, es_recomendado boolean, precio_mensual numeric)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.rol = 'SuperAdmin') THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;
    RETURN QUERY SELECT p.id, p.nombre, p.es_publico, p.es_recomendado, p.precio_mensual FROM public.planes p ORDER BY p.orden;
END;
$$;

-- **NEW**: Function to update plan order
CREATE OR REPLACE FUNCTION update_plan_order(p_plan_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    plan_id uuid;
    i integer := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.rol = 'SuperAdmin') THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;

    FOREACH plan_id IN ARRAY p_plan_ids
    LOOP
        UPDATE public.planes SET orden = i WHERE id = plan_id;
        i := i + 1;
    END LOOP;
END;
$$;

-- **UPDATED**: Added ORDER BY p.orden
CREATE OR REPLACE FUNCTION get_public_plans()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT json_agg(
            json_build_object(
                'id', p.id, 'title', p.nombre, 'description', p.descripcion, 'recommended', p.es_recomendado,
                'prices', json_build_object(
                    'monthly', p.precio_mensual, 'yearly', p.precio_anual, 'lifetime', p.precio_unico,
                    'custom', CASE WHEN p.precio_mensual IS NULL AND p.precio_anual IS NULL AND p.precio_unico IS NULL THEN 'Contactar' ELSE NULL END
                ),
                'features', COALESCE(
                    (SELECT array_agg(CASE WHEN fd.incluida = false THEN '❌ ' ELSE '' END || fd.texto_caracteristica ORDER BY fd.orden)
                     FROM public.plan_features_display fd WHERE fd.plan_id = p.id),
                    ARRAY[]::text[]
                )
            ) ORDER BY p.orden
        )
        FROM public.planes p
        WHERE p.es_publico = true
    );
END;
$$;

-- **FIXED**: Added 'tipo' to the caracteristicas_logicas object
DROP FUNCTION IF EXISTS public.get_plan_details_management(uuid);
CREATE OR REPLACE FUNCTION get_plan_details_management(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.rol = 'SuperAdmin') THEN
        RAISE EXCEPTION 'Acceso denegado.';
    END IF;

    IF p_plan_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
        -- Case for creating a new plan
        RETURN jsonb_build_object(
            'plan', null,
            'caracteristicas_logicas', (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', c.id,
                        'codigo_interno', c.codigo_interno,
                        'nombre_visible', c.nombre_visible,
                        'tipo', c.tipo, -- **FIX**
                        'valor', null
                    )
                )
                FROM public.caracteristicas c
            ),
            'features_display', '[]'::jsonb
        );
    ELSE
        -- Case for editing an existing plan
        RETURN (
            SELECT jsonb_build_object(
                'plan', to_jsonb(p),
                'caracteristicas_logicas', (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', c.id,
                            'codigo_interno', c.codigo_interno,
                            'nombre_visible', c.nombre_visible,
                            'tipo', c.tipo, -- **FIX**
                            'valor', pc.valor
                        )
                    )
                    FROM public.caracteristicas c
                    LEFT JOIN public.plan_caracteristicas pc ON c.id = pc.caracteristica_id AND pc.plan_id = p.id
                ),
                'features_display', (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', fd.id,
                            'plan_id', fd.plan_id,
                            'texto_caracteristica', fd.texto_caracteristica,
                            'orden', fd.orden,
                            'incluida', fd.incluida
                        ) ORDER BY fd.orden
                    )
                    FROM public.plan_features_display fd
                    WHERE fd.plan_id = p.id
                )
            )
            FROM public.planes p
            WHERE p.id = p_plan_id
        );
    END IF;
END;
$$;

-- Unchanged functions
CREATE OR REPLACE FUNCTION upsert_plan(p_plan jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$ DECLARE v_plan_id uuid; BEGIN IF NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.rol = 'SuperAdmin') THEN RAISE EXCEPTION 'Acceso denegado.'; END IF; v_plan_id := (p_plan->>'id')::uuid; IF v_plan_id IS NULL THEN INSERT INTO public.planes (nombre, descripcion, precio_mensual, precio_anual, precio_unico, es_publico, es_recomendado) VALUES (p_plan->>'nombre', p_plan->>'descripcion', (p_plan->>'precio_mensual')::numeric, (p_plan->>'precio_anual')::numeric, (p_plan->>'precio_unico')::numeric, (p_plan->>'es_publico')::boolean, (p_plan->>'es_recomendado')::boolean) RETURNING id INTO v_plan_id; ELSE UPDATE public.planes SET nombre = p_plan->>'nombre', descripcion = p_plan->>'descripcion', precio_mensual = (p_plan->>'precio_mensual')::numeric, precio_anual = (p_plan->>'precio_anual')::numeric, precio_unico = (p_plan->>'precio_unico')::numeric, es_publico = (p_plan->>'es_publico')::boolean, es_recomendado = (p_plan->>'es_recomendado')::boolean WHERE id = v_plan_id; END IF; RETURN v_plan_id; END; $$;
DROP FUNCTION IF EXISTS public.get_user_profile_data();
CREATE OR REPLACE FUNCTION get_user_profile_data() RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE user_profile record; plan_details_json jsonb; BEGIN SELECT * INTO user_profile FROM public.usuarios WHERE id = auth.uid(); IF user_profile IS NULL THEN RETURN '{}'::json; END IF; IF user_profile.rol = 'SuperAdmin' THEN RETURN json_build_object('nombre_completo', user_profile.nombre_completo, 'rol', user_profile.rol, 'avatar', user_profile.avatar, 'sucursal_principal_nombre', 'Global'); ELSE SELECT jsonb_build_object('id', p.id, 'title', p.nombre, 'limits', (SELECT jsonb_object_agg(lower(regexp_replace(c.codigo_interno, '_([a-z])', '\U\1', 'g')), pc.valor::numeric) FROM plan_caracteristicas pc JOIN caracteristicas c ON pc.caracteristica_id = c.id WHERE pc.plan_id = l.plan_id AND c.tipo = 'LIMIT'), 'features', (SELECT jsonb_object_agg(lower(regexp_replace(c.codigo_interno, '_([a-z])', '\U\1', 'g')), pc.valor::boolean) FROM plan_caracteristicas pc JOIN caracteristicas c ON pc.caracteristica_id = c.id WHERE pc.plan_id = l.plan_id AND c.tipo = 'BOOLEAN') || (SELECT COALESCE(jsonb_object_agg(lower(regexp_replace(m.codigo_interno, '_([a-z])', '\U\1', 'g')), 'true'::jsonb), '{}'::jsonb) FROM empresa_modulos em JOIN modulos m ON em.modulo_id = m.id WHERE em.empresa_id = user_profile.empresa_id AND em.estado = 'activo')) INTO plan_details_json FROM licencias l JOIN planes p ON l.plan_id = p.id WHERE l.empresa_id = user_profile.empresa_id; RETURN (SELECT json_build_object('empresa_id', e.id, 'empresa_nombre', e.nombre, 'empresa_logo', e.logo, 'empresa_nit', e.nit, 'empresa_timezone', e.timezone, 'empresa_moneda', e.moneda, 'empresa_modo_caja', e.modo_caja, 'empresa_slug', e.slug, 'plan_actual', l.tipo_licencia, 'estado_licencia', l.estado, 'fecha_fin_licencia', l.fecha_fin, 'nombre_completo', user_profile.nombre_completo, 'rol', user_profile.rol, 'avatar', user_profile.avatar, 'sucursal_id', user_profile.sucursal_id, 'sucursal_principal_nombre', s.nombre, 'historial_pagos', (SELECT json_agg(p ORDER BY p.fecha_pago DESC) FROM pagos_licencia p WHERE p.empresa_id = e.id), 'planDetails', plan_details_json) FROM empresas e LEFT JOIN licencias l ON e.id = l.empresa_id LEFT JOIN sucursales s ON user_profile.sucursal_id = s.id WHERE e.id = user_profile.empresa_id); END IF; END; $$;

-- =============================================================================
-- End of script.
-- =============================================================================