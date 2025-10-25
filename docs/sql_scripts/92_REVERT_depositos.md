-- =============================================================================
-- REVERT SCRIPT FOR: DEPOSITS (ALMACENES) FEATURE (V1)
-- =============================================================================
-- Este script revierte todos los cambios realizados por `92_FEATURE_depositos.md`.
--
-- INSTRUCCIONES:
-- Ejecuta este script completo para restaurar el estado anterior de la base de datos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Eliminar Triggers y Funciones de Seguridad
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_before_venta_insert_check_deposito ON public.ventas;
DROP FUNCTION IF EXISTS public.prevent_deposito_sales();

DROP TRIGGER IF EXISTS on_before_caja_insert_check_deposito ON public.sesiones_caja;
DROP FUNCTION IF EXISTS public.prevent_deposito_cash_session();

-- -----------------------------------------------------------------------------
-- Paso 2: Eliminar la columna `tipo` de la tabla `sucursales`
-- -----------------------------------------------------------------------------
ALTER TABLE public.sucursales DROP COLUMN IF EXISTS tipo;


-- -----------------------------------------------------------------------------
-- Paso 3: Revertir Funciones RPC a su estado anterior
-- -----------------------------------------------------------------------------

-- Revertir create_sucursal
DROP FUNCTION IF EXISTS public.create_sucursal(text, text, text, numeric, numeric, text);
CREATE OR REPLACE FUNCTION create_sucursal(p_nombre text, p_direccion text, p_telefono text, p_latitud numeric, p_longitud numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_sucursal_id uuid;
BEGIN
    INSERT INTO public.sucursales(empresa_id, nombre, direccion, telefono, latitud, longitud)
    VALUES (public.get_empresa_id_from_jwt(), p_nombre, p_direccion, p_telefono, p_latitud, p_longitud)
    RETURNING id INTO new_sucursal_id;
    RETURN new_sucursal_id;
END;
$$;

-- Revertir update_sucursal
DROP FUNCTION IF EXISTS public.update_sucursal(uuid, text, text, text, numeric, numeric, text);
CREATE OR REPLACE FUNCTION update_sucursal(p_sucursal_id uuid, p_nombre text, p_direccion text, p_telefono text, p_latitud numeric, p_longitud numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.sucursales SET nombre = p_nombre, direccion = p_direccion, telefono = p_telefono, latitud = p_latitud, longitud = p_longitud
    WHERE id = p_sucursal_id AND empresa_id = public.get_empresa_id_from_jwt();
END;
$$;

-- Revertir get_company_sucursales
DROP FUNCTION IF EXISTS public.get_company_sucursales();
CREATE OR REPLACE FUNCTION get_company_sucursales()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_empresa_id uuid; caller_rol text; caller_sucursal_id uuid; sucursales_list json; kpis json;
BEGIN
    SELECT empresa_id, rol, sucursal_id INTO caller_empresa_id, caller_rol, caller_sucursal_id FROM public.usuarios WHERE id = auth.uid();
    IF caller_rol IS NULL THEN RAISE EXCEPTION 'Acceso denegado.'; END IF;
    IF caller_rol = 'Propietario' THEN
        SELECT json_agg(s_info) INTO sucursales_list FROM (
            SELECT s.id, s.nombre, s.direccion, s.telefono, s.latitud, s.longitud,
                (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = s.id) as user_count
            FROM sucursales s WHERE s.empresa_id = caller_empresa_id ORDER BY s.nombre
        ) AS s_info;
        SELECT json_build_object('total_sucursales', (SELECT COUNT(*) FROM sucursales WHERE empresa_id = caller_empresa_id), 'total_empleados', (SELECT COUNT(*) FROM usuarios WHERE empresa_id = caller_empresa_id)) INTO kpis;
    ELSE
        SELECT json_build_object('user_sucursal_id', caller_sucursal_id) INTO sucursales_list;
        kpis := '{}'::json;
    END IF;
    RETURN json_build_object('sucursales', COALESCE(sucursales_list, '[]'::json), 'kpis', kpis);
END;
$$;

-- Revertir get_sucursal_details
DROP FUNCTION IF EXISTS public.get_sucursal_details(uuid);
CREATE OR REPLACE FUNCTION get_sucursal_details(p_sucursal_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sucursal_details json; users_list json; kpis json;
BEGIN
    SELECT to_json(s) INTO sucursal_details FROM (SELECT id, nombre, direccion, telefono, latitud, longitud FROM sucursales WHERE id = p_sucursal_id) s;
    SELECT json_agg(u) INTO users_list FROM (SELECT id, nombre_completo, correo, rol, avatar, created_at, sucursal_id FROM usuarios WHERE sucursal_id = p_sucursal_id ORDER BY rol, nombre_completo) u;
    SELECT json_build_object('total_company_users', (SELECT COUNT(*) FROM public.usuarios WHERE empresa_id = public.get_empresa_id_from_jwt())) INTO kpis;
    RETURN json_build_object('details', sucursal_details, 'users', COALESCE(users_list, '[]'::json), 'kpis', kpis);
END;
$$;

-- Revertir get_public_catalog_data
DROP FUNCTION IF EXISTS public.get_public_catalog_data(text);
CREATE OR REPLACE FUNCTION get_public_catalog_data(p_slug text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_empresa_id uuid; sucursales_list json; company_data json; products_list json; categories_list json; brands_list json;
BEGIN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = p_slug;
    IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Catálogo no encontrado.'; END IF;
    SELECT json_agg(s_info) INTO sucursales_list FROM (SELECT id, nombre, direccion, telefono, latitud, longitud FROM public.sucursales WHERE empresa_id = v_empresa_id ORDER BY nombre) AS s_info;
    SELECT to_jsonb(e) into company_data FROM empresas e WHERE id = v_empresa_id;
    SELECT json_agg(p) into products_list FROM productos p WHERE empresa_id = v_empresa_id;
    SELECT json_agg(c) into categories_list FROM categorias c WHERE empresa_id = v_empresa_id;
    SELECT json_agg(b) into brands_list FROM (SELECT DISTINCT marca as nombre FROM productos WHERE empresa_id = v_empresa_id AND marca IS NOT NULL) b;
    RETURN json_build_object('company', company_data, 'products', products_list, 'categories', categories_list, 'brands', brands_list, 'sucursales', sucursales_list);
END;
$$;

-- Revertir get_gastos_filter_data
DROP FUNCTION IF EXISTS public.get_gastos_filter_data();
CREATE OR REPLACE FUNCTION get_gastos_filter_data()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_empresa_id uuid := public.get_empresa_id_from_jwt(); categories_list json; users_list json; branches_list json;
BEGIN
    SELECT json_agg(c) INTO categories_list FROM (SELECT id, nombre FROM public.gastos_categorias WHERE empresa_id = caller_empresa_id ORDER BY nombre) c;
    SELECT json_agg(u) INTO users_list FROM (SELECT id, nombre_completo FROM public.usuarios WHERE empresa_id = caller_empresa_id ORDER BY nombre_completo) u;
    SELECT json_agg(s) INTO branches_list FROM (SELECT id, nombre FROM public.sucursales WHERE empresa_id = caller_empresa_id ORDER BY nombre) s;
    RETURN json_build_object('categories', COALESCE(categories_list, '[]'::json), 'users', COALESCE(users_list, '[]'::json), 'branches', COALESCE(branches_list, '[]'::json));
END;
$$;

-- Revertir get_historial_cajas
DROP FUNCTION IF EXISTS public.get_historial_cajas(date, date, text, uuid, uuid, text);
CREATE OR REPLACE FUNCTION get_historial_cajas(p_start_date date, p_end_date date, p_timezone text, p_sucursal_id uuid, p_usuario_id uuid, p_estado_arqueo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE kpis jsonb; historial_list json; filter_options json;
BEGIN
    SELECT json_build_object(
        'sucursales', (SELECT json_agg(s_opts) FROM (SELECT id, nombre FROM public.sucursales WHERE empresa_id = public.get_empresa_id_from_jwt() ORDER BY nombre) s_opts),
        'usuarios', (SELECT json_agg(u_opts) FROM (SELECT id, nombre_completo FROM public.usuarios WHERE empresa_id = public.get_empresa_id_from_jwt() ORDER BY nombre_completo) u_opts)
    ) INTO filter_options;
    SELECT jsonb_build_object('total_ventas_efectivo', 0) INTO kpis;
    SELECT '[]'::json INTO historial_list;
    RETURN jsonb_build_object('kpis', kpis, 'historial', historial_list, 'filterOptions', filter_options);
END;
$$;

-- =============================================================================
-- Fin del script de reversión.
-- =============================================================================
