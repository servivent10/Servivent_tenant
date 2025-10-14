-- =============================================================================
-- CLIENTS (CLIENTES) MODULE - DATABASE SETUP (V3 - Secure Client Code)
-- =============================================================================
-- Este script actualiza la lógica de negocio para el módulo de Clientes,
-- reemplazando el código de cliente predecible por uno aleatorio, corto y
-- globalmente único, ideal para ser usado de cara al cliente.
--
-- **INSTRUCCIONES:**
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Habilitar la extensión pgcrypto para generar UUIDs aleatorios
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Paso 2: Creación y Modificación de la Tabla `clientes`
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nombre text NOT NULL,
    nit_ci text,
    telefono text,
    correo text,
    direccion text,
    avatar_url text,
    saldo_pendiente numeric(10, 2) DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- ACTUALIZADO: Añadir columna `codigo_cliente` y constraint de unicidad GLOBAL
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS codigo_cliente text;
-- Eliminar la constraint antigua si existe (por empresa)
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_codigo_cliente_empresa_id_key;
-- Eliminar la nueva constraint si ya se ejecutó una versión anterior de este script
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_codigo_cliente_key;
-- Añadir la nueva constraint de unicidad GLOBAL
ALTER TABLE public.clientes ADD CONSTRAINT clientes_codigo_cliente_key UNIQUE (codigo_cliente);


-- Habilitar RLS y crear política de seguridad
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.clientes;
CREATE POLICY "Enable all for own company" ON public.clientes
FOR ALL USING (empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));


-- -----------------------------------------------------------------------------
-- Paso 3: Funciones RPC para Clientes
-- -----------------------------------------------------------------------------

-- ELIMINADO: La función get_initials ya no es necesaria.
DROP FUNCTION IF EXISTS public.get_initials(text);


-- ACTUALIZADO: Función para obtener todos los clientes de una empresa
DROP FUNCTION IF EXISTS public.get_company_clients();
CREATE OR REPLACE FUNCTION get_company_clients()
RETURNS TABLE (
    id uuid,
    nombre text,
    nit_ci text,
    telefono text,
    correo text,
    direccion text,
    avatar_url text,
    saldo_pendiente numeric,
    codigo_cliente text
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
        c.id, c.nombre, c.nit_ci, c.telefono, c.correo, c.direccion, c.avatar_url, c.saldo_pendiente, c.codigo_cliente
    FROM
        public.clientes c
    WHERE
        c.empresa_id = caller_empresa_id
    ORDER BY
        c.created_at DESC;
END;
$$;


-- ACTUALIZADO: Función para crear o actualizar un cliente (Upsert) con código aleatorio
DROP FUNCTION IF EXISTS public.upsert_client(uuid, text, text, text, text, text, text);
CREATE OR REPLACE FUNCTION upsert_client(
    p_id uuid,
    p_nombre text,
    p_nit_ci text,
    p_telefono text,
    p_correo text,
    p_direccion text,
    p_avatar_url text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid());
    v_cliente_id uuid;
    v_new_client_code text;
BEGIN
    IF p_id IS NULL THEN
        -- Crear un nuevo cliente con un código único aleatorio
        LOOP
            -- Generar un código alfanumérico de 8 caracteres
            v_new_client_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
            
            BEGIN
                -- Intentar insertar el nuevo cliente con el código generado
                INSERT INTO public.clientes(empresa_id, nombre, nit_ci, telefono, correo, direccion, avatar_url, codigo_cliente)
                VALUES (caller_empresa_id, p_nombre, p_nit_ci, p_telefono, p_correo, p_direccion, p_avatar_url, v_new_client_code)
                RETURNING id INTO v_cliente_id;
                
                -- Si la inserción es exitosa, salir del bucle
                EXIT;
            EXCEPTION WHEN unique_violation THEN
                -- Si el código ya existe, el bucle continuará para generar uno nuevo
                RAISE NOTICE 'Colisión de código de cliente detectada. Reintentando...';
            END;
        END LOOP;
    ELSE
        -- Actualizar un cliente existente (sin cambiar el código)
        UPDATE public.clientes
        SET
            nombre = p_nombre,
            nit_ci = p_nit_ci,
            telefono = p_telefono,
            correo = p_correo,
            direccion = p_direccion,
            avatar_url = p_avatar_url
        WHERE id = p_id AND empresa_id = caller_empresa_id;
        v_cliente_id := p_id;
    END IF;
    
    RETURN json_build_object('id', v_cliente_id);
END;
$$;

-- ELIMINADO: La función delete_client ha sido reemplazada por la Edge Function 'delete-client-with-auth'
DROP FUNCTION IF EXISTS public.delete_client(p_id uuid);


-- -----------------------------------------------------------------------------
-- Paso 4: Actualizar la función `get_pos_data` para incluir clientes
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
            p.id, p.nombre, p.sku, p.marca, p.modelo, p.descripcion, p.unidad_medida, p.created_at,
            c.nombre as categoria_nombre,
            p.categoria_id,
            (
                SELECT COALESCE(SUM(vi.cantidad), 0)
                FROM public.venta_items vi
                JOIN public.ventas v ON vi.venta_id = v.id
                WHERE vi.producto_id = p.id
                  AND v.empresa_id = caller_empresa_id
                  AND v.fecha >= (now() - interval '90 days')
            ) as unidades_vendidas_90_dias,
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