-- =============================================================================
-- TRANSFERS (TRASPASOS) MODULE V2 - ASYNCHRONOUS FLOW (FIXED)
-- =============================================================================
-- Este script renueva por completo el módulo de Traspasos para soportar un proceso
-- de "envío" y "recepción" en dos etapas, haciéndolo más auditable y realista.
-- VERSIÓN CORREGIDA: Soluciona el error de sintaxis en RENAME COLUMN y activa
-- las notificaciones en tiempo real para este módulo.
--
-- INSTRUCCIONES:
-- Ejecuta este script completo en tu Editor SQL de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Alterar la tabla `traspasos` para soportar el nuevo flujo (CORREGIDO)
-- -----------------------------------------------------------------------------

-- Renombrar `usuario_id` a `usuario_envio_id` de forma segura
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='traspasos' AND table_schema='public' AND column_name='usuario_id') THEN
        ALTER TABLE public.traspasos RENAME COLUMN usuario_id TO usuario_envio_id;
    END IF;
END $$;


-- Añadir nuevas columnas para la recepción y auditoría
ALTER TABLE public.traspasos ADD COLUMN IF NOT EXISTS fecha_envio timestamptz;
ALTER TABLE public.traspasos ADD COLUMN IF NOT EXISTS usuario_recibio_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.traspasos ADD COLUMN IF NOT EXISTS fecha_recibido timestamptz;

-- Renombrar la columna `estado` a `estado_traspaso` para evitar ambigüedad (opcional pero recomendado)
-- DO $$
-- BEGIN
--     IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='traspasos' AND table_schema='public' AND column_name='estado') THEN
--         ALTER TABLE public.traspasos RENAME COLUMN estado TO estado_traspaso;
--     END IF;
-- END $$;
-- NOTA: Se mantiene 'estado' por ahora para no romper el frontend existente. Se cambiará en un futuro refactor.


-- Retro-compatibilidad: Actualizar traspasos antiguos al nuevo modelo
-- Asumimos que los traspasos 'Completado' se recibieron instantáneamente por el mismo usuario.
UPDATE public.traspasos
SET 
    estado = 'Recibido',
    fecha_envio = fecha,
    usuario_recibio_id = usuario_envio_id,
    fecha_recibido = fecha
WHERE estado = 'Completado';

-- Cambiar el valor por defecto de la columna 'estado' a 'En Camino'
ALTER TABLE public.traspasos ALTER COLUMN estado SET DEFAULT 'En Camino';

