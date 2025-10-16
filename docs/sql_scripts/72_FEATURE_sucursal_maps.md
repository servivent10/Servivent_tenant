-- =============================================================================
-- SUCURSAL LOCATION MANAGEMENT WITH MAPS - DATABASE SETUP (V1)
-- =============================================================================
-- This script implements the backend infrastructure for managing branch
-- locations using geographic coordinates (latitude and longitude).
--
-- WHAT IT DOES:
-- 1. Adds `latitud` and `longitud` columns to the `sucursales` table.
-- 2. Updates all relevant RPC functions (`create_sucursal`, `update_sucursal`,
--    `get_company_sucursales`, `get_sucursal_details`, and `get_public_catalog_data`)
--    to handle these new geographic coordinates.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor. It is idempotent
-- and safe to run multiple times.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Add latitude and longitude columns to the sucursales table
-- -----------------------------------------------------------------------------
ALTER TABLE public.sucursales ADD COLUMN IF NOT EXISTS latitud numeric(10, 7);
ALTER TABLE public.sucursales ADD COLUMN IF NOT EXISTS longitud numeric(10, 7);


-- -----------------------------------------------------------------------------
-- Step 2: Update RPC Functions
-- -----------------------------------------------------------------------------

-- Function to create a new branch
DROP FUNCTION IF EXISTS public.create_sucursal(text, text, text);
CREATE OR REPLACE FUNCTION public.create_sucursal(
    p_nombre text,
    p_direccion text,
    p_telefono text,
    p_latitud numeric,
    p_longitud numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
    plan_id_from_license uuid;
    sucursal_count int;
    max_sucursales int;
    new_sucursal_id uuid;
BEGIN
    SELECT empresa_id, rol INTO caller_empresa_id, caller_rol
    FROM public.usuarios WHERE id = auth.uid();

    IF caller_rol != 'Propietario' THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de Propietario.';
    END IF;

    SELECT l.plan_id INTO plan_id_from_license FROM public.licencias l WHERE l.empresa_id = caller_empresa_id;
    IF plan_id_from_license IS NULL THEN
        RAISE EXCEPTION 'Error de consistencia de datos: La licencia de la empresa no está vinculada a un plan.';
    END IF;

    SELECT pc.valor::int INTO max_sucursales
    FROM public.plan_caracteristicas pc
    JOIN public.caracteristicas c ON pc.caracteristica_id = c.id
    WHERE pc.plan_id = plan_id_from_license AND c.codigo_interno = 'MAX_BRANCHES';
    IF max_sucursales IS NULL THEN
        RAISE EXCEPTION 'La configuración de límite de sucursales no está definida para el plan actual.';
    END IF;

    SELECT COUNT(*) INTO sucursal_count FROM public.sucursales WHERE empresa_id = caller_empresa_id;
    IF sucursal_count >= max_sucursales THEN
        RAISE EXCEPTION 'Límite de sucursales alcanzado para el plan actual.';
    END IF;
    
    INSERT INTO public.sucursales(empresa_id, nombre, direccion, telefono, latitud, longitud)
    VALUES (caller_empresa_id, p_nombre, p_direccion, p_telefono, p_latitud, p_longitud)
    RETURNING id INTO new_sucursal_id;

    RETURN new_sucursal_id;
END;
$$;


-- Function to update an existing branch
DROP FUNCTION IF EXISTS public.update_sucursal(uuid, text, text, text);
CREATE OR REPLACE FUNCTION public.update_sucursal(
    p_sucursal_id uuid,
    p_nombre text,
    p_direccion text,
    p_telefono text,
    p_latitud numeric,
    p_longitud numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
    target_empresa_id uuid;
BEGIN
    SELECT empresa_id, rol INTO caller_empresa_id, caller_rol FROM public.usuarios WHERE id = auth.uid();
    IF caller_rol NOT IN ('Propietario', 'Administrador') THEN RAISE EXCEPTION 'Acceso denegado.'; END IF;

    SELECT empresa_id INTO target_empresa_id FROM public.sucursales WHERE id = p_sucursal_id;
    IF target_empresa_id IS NULL OR target_empresa_id != caller_empresa_id THEN
        RAISE EXCEPTION 'Sucursal no encontrada o no pertenece a tu empresa.';
    END IF;

    UPDATE public.sucursales
    SET nombre = p_nombre, direccion = p_direccion, telefono = p_telefono, latitud = p_latitud, longitud = p_longitud
    WHERE id = p_sucursal_id;
END;
$$;


-- Function to get the list of company branches
DROP FUNCTION IF EXISTS public.get_company_sucursales();
CREATE OR REPLACE FUNCTION get_company_sucursales()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
    caller_sucursal_id uuid;
    sucursales_list json;
    kpis json;
BEGIN
    SELECT empresa_id, rol, sucursal_id INTO caller_empresa_id, caller_rol, caller_sucursal_id FROM public.usuarios WHERE id = auth.uid();
    IF caller_rol IS NULL THEN RAISE EXCEPTION 'Acceso denegado: Usuario no encontrado.'; END IF;

    IF caller_rol = 'Propietario' THEN
        SELECT json_agg(s_info) INTO sucursales_list FROM (
            SELECT
                s.id, s.nombre, s.direccion, s.telefono, s.latitud, s.longitud,
                (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = s.id) as user_count,
                (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = s.id AND rol = 'Propietario') as propietarios_count,
                (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = s.id AND rol = 'Administrador') as administradores_count,
                (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = s.id AND rol = 'Empleado') as empleados_count
            FROM sucursales s
            WHERE s.empresa_id = caller_empresa_id
            ORDER BY s.nombre
        ) AS s_info;
        
        SELECT json_build_object(
            'total_sucursales', (SELECT COUNT(*) FROM sucursales WHERE empresa_id = caller_empresa_id),
            'total_empleados', (SELECT COUNT(*) FROM usuarios WHERE empresa_id = caller_empresa_id),
            'propietarios_count', (SELECT COUNT(*) FROM usuarios WHERE empresa_id = caller_empresa_id AND rol = 'Propietario'),
            'administradores_count', (SELECT COUNT(*) FROM usuarios WHERE empresa_id = caller_empresa_id AND rol = 'Administrador'),
            'empleados_count', (SELECT COUNT(*) FROM usuarios WHERE empresa_id = caller_empresa_id AND rol = 'Empleado')
        ) INTO kpis;
    ELSE
        SELECT json_build_object('user_sucursal_id', caller_sucursal_id) INTO sucursales_list;
        kpis := '{}'::json;
    END IF;

    RETURN json_build_object('sucursales', COALESCE(sucursales_list, '[]'::json), 'kpis', kpis);
END;
$$;

-- Function to get details of a specific branch
DROP FUNCTION IF EXISTS public.get_sucursal_details(uuid);
CREATE OR REPLACE FUNCTION get_sucursal_details(p_sucursal_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    target_empresa_id uuid;
    sucursal_details json;
    users_list json;
    kpis json;
BEGIN
    SELECT empresa_id INTO caller_empresa_id FROM usuarios WHERE id = auth.uid();
    SELECT empresa_id INTO target_empresa_id FROM sucursales WHERE id = p_sucursal_id;
    IF caller_empresa_id IS NULL OR target_empresa_id IS NULL OR caller_empresa_id != target_empresa_id THEN
        RAISE EXCEPTION 'Acceso denegado a esta sucursal.';
    END IF;

    SELECT to_json(s) INTO sucursal_details FROM (
        SELECT id, nombre, direccion, telefono, latitud, longitud FROM sucursales WHERE id = p_sucursal_id
    ) s;

    SELECT json_agg(u) INTO users_list FROM (
        SELECT id, nombre_completo, correo, rol, avatar, created_at, sucursal_id
        FROM usuarios WHERE sucursal_id = p_sucursal_id ORDER BY rol, nombre_completo
    ) u;

    SELECT json_build_object(
        'total_company_users', (SELECT COUNT(*) FROM public.usuarios WHERE empresa_id = caller_empresa_id),
        'propietarios_count', (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = p_sucursal_id AND rol = 'Propietario'),
        'administradores_count', (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = p_sucursal_id AND rol = 'Administrador'),
        'empleados_count', (SELECT COUNT(*) FROM usuarios WHERE sucursal_id = p_sucursal_id AND rol = 'Empleado')
    ) INTO kpis;
    
    RETURN json_build_object('details', sucursal_details, 'users', COALESCE(users_list, '[]'::json), 'kpis', kpis);
END;
$$;

-- Function to get public catalog data
DROP FUNCTION IF EXISTS public.get_public_catalog_data(text);
CREATE OR REPLACE FUNCTION get_public_catalog_data(p_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_empresa_id uuid;
    v_empresa_record record;
    v_ofertas_web_list_id uuid;
    v_general_list_id uuid;
    company_data json;
    products_list json;
    categories_list json;
    brands_list json;
    sucursales_list json;
BEGIN
    SELECT id, nombre, logo, moneda INTO v_empresa_record
    FROM public.empresas WHERE slug = p_slug LIMIT 1;

    IF v_empresa_record.id IS NULL THEN RAISE EXCEPTION 'Catálogo no encontrado.'; END IF;
    v_empresa_id := v_empresa_record.id;

    SELECT id INTO v_ofertas_web_list_id FROM public.listas_precios WHERE empresa_id = v_empresa_id AND nombre = 'Ofertas Web';
    IF v_ofertas_web_list_id IS NULL THEN
        INSERT INTO public.listas_precios (empresa_id, nombre, descripcion, es_predeterminada, orden)
        VALUES (v_empresa_id, 'Ofertas Web', 'Precios especiales para el catálogo web.', false, 100)
        RETURNING id INTO v_ofertas_web_list_id;
    END IF;
    SELECT id INTO v_general_list_id FROM public.listas_precios WHERE empresa_id = v_empresa_id AND es_predeterminada = true;

    company_data := json_build_object(
        'nombre', v_empresa_record.nombre, 'logo', v_empresa_record.logo,
        'moneda_simbolo', CASE v_empresa_record.moneda WHEN 'BOB' THEN 'Bs' WHEN 'USD' THEN '$' ELSE v_empresa_record.moneda END
    );

    SELECT json_agg(p_info) INTO products_list FROM (
        SELECT p.id, p.nombre, p.sku, p.marca, p.modelo, p.descripcion, p.categoria_id, c.nombre as categoria_nombre,
            (SELECT img.imagen_url FROM public.imagenes_productos img WHERE img.producto_id = p.id ORDER BY img.orden, img.created_at LIMIT 1) as imagen_principal,
            (SELECT json_agg(json_build_object('url', img.imagen_url) ORDER BY img.orden) FROM public.imagenes_productos img WHERE img.producto_id = p.id) as imagenes,
            COALESCE((SELECT SUM(i.cantidad) FROM public.inventarios i WHERE i.producto_id = p.id), 0) as stock_consolidado,
            COALESCE((SELECT pp.precio FROM public.precios_productos pp WHERE pp.producto_id = p.id AND pp.lista_precio_id = v_general_list_id), 0) as precio_base,
            COALESCE((SELECT pp.precio FROM public.precios_productos pp WHERE pp.producto_id = p.id AND pp.lista_precio_id = v_ofertas_web_list_id), 0) as precio_oferta
        FROM public.productos p
        LEFT JOIN public.categorias c ON p.categoria_id = c.id
        WHERE p.empresa_id = v_empresa_id ORDER BY p.nombre
    ) AS p_info;

    SELECT json_agg(cat_info) INTO categories_list FROM (
        SELECT c.id, c.nombre, COUNT(p.id) as product_count FROM public.categorias c JOIN public.productos p ON c.id = p.categoria_id
        WHERE c.empresa_id = v_empresa_id GROUP BY c.id, c.nombre ORDER BY c.nombre
    ) AS cat_info;

    SELECT json_agg(brand_info) INTO brands_list FROM (
        SELECT p.marca as nombre, COUNT(p.id) as product_count FROM public.productos p
        WHERE p.empresa_id = v_empresa_id AND p.marca IS NOT NULL AND p.marca <> '' GROUP BY p.marca ORDER BY p.marca
    ) AS brand_info;

    SELECT json_agg(s_info) INTO sucursales_list FROM (
        SELECT id, nombre, direccion, telefono, latitud, longitud FROM public.sucursales
        WHERE empresa_id = v_empresa_id ORDER BY nombre
    ) AS s_info;

    RETURN json_build_object(
        'company', company_data,
        'products', COALESCE(products_list, '[]'::json),
        'categories', COALESCE(categories_list, '[]'::json),
        'brands', COALESCE(brands_list, '[]'::json),
        'sucursales', COALESCE(sucursales_list, '[]'::json)
    );
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================