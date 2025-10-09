-- =============================================================================
-- SALES (VENTAS) MODULE - DATABASE SETUP
-- =============================================================================
-- Este script crea toda la estructura de base de datos y la lógica de negocio
-- para el módulo de Ventas, incluyendo el registro de transacciones, el
-- descuento de inventario, y la gestión de cuentas por cobrar.
--
-- **INSTRUCCIONES:**
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Creación de Tablas
-- -----------------------------------------------------------------------------

-- Tabla de Ventas (Cabecera)
CREATE TABLE IF NOT EXISTS public.ventas (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    sucursal_id uuid NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
    cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
    usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    folio text NOT NULL,
    fecha timestamptz DEFAULT now() NOT NULL,
    total numeric(10, 2) NOT NULL,
    subtotal numeric(10, 2) NOT NULL,
    descuento numeric(10, 2) DEFAULT 0 NOT NULL,
    impuestos numeric(10, 2) DEFAULT 0 NOT NULL,
    metodo_pago text NOT NULL,
    tipo_venta text NOT NULL, -- 'Contado' o 'Crédito'
    estado_pago text NOT NULL, -- 'Pagada', 'Pendiente', 'Abono Parcial'
    saldo_pendiente numeric(10, 2) DEFAULT 0 NOT NULL,
    fecha_vencimiento date,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ventas_folio_empresa_id_key UNIQUE (folio, empresa_id)
);
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;


-- Tabla de Items de Venta (Detalle)
CREATE TABLE IF NOT EXISTS public.venta_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    venta_id uuid NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
    producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
    cantidad numeric(10, 2) NOT NULL,
    precio_unitario_aplicado numeric(10, 2) NOT NULL,
    costo_unitario_en_venta numeric(10, 2) NOT NULL
);
ALTER TABLE public.venta_items ENABLE ROW LEVEL SECURITY;


-- Tabla de Pagos de Ventas (Abonos)
CREATE TABLE IF NOT EXISTS public.pagos_ventas (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    venta_id uuid NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
    fecha_pago timestamptz DEFAULT now() NOT NULL,
    monto numeric(10, 2) NOT NULL,
    metodo_pago text
);
ALTER TABLE public.pagos_ventas ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- Paso 2: Políticas de Seguridad a Nivel de Fila (RLS)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable all for own company" ON public.ventas;
CREATE POLICY "Enable all for own company" ON public.ventas FOR ALL USING (empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Enable all for own company" ON public.venta_items;
CREATE POLICY "Enable all for own company" ON public.venta_items FOR ALL USING (venta_id IN (SELECT id FROM public.ventas WHERE empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())));

DROP POLICY IF EXISTS "Enable all for own company" ON public.pagos_ventas;
CREATE POLICY "Enable all for own company" ON public.pagos_ventas FOR ALL USING (venta_id IN (SELECT id FROM public.ventas WHERE empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())));


-- -----------------------------------------------------------------------------
-- Paso 3: Funciones RPC (Lógica de Negocio)
-- -----------------------------------------------------------------------------

-- Tipos de datos para la función de registrar venta
DROP TYPE IF EXISTS public.venta_item_input CASCADE;
CREATE TYPE public.venta_item_input AS (
    producto_id uuid,
    cantidad numeric,
    precio_unitario_aplicado numeric,
    costo_unitario_en_venta numeric
);

DROP TYPE IF EXISTS public.venta_input CASCADE;
CREATE TYPE public.venta_input AS (
    cliente_id uuid,
    sucursal_id uuid,
    total numeric,
    subtotal numeric,
    descuento numeric,
    impuestos numeric,
    metodo_pago text,
    tipo_venta text,
    abono_inicial numeric,
    fecha_vencimiento date
);

