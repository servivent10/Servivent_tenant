-- =============================================================================
-- ADD-ON MODULES FEATURE - DATABASE SETUP (V13.2 - DEFINITIVE LOGIN FIX)
-- =============================================================================
-- This script is the DEFINITIVE FIX for the "invalid input syntax for type boolean: 'null'"
-- error that blocked user login after the introduction of dynamic modules.
--
-- PROBLEM SOLVED:
-- The previous hotfix was insufficient. The root cause is that the `valor` column
-- in `plan_caracteristicas` can contain not just `NULL`, but also empty strings ('')
-- or even the literal string 'null'. Casting these to boolean fails.
--
-- SOLUTION:
-- The `get_user_profile_data` function has been hardened with a robust `CASE` statement
-- and a `LEFT JOIN`. This logic correctly interprets only the string 'true' (case-insensitive)
-- as true, and safely defaults ALL other values (NULL, '', 'null', 'false', etc.) to false,
-- permanently eliminating the conversion error and ensuring a stable login.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor. After execution,
-- log out and log back in. This will resolve the login error.
-- =============================================================================

-- Steps 1, 2, 3, 4 are idempotent and can be re-run without issue.

-- -----------------------------------------------------------------------------
-- Step 1 & 2: Create tables and set up RLS (Idempotent, no changes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.modulos (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    codigo_interno text NOT NULL UNIQUE,
    nombre_visible text NOT NULL,
    descripcion text,
    precio_mensual numeric(10, 2) DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.empresa_modulos (
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    modulo_id uuid NOT NULL REFERENCES public.modulos(id) ON DELETE CASCADE,
    fecha_activacion timestamptz DEFAULT now() NOT NULL,
    estado text NOT NULL CHECK (estado IN ('activo', 'inactivo')),
    precio_pactado numeric(10, 2),
    PRIMARY KEY (empresa_id, modulo_id)
);

ALTER TABLE public.modulos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.modulos;
CREATE POLICY "Enable read access for authenticated users" ON public.modulos FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE public.empresa_modulos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for own company" ON public.empresa_modulos;
CREATE POLICY "Enable read access for own company" ON public.empresa_modulos FOR SELECT USING (empresa_id = public.get_empresa_id_from_jwt());

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.modulos; EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'Table "modulos" is already in publication.'; END; $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.empresa_modulos; EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'Table "empresa_modulos" is already in publication.'; END; $$;


-- -----------------------------------------------------------------------------
-- Step 3: Data Migration (Idempotent, no changes)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    catalogo_web_feature_id uuid;
    aperturar_cajas_feature_id uuid;
BEGIN
    RAISE NOTICE '--- Iniciando migración de características a Módulos ---';

    INSERT INTO public.modulos (codigo_interno, nombre_visible, descripcion, precio_mensual)
    VALUES ('CATALOGO_WEB', 'Catálogo Web para Clientes', 'Permite a la empresa tener una URL pública para mostrar sus productos y recibir pedidos.', 50.00)
    ON CONFLICT (codigo_interno) DO NOTHING;
    RAISE NOTICE ' -> Módulo CATALOGO_WEB asegurado en la tabla `modulos`.';

    INSERT INTO public.modulos (codigo_interno, nombre_visible, descripcion, precio_mensual)
    VALUES ('APERTURAR_CAJAS', 'Gestión de Apertura y Cierre de Caja', 'Activa el flujo de apertura y cierre de caja en el Terminal de Venta.', 25.00)
    ON CONFLICT (codigo_interno) DO NOTHING;
    RAISE NOTICE ' -> Módulo APERTURAR_CAJAS asegurado en la tabla `modulos`.';

    SELECT id INTO catalogo_web_feature_id FROM public.caracteristicas WHERE codigo_interno = 'CATALOGO_WEB';
    IF catalogo_web_feature_id IS NOT NULL THEN
        DELETE FROM public.plan_caracteristicas WHERE caracteristica_id = catalogo_web_feature_id;
        DELETE FROM public.caracteristicas WHERE id = catalogo_web_feature_id;
        RAISE NOTICE ' -> Característica CATALOGO_WEB eliminada del sistema de planes.';
    END IF;

    SELECT id INTO aperturar_cajas_feature_id FROM public.caracteristicas WHERE codigo_interno = 'APERTURAR_CAJAS';
    IF aperturar_cajas_feature_id IS NOT NULL THEN
        DELETE FROM public.plan_caracteristicas WHERE caracteristica_id = aperturar_cajas_feature_id;
        DELETE FROM public.caracteristicas WHERE id = aperturar_cajas_feature_id;
        RAISE NOTICE ' -> Característica APERTURAR_CAJAS eliminada del sistema de planes.';
    END IF;
    
    RAISE NOTICE '--- Migración completada. ---';
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 4: Create new RPC Functions for SuperAdmin (Idempotent, no changes)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_company_modules_status(p_empresa_id uuid)
RETURNS TABLE (id uuid, codigo_interno text, nombre_visible text, descripcion text, precio_mensual numeric, is_active boolean)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.rol = 'SuperAdmin') THEN RAISE EXCEPTION 'Acceso denegado.'; END IF;
    RETURN QUERY SELECT m.id, m.codigo_interno, m.nombre_visible, m.descripcion, m.precio_mensual, em.estado = 'activo' as is_active
    FROM public.modulos m LEFT JOIN public.empresa_modulos em ON m.id = em.modulo_id AND em.empresa_id = p_empresa_id
    ORDER BY m.nombre_visible;
END;
$$;

CREATE OR REPLACE FUNCTION toggle_company_module(p_empresa_id uuid, p_modulo_id uuid, p_is_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.rol = 'SuperAdmin') THEN RAISE EXCEPTION 'Acceso denegado.'; END IF;
    INSERT INTO public.empresa_modulos (empresa_id, modulo_id, estado, fecha_activacion)
    VALUES (p_empresa_id, p_modulo_id, CASE WHEN p_is_active THEN 'activo' ELSE 'inactivo' END, now())
    ON CONFLICT (empresa_id, modulo_id) DO UPDATE SET estado = EXCLUDED.estado;
END;
$$;

-- -----------------------------------------------------------------------------
-- Step 5: Update `get_user_profile_data` with the DEFINITIVE FIX
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_profile_data();
CREATE OR REPLACE FUNCTION get_user_profile_data()
RETURNS table (
    empresa_id uuid,
    empresa_nombre text,
    empresa_logo text,
    empresa_nit text,
    empresa_timezone text,
    empresa_moneda text,
    empresa_modo_caja text,
    empresa_slug text,
    plan_actual text,
    estado_licencia text,
    fecha_fin_licencia date,
    nombre_completo text,
    rol text,
    avatar text,
    sucursal_id uuid,
    sucursal_principal_nombre text,
    historial_pagos json,
    "planDetails" jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_rol text;
BEGIN
    -- Get the user's role securely
    SELECT u.rol INTO v_user_rol FROM public.usuarios u WHERE u.id = auth.uid();

    -- Check if a user profile exists at all
    IF v_user_rol IS NULL THEN
        RETURN;
    END IF;
    
    IF v_user_rol = 'SuperAdmin' THEN
        -- SuperAdmin has a profile but no company context.
        RETURN QUERY
        SELECT
            NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text,
            NULL::text, NULL::text, 'SuperAdmin Plan'::text, 'Activa'::text,
            (now() + interval '10 year')::date,
            (SELECT u.nombre_completo FROM public.usuarios u WHERE u.id = auth.uid()),
            'SuperAdmin'::text,
            (SELECT u.avatar FROM public.usuarios u WHERE u.id = auth.uid()),
            NULL::uuid,
            'Global'::text,
            '[]'::json,
            '{}'::jsonb;
    ELSE
        -- For all other tenant users, perform the full query.
        RETURN QUERY
        SELECT
            u.empresa_id,
            e.nombre, e.logo, e.nit, e.timezone, e.moneda, e.modo_caja, e.slug,
            l.tipo_licencia, l.estado, l.fecha_fin,
            u.nombre_completo, u.rol, u.avatar, u.sucursal_id, s.nombre,
            (SELECT COALESCE(json_agg(pay ORDER BY pay.fecha_pago DESC), '[]'::json) FROM pagos_licencia pay WHERE pay.empresa_id = u.empresa_id),
            COALESCE(
                jsonb_build_object(
                    'id', p.id,
                    'title', p.nombre,
                    'limits', COALESCE((
                        SELECT jsonb_object_agg(regexp_replace(lower(c.codigo_interno), '_([a-z])', '\U\1', 'g'), pc.valor::numeric)
                        FROM plan_caracteristicas pc JOIN caracteristicas c ON pc.caracteristica_id = c.id
                        WHERE pc.plan_id = p.id AND c.tipo = 'LIMIT'
                    ), '{}'::jsonb),
                    'features', COALESCE((
                        SELECT jsonb_object_agg(
                            regexp_replace(lower(feature_code), '_([a-z])', '\U\1', 'g'),
                            is_active
                        )
                        FROM (
                            -- 1. Get boolean features from the base plan
                            SELECT 
                                c.codigo_interno as feature_code,
                                -- DEFINITIVE FIX: Use a robust CASE statement to handle bad data ('null' string, '', etc.)
                                CASE
                                    WHEN lower(pc.valor) = 'true' THEN true
                                    ELSE false
                                END as is_active
                            FROM caracteristicas c
                            LEFT JOIN plan_caracteristicas pc ON c.id = pc.caracteristica_id AND pc.plan_id = p.id
                            WHERE c.tipo = 'BOOLEAN'
                            
                            UNION ALL
                            
                            -- 2. Get active/inactive status of ALL modules for the company
                            SELECT
                                m.codigo_interno as feature_code,
                                COALESCE(em.estado = 'activo', false) as is_active
                            FROM modulos m
                            LEFT JOIN empresa_modulos em ON m.id = em.modulo_id AND em.empresa_id = u.empresa_id
                        ) as all_features
                    ), '{}'::jsonb)
                ),
                '{}'::jsonb
            ) as "planDetails"
        FROM
            public.usuarios u
        JOIN public.empresas e ON u.empresa_id = e.id
        LEFT JOIN public.licencias l ON u.empresa_id = l.empresa_id
        LEFT JOIN public.planes p ON l.plan_id = p.id
        LEFT JOIN public.sucursales s ON u.sucursal_id = s.id
        WHERE
            u.id = auth.uid();
    END IF;
END;
$$;