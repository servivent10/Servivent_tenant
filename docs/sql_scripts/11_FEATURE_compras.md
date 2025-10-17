-- =============================================================================
-- PURCHASES (COMPRAS) MODULE - DATABASE SETUP (V6 - Definitive Notification Fix)
-- =============================================================================
-- This script provides the definitive fix for purchase notifications.
--
-- PROBLEM SOLVED: The previous version only notified the branch of the user
-- creating the purchase, not the branches where items were actually distributed.
--
-- SOLUTION: The `registrar_compra` function now dynamically builds an array of
-- all unique destination branch IDs from the items' distribution and uses this array
-- to target the notification. This ensures users in all receiving branches,
-- as well as the Owner, are correctly notified.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create Tables (Idempotent, no changes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proveedores (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nombre text NOT NULL,
    nombre_contacto text,
    nit text,
    telefono text,
    email text,
    direccion text,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT proveedores_nit_empresa_id_key UNIQUE (nit, empresa_id)
);
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS nombre_contacto text;
ALTER TABLE public.proveedores ALTER COLUMN nit DROP NOT NULL;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.compras (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    sucursal_id uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
    proveedor_id uuid NOT NULL REFERENCES public.proveedores(id) ON DELETE RESTRICT,
    folio text NOT NULL,
    fecha timestamptz DEFAULT now() NOT NULL,
    moneda text NOT NULL,
    tasa_cambio numeric(10, 4),
    total numeric(10, 2) NOT NULL,
    total_bob numeric(10, 2) NOT NULL,
    tipo_pago text NOT NULL,
    estado_pago text NOT NULL,
    saldo_pendiente numeric(10, 2) DEFAULT 0 NOT NULL,
    n_factura text,
    fecha_vencimiento date,
    created_at timestamptz DEFAULT now() NOT NULL,
    usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL
);
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
DROP SEQUENCE IF EXISTS compra_folio_seq;

CREATE TABLE IF NOT EXISTS public.compra_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    compra_id uuid NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
    producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
    cantidad numeric(10, 2) NOT NULL,
    costo_unitario numeric(10, 2) NOT NULL
);
ALTER TABLE public.compra_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.pagos_compras (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    compra_id uuid NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
    fecha_pago timestamptz DEFAULT now() NOT NULL,
    monto numeric(10, 2) NOT NULL,
    metodo_pago text
);
ALTER TABLE public.pagos_compras ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Step 2: RLS Policies (Idempotent, no changes)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable all for own company" ON public.proveedores;
CREATE POLICY "Enable all for own company" ON public.proveedores FOR ALL USING (empresa_id = public.get_empresa_id_from_jwt());
DROP POLICY IF EXISTS "Enable all for own company" ON public.compras;
CREATE POLICY "Enable all for own company" ON public.compras FOR ALL USING (empresa_id = public.get_empresa_id_from_jwt());
DROP POLICY IF EXISTS "Enable all for own company" ON public.compra_items;
CREATE POLICY "Enable all for own company" ON public.compra_items FOR ALL USING (EXISTS (SELECT 1 FROM public.compras c WHERE c.id = compra_id AND c.empresa_id = public.get_empresa_id_from_jwt()));
DROP POLICY IF EXISTS "Enable all for own company" ON public.pagos_compras;
CREATE POLICY "Enable all for own company" ON public.pagos_compras FOR ALL USING (EXISTS (SELECT 1 FROM public.compras c WHERE c.id = compra_id AND c.empresa_id = public.get_empresa_id_from_jwt()));