-- Función principal para registrar una venta
CREATE OR REPLACE FUNCTION registrar_venta(p_venta venta_input, p_items venta_item_input[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid());
    caller_user_id uuid := auth.uid();
    new_venta_id uuid;
    item venta_item_input;
    saldo_final numeric;
    estado_final text;
    next_folio_number integer;
    stock_sucursal_anterior numeric;
    v_folio text;
    v_cliente_nombre text;
BEGIN
    -- 1. Calcular saldo y estado del pago
    IF p_venta.tipo_venta = 'Contado' THEN
        saldo_final := 0;
        estado_final := 'Pagada';
    ELSE -- Crédito
        saldo_final := p_venta.total - COALESCE(p_venta.abono_inicial, 0);
        IF saldo_final <= 0.005 THEN
            estado_final := 'Pagada';
            saldo_final := 0;
        ELSIF COALESCE(p_venta.abono_inicial, 0) > 0 THEN
            estado_final := 'Abono Parcial';
        ELSE
            estado_final := 'Pendiente';
        END IF;
    END IF;
    
    -- 2. Calcular el siguiente número de folio para la empresa
    SELECT COALESCE(MAX(substring(folio from 7)::integer), 0) + 1 
    INTO next_folio_number 
    FROM public.ventas 
    WHERE empresa_id = caller_empresa_id;

    v_folio := 'VENTA-' || lpad(next_folio_number::text, 5, '0');

    -- 3. Insertar la cabecera de la venta
    INSERT INTO public.ventas (
        empresa_id, sucursal_id, cliente_id, usuario_id, folio, total, subtotal, descuento, impuestos,
        metodo_pago, tipo_venta, estado_pago, saldo_pendiente, fecha_vencimiento
    ) VALUES (
        caller_empresa_id, p_venta.sucursal_id, p_venta.cliente_id, caller_user_id,
        v_folio,
        p_venta.total, p_venta.subtotal, p_venta.descuento, p_venta.impuestos,
        p_venta.metodo_pago, p_venta.tipo_venta, estado_final, saldo_final, p_venta.fecha_vencimiento
    ) RETURNING id INTO new_venta_id;

    -- 4. Procesar cada ítem de la venta
    FOREACH item IN ARRAY p_items LOOP
        INSERT INTO public.venta_items (venta_id, producto_id, cantidad, precio_unitario_aplicado, costo_unitario_en_venta)
        VALUES (new_venta_id, item.producto_id, item.cantidad, item.precio_unitario_aplicado, item.costo_unitario_en_venta);

        -- Descontar del inventario
        SELECT cantidad INTO stock_sucursal_anterior FROM public.inventarios WHERE producto_id = item.producto_id AND sucursal_id = p_venta.sucursal_id;
        stock_sucursal_anterior := COALESCE(stock_sucursal_anterior, 0);

        UPDATE public.inventarios
        SET cantidad = cantidad - item.cantidad, updated_at = now()
        WHERE producto_id = item.producto_id AND sucursal_id = p_venta.sucursal_id;

        -- Registrar movimiento de inventario
        INSERT INTO public.movimientos_inventario (
            producto_id, sucursal_id, usuario_id, tipo_movimiento,
            cantidad_ajustada, stock_anterior, stock_nuevo, referencia_id
        ) VALUES (
            item.producto_id, p_venta.sucursal_id, caller_user_id, 'Venta',
            -item.cantidad, stock_sucursal_anterior, stock_sucursal_anterior - item.cantidad, new_venta_id
        );
    END LOOP;

    -- 5. Actualizar saldo del cliente si es a crédito
    IF p_venta.tipo_venta = 'Crédito' AND p_venta.cliente_id IS NOT NULL THEN
        UPDATE public.clientes
        SET saldo_pendiente = saldo_pendiente + saldo_final
        WHERE id = p_venta.cliente_id;
    END IF;

    -- 6. Registrar pago si es al contado o hay abono inicial
    IF p_venta.tipo_venta = 'Contado' THEN
        INSERT INTO public.pagos_ventas (venta_id, monto, metodo_pago)
        VALUES (new_venta_id, p_venta.total, p_venta.metodo_pago);
    ELSIF p_venta.tipo_venta = 'Crédito' AND COALESCE(p_venta.abono_inicial, 0) > 0 THEN
        INSERT INTO public.pagos_ventas (venta_id, monto, metodo_pago)
        VALUES (new_venta_id, p_venta.abono_inicial, p_venta.metodo_pago);
    END IF;

    -- 7. **NUEVO: Generar notificación inteligente**
    SELECT nombre INTO v_cliente_nombre FROM clientes WHERE id = p_venta.cliente_id;
    PERFORM notificar_cambio(
        'NUEVA_VENTA', 
        'Venta <b>' || v_folio || '</b> a ' || COALESCE(v_cliente_nombre, 'Consumidor Final') || ' por <b>Bs ' || p_venta.total::text || '</b>',
        new_venta_id
    );

    RETURN new_venta_id;
END;
$$;


-- Función para obtener la lista de ventas (ACTUALIZADA para filtros avanzados)
DROP FUNCTION IF EXISTS public.get_company_sales();
CREATE OR REPLACE FUNCTION get_company_sales()
RETURNS TABLE (
    id uuid,
    folio text,
    cliente_id uuid,
    cliente_nombre text,
    usuario_id uuid,
    usuario_nombre text,
    sucursal_id uuid,
    sucursal_nombre text,
    fecha timestamptz,
    total numeric,
    estado_pago text,
    saldo_pendiente numeric,
    tipo_venta text,
    metodo_pago text,
    impuestos numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id, 
        v.folio, 
        v.cliente_id,
        c.nombre AS cliente_nombre,
        v.usuario_id,
        u.nombre_completo AS usuario_nombre,
        v.sucursal_id,
        s.nombre AS sucursal_nombre,
        v.fecha, 
        v.total, 
        v.estado_pago, 
        v.saldo_pendiente, 
        v.tipo_venta,
        v.metodo_pago,
        v.impuestos
    FROM public.ventas v
    LEFT JOIN public.clientes c ON v.cliente_id = c.id
    LEFT JOIN public.usuarios u ON v.usuario_id = u.id
    LEFT JOIN public.sucursales s ON v.sucursal_id = s.id
    WHERE v.empresa_id = (SELECT usr.empresa_id FROM public.usuarios usr WHERE usr.id = auth.uid())
    ORDER BY v.created_at DESC;
END;
$$;


-- Función para obtener el detalle de una venta
CREATE OR REPLACE FUNCTION get_sale_details(p_venta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sale_details jsonb;
    items_list json;
    payments_list json;
BEGIN
    SELECT to_jsonb(v) || jsonb_build_object('cliente_nombre', c.nombre, 'usuario_nombre', u.nombre_completo) 
    INTO sale_details
    FROM public.ventas v
    LEFT JOIN public.clientes c ON v.cliente_id = c.id
    LEFT JOIN public.usuarios u ON v.usuario_id = u.id
    WHERE v.id = p_venta_id
    AND v.empresa_id = (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid());

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venta no encontrada o no pertenece a tu empresa.';
    END IF;
    
    SELECT json_agg(i) INTO items_list
    FROM (
        SELECT vi.*, p.nombre as producto_nombre 
        FROM public.venta_items vi 
        JOIN public.productos p ON vi.producto_id = p.id 
        WHERE vi.venta_id = p_venta_id
    ) i;

    SELECT json_agg(p) INTO payments_list
    FROM (SELECT * FROM public.pagos_ventas WHERE venta_id = p_venta_id ORDER BY fecha_pago) p;

    RETURN sale_details || jsonb_build_object(
        'items', COALESCE(items_list, '[]'::json),
        'pagos', COALESCE(payments_list, '[]'::json)
    );
END;
$$;


-- Función para registrar un pago (abono) a una venta
CREATE OR REPLACE FUNCTION registrar_pago_venta(p_venta_id uuid, p_monto numeric, p_metodo_pago text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_venta public.ventas;
    v_nuevo_saldo numeric;
BEGIN
    -- Obtener detalles de la venta y bloquear la fila para la transacción
    SELECT * INTO v_venta FROM public.ventas WHERE id = p_venta_id FOR UPDATE;

    IF v_venta IS NULL THEN
        RAISE EXCEPTION 'Venta no encontrada.';
    END IF;
    IF p_monto <= 0 THEN
        RAISE EXCEPTION 'El monto del pago debe ser positivo.';
    END IF;
    IF p_monto > v_venta.saldo_pendiente THEN
        RAISE EXCEPTION 'El monto del pago no puede ser mayor al saldo pendiente.';
    END IF;

    -- 1. Insertar el registro del pago
    INSERT INTO public.pagos_ventas (venta_id, monto, metodo_pago)
    VALUES (p_venta_id, p_monto, p_metodo_pago);

    -- 2. Actualizar el saldo y estado de la venta
    v_nuevo_saldo := v_venta.saldo_pendiente - p_monto;
    UPDATE public.ventas
    SET
        saldo_pendiente = v_nuevo_saldo,
        estado_pago = CASE
            WHEN v_nuevo_saldo <= 0.005 THEN 'Pagada'
            ELSE 'Abono Parcial'
        END
    WHERE id = p_venta_id;

    -- 3. Actualizar el saldo pendiente total del cliente
    IF v_venta.cliente_id IS NOT NULL THEN
        UPDATE public.clientes
        SET saldo_pendiente = saldo_pendiente - p_monto
        WHERE id = v_venta.cliente_id;
    END IF;
END;
$$;

-- **NUEVO:** Función para obtener los datos para los filtros de ventas
CREATE OR REPLACE FUNCTION get_sales_filter_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid());
    clients_list json;
    users_list json;
    branches_list json;
BEGIN
    SELECT json_agg(c) INTO clients_list FROM (
        SELECT id, nombre FROM public.clientes WHERE empresa_id = caller_empresa_id ORDER BY nombre
    ) c;

    SELECT json_agg(u) INTO users_list FROM (
        SELECT id, nombre_completo FROM public.usuarios WHERE empresa_id = caller_empresa_id ORDER BY nombre_completo
    ) u;
    
    SELECT json_agg(s) INTO branches_list FROM (
        SELECT id, nombre FROM public.sucursales WHERE empresa_id = caller_empresa_id ORDER BY nombre
    ) s;

    RETURN json_build_object(
        'clients', COALESCE(clients_list, '[]'::json),
        'users', COALESCE(users_list, '[]'::json),
        'branches', COALESCE(branches_list, '[]'::json)
    );
END;
$$;

-- =============================================================================
-- Fin del script.
-- =============================================================================