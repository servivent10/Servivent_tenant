-- =============================================================================
-- PRODUCTOS, INVENTARIOS & PRECIOS - DATABASE SETUP (v6 - Inventory Adjust)
-- =============================================================================
-- Este script crea y actualiza toda la estructura de base de datos y la lógica
-- de negocio para los módulos de Productos, Inventarios y la nueva gestión
-- avanzada de precios, incluyendo el ordenamiento manual de listas.
--
-- **INSTRUCCIONES:**
-- 1. Crea un nuevo Bucket en Supabase Storage llamado `productos` y márcalo como público.
-- 2. Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Creación y Modificación de Tablas
-- -----------------------------------------------------------------------------

-- Tabla de Categorías
CREATE TABLE IF NOT EXISTS public.categorias (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nombre text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

-- Tabla de Productos (Catálogo Maestro)
CREATE TABLE IF NOT EXISTS public.productos (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nombre text NOT NULL,
    sku text,
    marca text,
    modelo text,
    descripcion text,
    precio_compra numeric(10, 2) DEFAULT 0, -- Almacena el Costo Promedio Ponderado (CAPP)
    categoria_id uuid REFERENCES public.categorias(id) ON DELETE SET NULL,
    unidad_medida text DEFAULT 'Unidad'::text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT productos_sku_empresa_id_key UNIQUE (sku, empresa_id)
);
ALTER TABLE public.productos DROP COLUMN IF EXISTS precio_venta;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

-- Tabla de Imágenes de Productos
CREATE TABLE IF NOT EXISTS public.imagenes_productos (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
    imagen_url text NOT NULL,
    orden integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.imagenes_productos ENABLE ROW LEVEL SECURITY;

-- Tabla de Inventarios (Stock por Sucursal)
CREATE TABLE IF NOT EXISTS public.inventarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
    sucursal_id uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
    cantidad numeric(10, 2) DEFAULT 0 NOT NULL,
    stock_minimo numeric(10, 2) DEFAULT 0,
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT inventarios_producto_id_sucursal_id_key UNIQUE (producto_id, sucursal_id)
);
ALTER TABLE public.inventarios ENABLE ROW LEVEL SECURITY;

-- **NUEVO:** Tabla de Movimientos de Inventario (para auditoría)
CREATE TABLE IF NOT EXISTS public.movimientos_inventario (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
    sucursal_id uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
    usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    tipo_movimiento text NOT NULL, -- Ej: 'Ajuste Manual', 'Venta', 'Compra', 'Traspaso Entrada', 'Traspaso Salida'
    cantidad_ajustada numeric(10, 2) NOT NULL,
    stock_anterior numeric(10, 2) NOT NULL,
    stock_nuevo numeric(10, 2) NOT NULL,
    motivo text,
    referencia_id uuid, -- Para vincular a una venta, compra, traspaso, etc.
    created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;


-- **NUEVO:** Tabla de Listas de Precios (con columna de orden)
CREATE TABLE IF NOT EXISTS public.listas_precios (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nombre text NOT NULL,
    descripcion text,
    es_predeterminada boolean DEFAULT false NOT NULL,
    orden integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.listas_precios ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 0;
ALTER TABLE public.listas_precios ENABLE ROW LEVEL SECURITY;

-- **NUEVO:** Tabla de Precios de Productos
CREATE TABLE IF NOT EXISTS public.precios_productos (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
    lista_precio_id uuid NOT NULL REFERENCES public.listas_precios(id) ON DELETE CASCADE,
    precio numeric(10, 2) NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT precios_productos_producto_id_lista_precio_id_key UNIQUE (producto_id, lista_precio_id)
);
ALTER TABLE public.precios_productos ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- Paso 2: Políticas de Seguridad a Nivel de Fila (RLS)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable all for own company" ON public.categorias;
CREATE POLICY "Enable all for own company" ON public.categorias FOR ALL USING (empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));
DROP POLICY IF EXISTS "Enable all for own company" ON public.productos;
CREATE POLICY "Enable all for own company" ON public.productos FOR ALL USING (empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));
DROP POLICY IF EXISTS "Enable all actions for own company" ON public.imagenes_productos;
CREATE POLICY "Enable all actions for own company" ON public.imagenes_productos FOR ALL USING (producto_id IN (SELECT id FROM public.productos WHERE empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())));
DROP POLICY IF EXISTS "Enable all actions for own company" ON public.inventarios;
CREATE POLICY "Enable all actions for own company" ON public.inventarios FOR ALL USING (producto_id IN (SELECT id FROM public.productos WHERE empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())));
DROP POLICY IF EXISTS "Enable all for own company" ON public.movimientos_inventario;
CREATE POLICY "Enable all for own company" ON public.movimientos_inventario FOR ALL USING (producto_id IN (SELECT id FROM public.productos WHERE empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())));
DROP POLICY IF EXISTS "Enable all for own company" ON public.listas_precios;
CREATE POLICY "Enable all for own company" ON public.listas_precios FOR ALL USING (empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));
DROP POLICY IF EXISTS "Enable all for own company" ON public.precios_productos;
CREATE POLICY "Enable all for own company" ON public.precios_productos FOR ALL USING (producto_id IN (SELECT id FROM public.productos WHERE empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())));
DROP POLICY IF EXISTS "Unified Storage Policy - Productos INSERT" ON storage.objects;
CREATE POLICY "Unified Storage Policy - Productos INSERT" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'productos' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = get_my_empresa_id_securely()::text);
DROP POLICY IF EXISTS "Unified Storage Policy - Productos UPDATE" ON storage.objects;
CREATE POLICY "Unified Storage Policy - Productos UPDATE" ON storage.objects FOR UPDATE USING (bucket_id = 'productos' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = get_my_empresa_id_securely()::text);