-- -----------------------------------------------------------------------------
-- Step 3: RPC Functions (MAIN UPDATE IS HERE)
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_company_providers();
CREATE OR REPLACE FUNCTION get_company_providers()
RETURNS TABLE (id uuid, nombre text, nombre_contacto text, nit text, telefono text, email text, direccion text, saldo_pendiente numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN QUERY SELECT p.id, p.nombre, p.nombre_contacto, p.nit, p.telefono, p.email, p.direccion, COALESCE((SELECT SUM(c.saldo_pendiente) FROM public.compras c WHERE c.proveedor_id = p.id), 0) as saldo_pendiente FROM public.proveedores p WHERE p.empresa_id = public.get_empresa_id_from_jwt() ORDER BY p.nombre; END;
$$;

DROP FUNCTION IF EXISTS public.upsert_proveedor(uuid, text, text, text, text, text, text);
CREATE OR REPLACE FUNCTION upsert_proveedor(p_id uuid, p_nombre text, p_nit text, p_telefono text, p_email text, p_direccion text, p_nombre_contacto text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_empresa_id uuid := public.get_empresa_id_from_jwt(); v_proveedor_id uuid; v_nit_to_save text := NULLIF(TRIM(p_nit), '');
BEGIN IF p_id IS NULL THEN INSERT INTO public.proveedores(empresa_id, nombre, nit, telefono, email, direccion, nombre_contacto) VALUES (caller_empresa_id, p_nombre, v_nit_to_save, p_telefono, p_email, p_direccion, p_nombre_contacto) RETURNING id INTO v_proveedor_id; ELSE UPDATE public.proveedores SET nombre = p_nombre, nit = v_nit_to_save, telefono = p_telefono, email = p_email, direccion = p_direccion, nombre_contacto = p_nombre_contacto WHERE id = p_id AND empresa_id = caller_empresa_id; v_proveedor_id := p_id; END IF; RETURN v_proveedor_id; END;
$$;

DROP FUNCTION IF EXISTS public.get_purchase_details(uuid);
CREATE OR REPLACE FUNCTION get_purchase_details(p_compra_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE purchase_details jsonb; items_list json; payments_list json;
BEGIN SELECT to_jsonb(c) || jsonb_build_object('proveedor_nombre', p.nombre) INTO purchase_details FROM public.compras c JOIN public.proveedores p ON c.proveedor_id = p.id WHERE c.id = p_compra_id AND c.empresa_id = public.get_empresa_id_from_jwt(); IF NOT FOUND THEN RAISE EXCEPTION 'Compra no encontrada o no pertenece a tu empresa.'; END IF; SELECT json_agg(i) INTO items_list FROM (SELECT ci.*, p.nombre as producto_nombre FROM public.compra_items ci JOIN public.productos p ON ci.producto_id = p.id WHERE ci.compra_id = p_compra_id) i; SELECT json_agg(p) INTO payments_list FROM (SELECT * FROM public.pagos_compras WHERE compra_id = p_compra_id ORDER BY fecha_pago) p; RETURN purchase_details || jsonb_build_object('items', COALESCE(items_list, '[]'::json), 'pagos', COALESCE(payments_list, '[]'::json)); END;
$$;

DROP TYPE IF EXISTS public.distribucion_item_input CASCADE;
CREATE TYPE public.distribucion_item_input AS (sucursal_id uuid, cantidad numeric);
DROP TYPE IF EXISTS public.price_rule_input CASCADE;
CREATE TYPE public.price_rule_input AS (lista_id uuid, ganancia_maxima numeric, ganancia_minima numeric);
DROP TYPE IF EXISTS public.compra_item_input CASCADE;
CREATE TYPE public.compra_item_input AS (producto_id uuid, costo_unitario numeric, precios price_rule_input[], distribucion distribucion_item_input[]);
DROP TYPE IF EXISTS public.compra_input CASCADE;
CREATE TYPE public.compra_input AS (proveedor_id uuid, sucursal_id uuid, fecha timestamptz, moneda text, tasa_cambio numeric, tipo_pago text, n_factura text, fecha_vencimiento date, abono_inicial numeric, metodo_abono text);

-- FUNCIÓN PRINCIPAL PARA REGISTRAR COMPRA (CON NOTIFICACIÓN CORREGIDA)
CREATE OR REPLACE FUNCTION registrar_compra(p_compra compra_input, p_items compra_item_input[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    caller_user_id uuid := auth.uid();
    new_compra_id uuid;
    item compra_item_input;
    dist_item distribucion_item_input;
    price_rule price_rule_input;
    total_compra numeric := 0;
    total_compra_bob numeric;
    saldo_final numeric;
    estado_final text;
    stock_total_actual numeric;
    capp_actual numeric;
    nuevo_capp numeric;
    costo_unitario_bob numeric;
    new_price numeric;
    next_folio_number integer;
    cantidad_total_item numeric;
    v_folio text;
    v_proveedor_nombre text;
    v_destination_branch_ids uuid[]; -- **NUEVA VARIABLE**
BEGIN
    FOREACH item IN ARRAY p_items LOOP
        cantidad_total_item := (SELECT COALESCE(SUM(d.cantidad), 0) FROM unnest(item.distribucion) d);
        total_compra := total_compra + (cantidad_total_item * item.costo_unitario);
    END LOOP;
    total_compra_bob := CASE WHEN p_compra.moneda = 'USD' THEN total_compra * p_compra.tasa_cambio ELSE total_compra END;
    IF p_compra.tipo_pago = 'Contado' THEN saldo_final := 0; estado_final := 'Pagada';
    ELSE saldo_final := total_compra - COALESCE(p_compra.abono_inicial, 0);
        IF saldo_final <= 0.005 THEN estado_final := 'Pagada'; saldo_final := 0;
        ELSIF COALESCE(p_compra.abono_inicial, 0) > 0 THEN estado_final := 'Abono Parcial';
        ELSE estado_final := 'Pendiente'; END IF;
    END IF;
    SELECT COALESCE(MAX(substring(folio from 6)::integer), 0) + 1 INTO next_folio_number FROM public.compras WHERE empresa_id = caller_empresa_id;
    v_folio := 'COMP-' || lpad(next_folio_number::text, 5, '0');
    INSERT INTO public.compras (empresa_id, sucursal_id, proveedor_id, usuario_id, folio, fecha, moneda, tasa_cambio, total, total_bob, tipo_pago, estado_pago, saldo_pendiente, n_factura, fecha_vencimiento)
    VALUES (caller_empresa_id, p_compra.sucursal_id, p_compra.proveedor_id, caller_user_id, v_folio, p_compra.fecha, p_compra.moneda, p_compra.tasa_cambio, total_compra, total_compra_bob, p_compra.tipo_pago, estado_final, saldo_final, p_compra.n_factura, p_compra.fecha_vencimiento)
    RETURNING id INTO new_compra_id;
    FOREACH item IN ARRAY p_items LOOP
        cantidad_total_item := (SELECT COALESCE(SUM(d.cantidad), 0) FROM unnest(item.distribucion) d);
        INSERT INTO public.compra_items (compra_id, producto_id, cantidad, costo_unitario) VALUES (new_compra_id, item.producto_id, cantidad_total_item, item.costo_unitario);
        costo_unitario_bob := CASE WHEN p_compra.moneda = 'USD' THEN item.costo_unitario * p_compra.tasa_cambio ELSE item.costo_unitario END;
        SELECT COALESCE(SUM(i.cantidad), 0), p.precio_compra INTO stock_total_actual, capp_actual FROM public.productos p LEFT JOIN public.inventarios i ON p.id = i.producto_id WHERE p.id = item.producto_id GROUP BY p.id;
        capp_actual := COALESCE(capp_actual, 0);
        IF (stock_total_actual + cantidad_total_item) > 0 THEN nuevo_capp := ((stock_total_actual * capp_actual) + (cantidad_total_item * costo_unitario_bob)) / (stock_total_actual + cantidad_total_item); ELSE nuevo_capp := costo_unitario_bob; END IF;
        UPDATE public.productos SET precio_compra = nuevo_capp WHERE id = item.producto_id;
        IF item.precios IS NOT NULL AND array_length(item.precios, 1) > 0 THEN FOREACH price_rule IN ARRAY item.precios LOOP new_price := nuevo_capp + price_rule.ganancia_maxima; INSERT INTO public.precios_productos(producto_id, lista_precio_id, ganancia_maxima, ganancia_minima, precio) VALUES(item.producto_id, price_rule.lista_id, price_rule.ganancia_maxima, price_rule.ganancia_minima, new_price) ON CONFLICT (producto_id, lista_precio_id) DO UPDATE SET ganancia_maxima = EXCLUDED.ganancia_maxima, ganancia_minima = EXCLUDED.ganancia_minima, precio = EXCLUDED.precio, updated_at = now(); END LOOP; END IF;
        FOREACH dist_item IN ARRAY item.distribucion LOOP
            IF dist_item.cantidad > 0 THEN
                DECLARE stock_sucursal_anterior numeric;
                BEGIN
                    SELECT cantidad INTO stock_sucursal_anterior FROM public.inventarios WHERE producto_id = item.producto_id AND sucursal_id = dist_item.sucursal_id;
                    stock_sucursal_anterior := COALESCE(stock_sucursal_anterior, 0);
                    INSERT INTO public.inventarios (producto_id, sucursal_id, cantidad) VALUES (item.producto_id, dist_item.sucursal_id, stock_sucursal_anterior + dist_item.cantidad) ON CONFLICT (producto_id, sucursal_id) DO UPDATE SET cantidad = public.inventarios.cantidad + dist_item.cantidad, updated_at = now();
                    INSERT INTO public.movimientos_inventario (producto_id, sucursal_id, usuario_id, tipo_movimiento, cantidad_ajustada, stock_anterior, stock_nuevo, referencia_id) VALUES (item.producto_id, dist_item.sucursal_id, caller_user_id, 'Compra', dist_item.cantidad, stock_sucursal_anterior, stock_sucursal_anterior + dist_item.cantidad, new_compra_id);
                END;
            END IF;
        END LOOP;
    END LOOP;
    IF p_compra.tipo_pago = 'Contado' THEN INSERT INTO public.pagos_compras (compra_id, monto, metodo_pago) VALUES (new_compra_id, total_compra, 'Contado'); ELSIF p_compra.tipo_pago = 'Crédito' AND COALESCE(p_compra.abono_inicial, 0) > 0 THEN INSERT INTO public.pagos_compras (compra_id, monto, metodo_pago) VALUES (new_compra_id, p_compra.abono_inicial, COALESCE(p_compra.metodo_abono, 'Abono Inicial')); END IF;
    
    SELECT nombre INTO v_proveedor_nombre FROM proveedores WHERE id = p_compra.proveedor_id;
    
    -- **LÓGICA DE NOTIFICACIÓN CORREGIDA**
    -- 1. Recopilar todas las sucursales de destino únicas de todos los items.
    SELECT array_agg(DISTINCT sucursal_id)
    INTO v_destination_branch_ids
    FROM (
        SELECT (d).sucursal_id
        FROM unnest(p_items) as i,
             unnest(i.distribucion) as d
    ) as subquery;

    -- 2. Enviar la notificación a la lista completa de sucursales afectadas.
    PERFORM notificar_cambio(
        'NUEVA_COMPRA', 
        'Ingreso de mercancía de ' || v_proveedor_nombre || ' con folio <b>' || v_folio || '</b>.',
        new_compra_id, 
        v_destination_branch_ids
    );
    
    RETURN new_compra_id;
END;
$$;


DROP FUNCTION IF EXISTS public.registrar_pago_compra(uuid, numeric, text);
CREATE OR REPLACE FUNCTION registrar_pago_compra(p_compra_id uuid, p_monto numeric, p_metodo_pago text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_saldo_actual numeric; v_total numeric; v_nuevo_saldo numeric;
BEGIN SELECT saldo_pendiente, total INTO v_saldo_actual, v_total FROM public.compras WHERE id = p_compra_id; IF v_saldo_actual IS NULL THEN RAISE EXCEPTION 'Compra no encontrada.'; END IF; IF p_monto > v_saldo_actual THEN RAISE EXCEPTION 'El monto del pago no puede ser mayor al saldo pendiente.'; END IF; INSERT INTO public.pagos_compras (compra_id, monto, metodo_pago) VALUES (p_compra_id, p_monto, p_metodo_pago); v_nuevo_saldo := v_saldo_actual - p_monto; UPDATE public.compras SET saldo_pendiente = v_nuevo_saldo, estado_pago = CASE WHEN v_nuevo_saldo <= 0 THEN 'Pagada' ELSE 'Abono Parcial' END WHERE id = p_compra_id; END;
$$;


DROP FUNCTION IF EXISTS public.get_company_products_for_dropdown();
CREATE OR REPLACE FUNCTION get_company_products_for_dropdown()
RETURNS TABLE (id uuid, nombre text, sku text, modelo text, imagen_principal text, stock_sucursal numeric, precio_compra numeric, precio_base numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_empresa_id uuid; caller_sucursal_id uuid;
BEGIN SELECT u.empresa_id, u.sucursal_id INTO caller_empresa_id, caller_sucursal_id FROM public.usuarios u WHERE u.id = auth.uid(); RETURN QUERY SELECT p.id, p.nombre, p.sku, p.modelo, (SELECT img.imagen_url FROM public.imagenes_productos img WHERE img.producto_id = p.id ORDER BY img.orden, img.created_at LIMIT 1) as imagen_principal, COALESCE(i.cantidad, 0) as stock_sucursal, p.precio_compra, COALESCE(pp.precio, 0) as precio_base FROM public.productos p LEFT JOIN public.inventarios i ON p.id = i.producto_id AND i.sucursal_id = caller_sucursal_id LEFT JOIN public.listas_precios lp ON lp.empresa_id = p.empresa_id AND lp.es_predeterminada = true LEFT JOIN public.precios_productos pp ON pp.producto_id = p.id AND pp.lista_precio_id = lp.id WHERE p.empresa_id = caller_empresa_id ORDER BY p.nombre; END;
$$;

-- =============================================================================
-- Fin del script.
-- =============================================================================