-- -----------------------------------------------------------------------------
-- Paso 2: Actualizar la función `registrar_traspaso` para gestionar solo el envío
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.registrar_traspaso(uuid, uuid, timestamptz, text, traspaso_item_input[]);
CREATE OR REPLACE FUNCTION registrar_traspaso(
    p_origen_id uuid,
    p_destino_id uuid,
    p_fecha timestamptz,
    p_notas text,
    p_items traspaso_item_input[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    caller_user_id uuid := auth.uid();
    caller_rol text := (SELECT u.rol FROM public.usuarios u WHERE u.id = caller_user_id);
    new_traspaso_id uuid;
    item traspaso_item_input;
    next_folio_number integer;
    stock_origen_actual numeric;
    v_folio text;
    v_origen_nombre text;
    v_destino_nombre text;
BEGIN
    -- 1. Validar permisos
    IF caller_rol NOT IN ('Propietario', 'Administrador') THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de Propietario o Administrador.';
    END IF;

    -- 2. Generar folio
    SELECT COALESCE(MAX(substring(folio from 7)::integer), 0) + 1 INTO next_folio_number 
    FROM public.traspasos WHERE empresa_id = caller_empresa_id;
    
    v_folio := 'TRASP-' || lpad(next_folio_number::text, 5, '0');

    -- 3. Insertar cabecera con estado 'En Camino' e información de envío
    INSERT INTO public.traspasos (
        empresa_id, sucursal_origen_id, sucursal_destino_id, usuario_envio_id,
        folio, fecha, notas, estado, fecha_envio
    ) VALUES (
        caller_empresa_id, p_origen_id, p_destino_id, caller_user_id,
        v_folio,
        p_fecha, p_notas, 'En Camino', now()
    ) RETURNING id INTO new_traspaso_id;

    -- 4. Procesar cada ítem: validar stock, insertar, y actualizar inventario de origen
    FOREACH item IN ARRAY p_items LOOP
        SELECT cantidad INTO stock_origen_actual 
        FROM inventarios WHERE producto_id = item.producto_id AND sucursal_id = p_origen_id;
        
        stock_origen_actual := COALESCE(stock_origen_actual, 0);

        IF stock_origen_actual < item.cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente para el producto %.', (SELECT nombre FROM productos WHERE id = item.producto_id);
        END IF;

        INSERT INTO public.traspaso_items (traspaso_id, producto_id, cantidad)
        VALUES (new_traspaso_id, item.producto_id, item.cantidad);

        UPDATE public.inventarios SET cantidad = cantidad - item.cantidad, updated_at = now()
        WHERE producto_id = item.producto_id AND sucursal_id = p_origen_id;
        
        INSERT INTO public.movimientos_inventario (producto_id, sucursal_id, usuario_id, tipo_movimiento, cantidad_ajustada, stock_anterior, stock_nuevo, referencia_id)
        VALUES (item.producto_id, p_origen_id, caller_user_id, 'Salida por Traspaso', -item.cantidad, stock_origen_actual, stock_origen_actual - item.cantidad, new_traspaso_id);
    END LOOP;

    -- 5. **NUEVO: Generar notificación inteligente**
    SELECT nombre INTO v_origen_nombre FROM sucursales WHERE id = p_origen_id;
    SELECT nombre INTO v_destino_nombre FROM sucursales WHERE id = p_destino_id;
    PERFORM notificar_cambio(
        'TRASPASO_ENVIADO', 
        'Traspaso <b>' || v_folio || '</b> enviado desde ' || v_origen_nombre || ' hacia <b>' || v_destino_nombre || '</b>.',
        new_traspaso_id
    );
    
    RETURN new_traspaso_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- Paso 3: Crear la NUEVA función `confirmar_recepcion_traspaso`
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION confirmar_recepcion_traspaso(p_traspaso_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_user_id uuid := auth.uid();
    caller_sucursal_id uuid := (SELECT u.sucursal_id FROM public.usuarios u WHERE u.id = caller_user_id);
    traspaso_rec record;
    item_rec record;
    stock_destino_actual numeric;
    v_origen_nombre text;
    v_destino_nombre text;
BEGIN
    -- 1. Obtener traspaso y validar permisos
    SELECT * INTO traspaso_rec FROM public.traspasos WHERE id = p_traspaso_id;

    IF traspaso_rec IS NULL THEN
        RAISE EXCEPTION 'Traspaso no encontrado.';
    END IF;
    
    IF traspaso_rec.sucursal_destino_id != caller_sucursal_id THEN
        RAISE EXCEPTION 'Acceso denegado: No perteneces a la sucursal de destino.';
    END IF;

    IF traspaso_rec.estado != 'En Camino' THEN
        RAISE EXCEPTION 'Este traspaso no está "En Camino" y no puede ser recibido.';
    END IF;

    -- 2. Actualizar cabecera a 'Recibido'
    UPDATE public.traspasos
    SET 
        estado = 'Recibido',
        usuario_recibio_id = caller_user_id,
        fecha_recibido = now()
    WHERE id = p_traspaso_id;

    -- 3. Procesar cada ítem: actualizar inventario de destino
    FOR item_rec IN SELECT * FROM public.traspaso_items WHERE traspaso_id = p_traspaso_id
    LOOP
        SELECT cantidad INTO stock_destino_actual FROM inventarios WHERE producto_id = item_rec.producto_id AND sucursal_id = traspaso_rec.sucursal_destino_id;
        stock_destino_actual := COALESCE(stock_destino_actual, 0);

        INSERT INTO public.inventarios (producto_id, sucursal_id, cantidad)
        VALUES (item_rec.producto_id, traspaso_rec.sucursal_destino_id, item_rec.cantidad)
        ON CONFLICT (producto_id, sucursal_id) DO UPDATE SET
            cantidad = inventarios.cantidad + item_rec.cantidad,
            updated_at = now();

        INSERT INTO public.movimientos_inventario (producto_id, sucursal_id, usuario_id, tipo_movimiento, cantidad_ajustada, stock_anterior, stock_nuevo, referencia_id)
        VALUES (item_rec.producto_id, traspaso_rec.sucursal_destino_id, caller_user_id, 'Entrada por Traspaso', item_rec.cantidad, stock_destino_actual, stock_destino_actual + item_rec.cantidad, p_traspaso_id);
    END LOOP;

    -- 4. **NUEVO: Generar notificación inteligente**
    SELECT nombre INTO v_origen_nombre FROM sucursales WHERE id = traspaso_rec.sucursal_origen_id;
    SELECT nombre INTO v_destino_nombre FROM sucursales WHERE id = traspaso_rec.sucursal_destino_id;
    PERFORM notificar_cambio(
        'TRASPASO_RECIBIDO', 
        'El traspaso <b>' || traspaso_rec.folio || '</b> desde ' || v_origen_nombre || ' ha sido <b>recibido</b> en ' || v_destino_nombre || '.',
        p_traspaso_id
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- Paso 4: Actualizar funciones de obtención de datos
-- -----------------------------------------------------------------------------

-- `get_traspasos_data` para incluir el nuevo `estado`
CREATE OR REPLACE FUNCTION get_traspasos_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    traspasos_list json;
    kpis json;
    start_of_month date := date_trunc('month', current_date);
BEGIN
    SELECT json_agg(t_info) INTO traspasos_list FROM (
        SELECT 
            t.id, t.folio, t.fecha, t.estado, t.sucursal_destino_id,
            s_origen.nombre as origen_nombre,
            s_destino.nombre as destino_nombre,
            u.nombre_completo as usuario_nombre,
            (SELECT COUNT(*) FROM traspaso_items ti WHERE ti.traspaso_id = t.id) as total_items
        FROM traspasos t
        JOIN sucursales s_origen ON t.sucursal_origen_id = s_origen.id
        JOIN sucursales s_destino ON t.sucursal_destino_id = s_destino.id
        JOIN usuarios u ON t.usuario_envio_id = u.id
        WHERE t.empresa_id = caller_empresa_id
        ORDER BY t.fecha DESC
    ) t_info;

    SELECT json_build_object(
        'traspasos_this_month', (SELECT COUNT(*) FROM traspasos WHERE empresa_id = caller_empresa_id AND fecha >= start_of_month),
        'total_productos_movidos', (SELECT COALESCE(SUM(cantidad), 0) FROM traspaso_items ti JOIN traspasos t ON ti.traspaso_id = t.id WHERE t.empresa_id = caller_empresa_id),
        'producto_mas_traspasado', (SELECT p.nombre FROM traspaso_items ti JOIN productos p ON ti.producto_id = p.id JOIN traspasos t ON ti.traspaso_id = t.id WHERE t.empresa_id = caller_empresa_id GROUP BY p.nombre ORDER BY SUM(ti.cantidad) DESC LIMIT 1)
    ) INTO kpis;

    RETURN json_build_object('traspasos', COALESCE(traspasos_list, '[]'::json), 'kpis', kpis);
END;
$$;


-- `get_traspaso_details` para incluir todos los campos de auditoría
CREATE OR REPLACE FUNCTION get_traspaso_details(p_traspaso_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    traspaso_details jsonb;
    items_list json;
BEGIN
    SELECT to_jsonb(t) || jsonb_build_object(
        'origen_nombre', s_origen.nombre,
        'destino_nombre', s_destino.nombre,
        'usuario_envio_nombre', u_envio.nombre_completo,
        'usuario_recibio_nombre', u_recibio.nombre_completo
    ) INTO traspaso_details
    FROM traspasos t
    JOIN sucursales s_origen ON t.sucursal_origen_id = s_origen.id
    JOIN sucursales s_destino ON t.sucursal_destino_id = s_destino.id
    JOIN usuarios u_envio ON t.usuario_envio_id = u_envio.id
    LEFT JOIN usuarios u_recibio ON t.usuario_recibio_id = u_recibio.id
    WHERE t.id = p_traspaso_id AND t.empresa_id = public.get_empresa_id_from_jwt();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Traspaso no encontrado o no pertenece a tu empresa.';
    END IF;

    SELECT json_agg(i) INTO items_list
    FROM (
        SELECT ti.cantidad, p.nombre as producto_nombre
        FROM traspaso_items ti
        JOIN productos p ON ti.producto_id = p.id
        WHERE ti.traspaso_id = p_traspaso_id
    ) i;
    
    RETURN traspaso_details || jsonb_build_object('items', COALESCE(items_list, '[]'::json));
END;
$$;


-- -----------------------------------------------------------------------------
-- Paso 5: Políticas de Seguridad a Nivel de Fila (RLS) - ¡LA SOLUCIÓN!
-- -----------------------------------------------------------------------------
-- Se añaden las políticas RLS que faltaban para que el servicio de Realtime
-- pueda validar los permisos y retransmitir las notificaciones.
ALTER TABLE public.traspasos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.traspasos;
CREATE POLICY "Enable all for own company" ON public.traspasos
FOR ALL USING (
    empresa_id = public.get_empresa_id_from_jwt()
);

ALTER TABLE public.traspaso_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.traspaso_items;
CREATE POLICY "Enable all for own company" ON public.traspaso_items
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.traspasos t
        WHERE t.id = traspaso_id AND t.empresa_id = public.get_empresa_id_from_jwt()
    )
);


-- -----------------------------------------------------------------------------
-- Paso 6: Publicación de Realtime (CORREGIDO)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.traspasos;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "traspasos" ya está en la publicación.';
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.traspaso_items;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "traspaso_items" ya está en la publicación.';
END;
$$;

-- **INCLUSIÓN CRÍTICA PARA ACTUALIZACIONES DE STOCK**
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventarios;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "inventarios" ya está en la publicación.';
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.movimientos_inventario;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "movimientos_inventario" ya está en la publicación.';
END;
$$;


-- =============================================================================
-- Fin del script.
-- =============================================================================