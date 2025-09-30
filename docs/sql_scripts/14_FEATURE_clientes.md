-- =============================================================================
-- CLIENTS (CLIENTES) MODULE - DATABASE SETUP
-- =============================================================================
-- Este script crea toda la estructura de base de datos y la lógica de negocio
-- para el nuevo módulo de Clientes.
--
-- **INSTRUCCIONES:**
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Creación de la Tabla `clientes`
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nombre text NOT NULL,
    nit_ci text,
    telefono text,
    email text,
    direccion text,
    avatar_url text,
    saldo_pendiente numeric(10, 2) DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Habilitar RLS y crear política de seguridad
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.clientes;
CREATE POLICY "Enable all for own company" ON public.clientes
FOR ALL USING (empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));


-- -----------------------------------------------------------------------------
-- Paso 2: Funciones RPC para Clientes
-- -----------------------------------------------------------------------------

-- Función para obtener todos los clientes de una empresa
CREATE OR REPLACE FUNCTION get_company_clients()
RETURNS TABLE (
    id uuid,
    nombre text,
    nit_ci text,
    telefono text,
    email text,
    direccion text,
    avatar_url text,
    saldo_pendiente numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid());
BEGIN
    RETURN QUERY
    SELECT
        c.id, c.nombre, c.nit_ci, c.telefono, c.email, c.direccion, c.avatar_url, c.saldo_pendiente
    FROM
        public.clientes c
    WHERE
        c.empresa_id = caller_empresa_id
    ORDER BY
        c.created_at DESC;
END;
$$;


-- Función para crear o actualizar un cliente (Upsert)
CREATE OR REPLACE FUNCTION upsert_client(
    p_id uuid,
    p_nombre text,
    p_nit_ci text,
    p_telefono text,
    p_email text,
    p_direccion text,
    p_avatar_url text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid());
    v_cliente_id uuid;
BEGIN
    IF p_id IS NULL THEN
        INSERT INTO public.clientes(empresa_id, nombre, nit_ci, telefono, email, direccion, avatar_url)
        VALUES (caller_empresa_id, p_nombre, p_nit_ci, p_telefono, p_email, p_direccion, p_avatar_url)
        RETURNING id INTO v_cliente_id;
    ELSE
        UPDATE public.clientes
        SET
            nombre = p_nombre,
            nit_ci = p_nit_ci,
            telefono = p_telefono,
            email = p_email,
            direccion = p_direccion,
            avatar_url = p_avatar_url
        WHERE id = p_id AND empresa_id = caller_empresa_id;
        v_cliente_id := p_id;
    END IF;
    RETURN v_cliente_id;
END;
$$;

-- Función para eliminar un cliente
CREATE OR REPLACE FUNCTION delete_client(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid());
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_id AND empresa_id = caller_empresa_id) THEN
        RAISE EXCEPTION 'Cliente no encontrado o no pertenece a tu empresa.';
    END IF;

    -- Futura validación: No permitir eliminar si tiene saldo pendiente o ventas asociadas.
    -- IF (SELECT saldo_pendiente FROM public.clientes WHERE id = p_id) > 0 THEN
    --     RAISE EXCEPTION 'No se puede eliminar un cliente con saldo pendiente.';
    -- END IF;

    DELETE FROM public.clientes WHERE id = p_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- Paso 3: Actualizar la función `get_pos_data` para incluir clientes
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_pos_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    caller_sucursal_id uuid;
    products_list json;
    price_lists_list json;
    clients_list json;
BEGIN
    SELECT u.empresa_id, u.sucursal_id INTO caller_empresa_id, caller_sucursal_id
    FROM public.usuarios u WHERE u.id = auth.uid();

    IF caller_empresa_id IS NULL OR caller_sucursal_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado o no asignado a una sucursal.';
    END IF;

    SELECT json_agg(pl_info) INTO price_lists_list
    FROM (
        SELECT id, nombre, es_predeterminada
        FROM public.listas_precios
        WHERE empresa_id = caller_empresa_id
        ORDER BY es_predeterminada DESC, orden ASC, nombre ASC
    ) AS pl_info;

    SELECT json_agg(c_info) INTO clients_list
    FROM (
        SELECT id, nombre, nit_ci, telefono, avatar_url
        FROM public.clientes
        WHERE empresa_id = caller_empresa_id
        ORDER BY
          CASE
            WHEN nombre = 'Consumidor Final' THEN 0
            ELSE 1
          END,
          nombre
    ) AS c_info;

    SELECT json_agg(p_info) INTO products_list FROM (
        SELECT
            p.id, p.nombre, p.sku, p.marca, p.modelo, p.descripcion, p.unidad_medida,
            c.nombre as categoria_nombre,
            (SELECT img.imagen_url FROM public.imagenes_productos img WHERE img.producto_id = p.id ORDER BY img.orden, img.created_at LIMIT 1) as imagen_principal,
            COALESCE((SELECT i.cantidad FROM public.inventarios i WHERE i.producto_id = p.id AND i.sucursal_id = caller_sucursal_id), 0) as stock_sucursal,
            (
                SELECT json_agg(json_build_object('sucursal_id', s.id, 'sucursal_nombre', s.nombre, 'cantidad', COALESCE(i.cantidad, 0)))
                FROM public.sucursales s
                LEFT JOIN public.inventarios i ON s.id = i.sucursal_id AND i.producto_id = p.id
                WHERE s.empresa_id = caller_empresa_id
            ) as all_branch_stock,
            (
                SELECT json_object_agg(pp.lista_precio_id, json_build_object('precio', pp.precio, 'ganancia_maxima', pp.ganancia_maxima, 'ganancia_minima', pp.ganancia_minima))
                FROM public.precios_productos pp
                WHERE pp.producto_id = p.id
            ) as prices
        FROM public.productos p
        LEFT JOIN public.categorias c ON p.categoria_id = c.id
        WHERE p.empresa_id = caller_empresa_id
        ORDER BY p.nombre ASC
    ) AS p_info;

    RETURN json_build_object(
        'products', COALESCE(products_list, '[]'::json),
        'price_lists', COALESCE(price_lists_list, '[]'::json),
        'clients', COALESCE(clients_list, '[]'::json)
    );
END;
$$;


-- =============================================================================
-- Fin del script.
-- =============================================================================