-- -----------------------------------------------------------------------------
-- Paso 3: Funciones RPC (Lógica de Negocio)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_company_products_with_stock() RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE caller_empresa_id uuid; products_list json; kpis json; BEGIN caller_empresa_id := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid()); IF caller_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario no encontrado.'; END IF; SELECT json_agg(p_info) INTO products_list FROM ( SELECT p.id, p.nombre, p.sku, p.marca, p.modelo, p.categoria_id, p.unidad_medida, p.descripcion, c.nombre as categoria_nombre, COALESCE(i.stock_total, 0) as stock_total, COALESCE(pp.precio, 0) as precio_base, (SELECT img.imagen_url FROM public.imagenes_productos img WHERE img.producto_id = p.id ORDER BY img.orden, img.created_at LIMIT 1) as imagen_principal FROM public.productos p LEFT JOIN public.categorias c ON p.categoria_id = c.id LEFT JOIN ( SELECT inv.producto_id, SUM(inv.cantidad) as stock_total FROM public.inventarios inv GROUP BY inv.producto_id ) i ON p.id = i.producto_id LEFT JOIN public.listas_precios lp ON lp.empresa_id = p.empresa_id AND lp.es_predeterminada = true LEFT JOIN public.precios_productos pp ON pp.producto_id = p.id AND pp.lista_precio_id = lp.id WHERE p.empresa_id = caller_empresa_id ORDER BY p.created_at DESC ) AS p_info; SELECT json_build_object( 'total_products', (SELECT COUNT(*) FROM public.productos WHERE empresa_id = caller_empresa_id), 'total_stock_items', COALESCE((SELECT SUM(cantidad) FROM public.inventarios inv JOIN public.productos pr ON inv.producto_id = pr.id WHERE pr.empresa_id = caller_empresa_id), 0), 'products_without_stock', (SELECT COUNT(*) FROM public.productos p WHERE p.empresa_id = caller_empresa_id AND COALESCE((SELECT SUM(inv.cantidad) FROM public.inventarios inv WHERE inv.producto_id = p.id), 0) <= 0) ) INTO kpis; RETURN json_build_object('products', COALESCE(products_list, '[]'::json), 'kpis', kpis); END; $$;
CREATE OR REPLACE FUNCTION get_product_details(p_producto_id uuid) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE caller_empresa_id uuid; details jsonb; images json; inventory json; prices json; all_branches json; BEGIN caller_empresa_id := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid()); IF NOT EXISTS (SELECT 1 FROM public.productos WHERE id = p_producto_id AND empresa_id = caller_empresa_id) THEN RAISE EXCEPTION 'Producto no encontrado o no pertenece a tu empresa.'; END IF; SELECT to_jsonb(p) || jsonb_build_object('categoria_nombre', c.nombre) INTO details FROM public.productos p LEFT JOIN public.categorias c ON p.categoria_id = c.id WHERE p.id = p_producto_id; SELECT json_agg(i ORDER BY i.orden) INTO images FROM public.imagenes_productos i WHERE i.producto_id = p_producto_id; SELECT json_agg(inv) INTO inventory FROM ( SELECT i.sucursal_id, i.cantidad, i.stock_minimo, s.nombre as sucursal_nombre FROM public.inventarios i JOIN public.sucursales s ON i.sucursal_id = s.id WHERE i.producto_id = p_producto_id ) inv; SELECT json_agg(pr) INTO prices FROM ( SELECT lp.id as lista_precio_id, lp.nombre as lista_nombre, lp.es_predeterminada, pp.precio FROM public.listas_precios lp LEFT JOIN public.precios_productos pp ON lp.id = pp.lista_precio_id AND pp.producto_id = p_producto_id WHERE lp.empresa_id = caller_empresa_id ORDER BY lp.es_predeterminada DESC, lp.orden ASC, lp.nombre ASC ) pr; SELECT json_agg(b) INTO all_branches FROM (SELECT id, nombre FROM public.sucursales WHERE empresa_id = caller_empresa_id ORDER BY nombre) b; RETURN json_build_object('details', details, 'images', COALESCE(images, '[]'::json), 'inventory', COALESCE(inventory, '[]'::json), 'prices', COALESCE(prices, '[]'::json), 'all_branches', COALESCE(all_branches, '[]'::json)); END; $$;
CREATE OR REPLACE FUNCTION upsert_product( p_id uuid, p_nombre text, p_sku text, p_marca text, p_modelo text, p_descripcion text, p_categoria_id uuid, p_unidad_medida text, p_precio_base numeric ) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE caller_empresa_id uuid; v_producto_id uuid; v_default_price_list_id uuid; BEGIN caller_empresa_id := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid()); IF caller_empresa_id IS NULL THEN RAISE EXCEPTION 'Usuario no encontrado.'; END IF; SELECT id INTO v_default_price_list_id FROM public.listas_precios WHERE empresa_id = caller_empresa_id AND es_predeterminada = true; IF v_default_price_list_id IS NULL THEN INSERT INTO public.listas_precios (empresa_id, nombre, es_predeterminada, descripcion) VALUES (caller_empresa_id, 'General', true, 'Precio de venta estándar') RETURNING id INTO v_default_price_list_id; END IF; IF p_id IS NULL THEN INSERT INTO public.productos(empresa_id, nombre, sku, marca, modelo, descripcion, categoria_id, unidad_medida) VALUES (caller_empresa_id, p_nombre, p_sku, p_marca, p_modelo, p_descripcion, p_categoria_id, p_unidad_medida) RETURNING id INTO v_producto_id; ELSE UPDATE public.productos SET nombre = p_nombre, sku = p_sku, marca = p_marca, modelo = p_modelo, descripcion = p_descripcion, categoria_id = p_categoria_id, unidad_medida = p_unidad_medida WHERE id = p_id AND empresa_id = caller_empresa_id; v_producto_id := p_id; END IF; INSERT INTO public.precios_productos(producto_id, lista_precio_id, precio) VALUES(v_producto_id, v_default_price_list_id, p_precio_base) ON CONFLICT (producto_id, lista_precio_id) DO UPDATE SET precio = EXCLUDED.precio, updated_at = now(); RETURN v_producto_id; END; $$;
DROP TYPE IF EXISTS public.price_update CASCADE; CREATE TYPE public.price_update AS ( lista_id uuid, precio numeric );
CREATE OR REPLACE FUNCTION update_product_prices( p_producto_id uuid, p_precios price_update[] ) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE caller_empresa_id uuid; price_item price_update; BEGIN caller_empresa_id := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid()); IF NOT EXISTS (SELECT 1 FROM public.productos WHERE id = p_producto_id AND empresa_id = caller_empresa_id) THEN RAISE EXCEPTION 'Producto no encontrado o no pertenece a tu empresa.'; END IF; FOREACH price_item IN ARRAY p_precios LOOP IF EXISTS (SELECT 1 FROM public.listas_precios WHERE id = price_item.lista_id AND es_predeterminada = true) THEN CONTINUE; END IF; IF price_item.precio IS NOT NULL AND price_item.precio >= 0 THEN INSERT INTO public.precios_productos(producto_id, lista_precio_id, precio) VALUES(p_producto_id, price_item.lista_id, price_item.precio) ON CONFLICT (producto_id, lista_precio_id) DO UPDATE SET precio = EXCLUDED.precio, updated_at = now(); ELSE DELETE FROM public.precios_productos WHERE producto_id = p_producto_id AND lista_precio_id = price_item.lista_id; END IF; END LOOP; END; $$;

-- Función para obtener listas de precios (ordenada por `orden`)
CREATE OR REPLACE FUNCTION get_price_lists()
RETURNS TABLE (id uuid, nombre text, descripcion text, es_predeterminada boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN QUERY SELECT lp.id, lp.nombre, lp.descripcion, lp.es_predeterminada
    FROM public.listas_precios lp
    WHERE lp.empresa_id = (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid())
    ORDER BY lp.es_predeterminada DESC, lp.orden ASC, lp.nombre ASC;
END;
$$;

-- Función para insertar/actualizar una lista de precios (asignando `orden`)
CREATE OR REPLACE FUNCTION upsert_price_list(p_id uuid, p_nombre text, p_descripcion text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
    v_list_id uuid;
    v_new_order integer;
BEGIN
    caller_empresa_id := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid());
    IF p_id IS NULL THEN
        -- Asignar el siguiente número de orden al crear
        SELECT COALESCE(MAX(orden), -1) + 1 INTO v_new_order FROM public.listas_precios WHERE empresa_id = caller_empresa_id AND es_predeterminada = false;
        INSERT INTO public.listas_precios(empresa_id, nombre, descripcion, orden) VALUES (caller_empresa_id, p_nombre, p_descripcion, v_new_order) RETURNING id INTO v_list_id;
    ELSE
        UPDATE public.listas_precios SET nombre = p_nombre, descripcion = p_descripcion WHERE id = p_id AND empresa_id = caller_empresa_id;
        v_list_id := p_id;
    END IF;
    RETURN v_list_id;
END;
$$;

-- **NUEVA FUNCIÓN:** Actualizar el orden de las listas de precios
CREATE OR REPLACE FUNCTION update_price_list_order(p_list_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid;
BEGIN
    caller_empresa_id := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid());
    IF caller_empresa_id IS NULL THEN RAISE EXCEPTION 'Acceso denegado.'; END IF;

    -- Actualiza el campo 'orden' para cada ID en el array, basado en su posición
    WITH new_order AS (
        SELECT
            id,
            -- row_number() es 1-based, restamos 1 para que el orden sea 0-based
            (row_number() OVER ()) - 1 AS orden
        FROM unnest(p_list_ids) as id
    )
    UPDATE public.listas_precios lp
    SET orden = new_order.orden
    FROM new_order
    WHERE lp.id = new_order.id AND lp.empresa_id = caller_empresa_id;
END;
$$;

-- **FUNCIÓN ACTUALIZADA:** Obtener datos para el Punto de Venta (POS)
-- **CAMBIO:** Ahora incluye el stock en TODAS las sucursales para cada producto.
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
BEGIN
    -- 1. Obtener la información del usuario que realiza la llamada
    SELECT u.empresa_id, u.sucursal_id INTO caller_empresa_id, caller_sucursal_id
    FROM public.usuarios u WHERE u.id = auth.uid();

    IF caller_empresa_id IS NULL OR caller_sucursal_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado o no asignado a una sucursal.';
    END IF;

    -- 2. Obtener todas las listas de precios de la empresa
    SELECT json_agg(pl_info) INTO price_lists_list FROM (
        SELECT id, nombre, es_predeterminada
        FROM public.listas_precios
        WHERE empresa_id = caller_empresa_id
        ORDER BY es_predeterminada DESC, orden ASC, nombre ASC
    ) AS pl_info;

    -- 3. Obtener todos los productos con su stock y precios
    SELECT json_agg(p_info) INTO products_list FROM (
        SELECT
            p.id,
            p.nombre,
            p.sku,
            p.marca,
            p.unidad_medida,
            c.nombre as categoria_nombre,
            (SELECT img.imagen_url FROM public.imagenes_productos img WHERE img.producto_id = p.id ORDER BY img.orden, img.created_at LIMIT 1) as imagen_principal,
            -- Obtener el stock SÓLO para la sucursal del usuario
            COALESCE((SELECT i.cantidad FROM public.inventarios i WHERE i.producto_id = p.id AND i.sucursal_id = caller_sucursal_id), 0) as stock_sucursal,
            -- **NUEVO:** Obtener el stock en TODAS las sucursales
            (
                SELECT json_agg(json_build_object('sucursal_id', s.id, 'sucursal_nombre', s.nombre, 'cantidad', COALESCE(i.cantidad, 0)))
                FROM public.sucursales s
                LEFT JOIN public.inventarios i ON s.id = i.sucursal_id AND i.producto_id = p.id
                WHERE s.empresa_id = caller_empresa_id
            ) as all_branch_stock,
            -- Agregar todos los precios del producto en un único objeto JSON
            (
                SELECT json_object_agg(pp.lista_precio_id, pp.precio)
                FROM public.precios_productos pp
                WHERE pp.producto_id = p.id
            ) as prices
        FROM
            public.productos p
        LEFT JOIN public.categorias c ON p.categoria_id = c.id
        WHERE
            p.empresa_id = caller_empresa_id
        ORDER BY
            p.nombre ASC
    ) AS p_info;

    -- 4. Devolver el objeto JSON combinado
    RETURN json_build_object(
        'products', COALESCE(products_list, '[]'::json),
        'price_lists', COALESCE(price_lists_list, '[]'::json)
    );
END;
$$;

-- **NUEVO TIPO Y FUNCIÓN:** Para ajustes de inventario
DROP TYPE IF EXISTS public.inventory_adjustment CASCADE;
CREATE TYPE public.inventory_adjustment AS (
    sucursal_id uuid,
    cantidad_ajuste numeric
);

CREATE OR REPLACE FUNCTION ajustar_inventario_lote(
    p_producto_id uuid,
    p_ajustes inventory_adjustment[],
    p_motivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_user_id uuid := auth.uid();
    caller_empresa_id uuid;
    caller_rol text;
    ajuste inventory_adjustment;
    stock_anterior numeric;
    stock_nuevo numeric;
BEGIN
    -- 1. Validar permisos del usuario
    SELECT empresa_id, rol INTO caller_empresa_id, caller_rol FROM public.usuarios WHERE id = caller_user_id;
    IF caller_rol NOT IN ('Propietario', 'Administrador') THEN
        RAISE EXCEPTION 'Acceso denegado. Se requiere rol de Propietario o Administrador.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.productos WHERE id = p_producto_id AND empresa_id = caller_empresa_id) THEN
        RAISE EXCEPTION 'Producto no encontrado o no pertenece a tu empresa.';
    END IF;

    -- 2. Iterar sobre cada ajuste en el array
    FOREACH ajuste IN ARRAY p_ajustes
    LOOP
        -- 2.1. Obtener el stock actual y calcular el nuevo
        SELECT cantidad INTO stock_anterior FROM public.inventarios
        WHERE producto_id = p_producto_id AND sucursal_id = ajuste.sucursal_id;
        
        stock_anterior := COALESCE(stock_anterior, 0);
        stock_nuevo := stock_anterior + ajuste.cantidad_ajuste;

        -- 2.2. Actualizar (o insertar) el registro en la tabla de inventarios
        INSERT INTO public.inventarios (producto_id, sucursal_id, cantidad, updated_at)
        VALUES (p_producto_id, ajuste.sucursal_id, stock_nuevo, now())
        ON CONFLICT (producto_id, sucursal_id)
        DO UPDATE SET
            cantidad = EXCLUDED.cantidad,
            updated_at = EXCLUDED.updated_at;

        -- 2.3. Registrar el movimiento para auditoría
        INSERT INTO public.movimientos_inventario (
            producto_id, sucursal_id, usuario_id, tipo_movimiento,
            cantidad_ajustada, stock_anterior, stock_nuevo, motivo
        ) VALUES (
            p_producto_id, ajuste.sucursal_id, caller_user_id, 'Ajuste Manual',
            ajuste.cantidad_ajuste, stock_anterior, stock_nuevo, p_motivo
        );
    END LOOP;
END;
$$;


CREATE OR REPLACE FUNCTION delete_price_list(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE caller_empresa_id uuid; BEGIN caller_empresa_id := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid()); IF EXISTS (SELECT 1 FROM public.listas_precios WHERE id = p_id AND empresa_id = caller_empresa_id AND es_predeterminada = true) THEN RAISE EXCEPTION 'No se puede eliminar la lista de precios predeterminada.'; END IF; DELETE FROM public.listas_precios WHERE id = p_id AND empresa_id = caller_empresa_id; END; $$;
CREATE OR REPLACE FUNCTION get_all_categories() RETURNS TABLE (id uuid, nombre text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN RETURN QUERY SELECT c.id, c.nombre FROM public.categorias c WHERE c.empresa_id = (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid()) ORDER BY c.nombre; END; $$;
CREATE OR REPLACE FUNCTION create_category(p_nombre text) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE new_category record; BEGIN INSERT INTO public.categorias(empresa_id, nombre) VALUES ((SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid()), p_nombre) RETURNING id, nombre INTO new_category; RETURN json_build_object('id', new_category.id, 'nombre', new_category.nombre); END; $$;
DROP TYPE IF EXISTS public.product_image_input CASCADE; CREATE TYPE public.product_image_input AS (imagen_url text, orden integer);
CREATE OR REPLACE FUNCTION add_product_images(p_producto_id uuid, p_images product_image_input[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE caller_empresa_id uuid; img product_image_input; BEGIN caller_empresa_id := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid()); IF NOT EXISTS (SELECT 1 FROM public.productos WHERE id = p_producto_id AND empresa_id = caller_empresa_id) THEN RAISE EXCEPTION 'Producto no encontrado.'; END IF; FOREACH img IN ARRAY p_images LOOP INSERT INTO public.imagenes_productos(producto_id, imagen_url, orden) VALUES (p_producto_id, img.imagen_url, img.orden); END LOOP; END; $$;
CREATE OR REPLACE FUNCTION delete_product(p_producto_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE caller_empresa_id uuid; total_stock numeric; BEGIN caller_empresa_id := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid()); IF NOT EXISTS (SELECT 1 FROM public.productos WHERE id = p_producto_id AND empresa_id = caller_empresa_id) THEN RAISE EXCEPTION 'Producto no encontrado.'; END IF; SELECT COALESCE(SUM(cantidad), 0) INTO total_stock FROM public.inventarios WHERE producto_id = p_producto_id; IF total_stock > 0 THEN RAISE EXCEPTION 'No se puede eliminar un producto que tiene stock registrado.'; END IF; DELETE FROM public.productos WHERE id = p_producto_id; END; $$;

-- =============================================================================
-- Fin del script.
-- =============================================================================