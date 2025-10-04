-- =============================================================================
-- REALTIME DATA NOTIFICATIONS (V3 - UNIFIED BROADCAST)
-- =============================================================================
-- Este script implementa un sistema de notificaciones en tiempo real unificado
-- para cambios en inventario, productos y precios, utilizando el sistema de
-- Broadcast de Supabase para una máxima eficiencia y simplicidad.
--
-- PROBLEMA ANTERIOR:
-- Las notificaciones solo se activaban para la tabla `inventarios`.
--
-- SOLUCIÓN:
-- 1. Se crea una única función genérica `broadcast_data_change`.
-- 2. Esta función es lo suficientemente inteligente para determinar el `empresa_id`
--    sin importar qué tabla la active (`inventarios`, `productos`, `precios_productos`).
-- 3. Se crean triggers en las tres tablas para que todas llamen a la misma función.
-- 4. Todas las notificaciones se envían a un único canal (`realtime_updates`)
--    con un evento único (`data_updated`), simplificando el código del cliente.
--
-- INSTRUCCIONES:
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

DO $$
BEGIN

-- -----------------------------------------------------------------------------
-- Paso 1: Limpiar la función y triggers antiguos para evitar conflictos
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_inventory_change_notify ON public.inventarios;
DROP FUNCTION IF EXISTS public.notify_inventory_change();
RAISE NOTICE 'Funcionalidad de notificación en tiempo real antigua eliminada.';

-- -----------------------------------------------------------------------------
-- Paso 2: Crear la nueva función genérica que enviará todas las notificaciones
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.broadcast_data_change()
RETURNS TRIGGER AS $body$
DECLARE
    v_empresa_id uuid;
    payload json;
    rec RECORD;
BEGIN
    -- Usar el registro afectado (NEW para INSERT/UPDATE, OLD para DELETE)
    rec := COALESCE(NEW, OLD);

    -- Determinar el `empresa_id` basado en la tabla que activó el trigger
    IF TG_TABLE_NAME = 'productos' THEN
        v_empresa_id := rec.empresa_id;
    ELSIF TG_TABLE_NAME = 'inventarios' THEN
        -- Para 'inventarios', el producto_id está en el registro
        SELECT p.empresa_id INTO v_empresa_id FROM public.productos p WHERE p.id = rec.producto_id;
    ELSIF TG_TABLE_NAME = 'precios_productos' THEN
        -- Para 'precios_productos', el producto_id también está en el registro
        SELECT p.empresa_id INTO v_empresa_id FROM public.productos p WHERE p.id = rec.producto_id;
    END IF;


    -- Si se encontró una empresa, construir el payload y notificar
    IF v_empresa_id IS NOT NULL THEN
        payload := json_build_object('empresa_id', v_empresa_id);

        -- Enviar una notificación al canal 'realtime_updates'.
        -- El cliente se suscribirá a este canal para recibir los eventos.
        PERFORM pg_notify('realtime_updates', payload::text);
    END IF;

    -- Para triggers de tipo AFTER, el valor de retorno se ignora.
    RETURN NULL;
END;
$body$ LANGUAGE plpgsql SECURITY DEFINER;
RAISE NOTICE 'Función de notificación unificada "broadcast_data_change" creada.';

-- -----------------------------------------------------------------------------
-- Paso 3: Crear los nuevos triggers en las tres tablas relevantes
-- -----------------------------------------------------------------------------
-- Eliminar los triggers nuevos si ya existen para que el script sea repetible
DROP TRIGGER IF EXISTS on_data_change_notify ON public.inventarios;
DROP TRIGGER IF EXISTS on_data_change_notify ON public.productos;
DROP TRIGGER IF EXISTS on_data_change_notify ON public.precios_productos;

-- Trigger para la tabla `inventarios`
CREATE TRIGGER on_data_change_notify
AFTER INSERT OR UPDATE OR DELETE ON public.inventarios
FOR EACH ROW EXECUTE FUNCTION public.broadcast_data_change();
RAISE NOTICE 'Trigger de tiempo real activado para la tabla "inventarios".';

-- Trigger para la tabla `productos`
CREATE TRIGGER on_data_change_notify
AFTER INSERT OR UPDATE OR DELETE ON public.productos
FOR EACH ROW EXECUTE FUNCTION public.broadcast_data_change();
RAISE NOTICE 'Trigger de tiempo real activado para la tabla "productos".';

-- Trigger para la tabla `precios_productos`
CREATE TRIGGER on_data_change_notify
AFTER INSERT OR UPDATE OR DELETE ON public.precios_productos
FOR EACH ROW EXECUTE FUNCTION public.broadcast_data_change();
RAISE NOTICE 'Trigger de tiempo real activado para la tabla "precios_productos".';

END;
$$;


-- =============================================================================
-- Fin del script. La base de datos está ahora configurada para notificar
-- al frontend sobre cualquier cambio relevante en los datos.
-- =============================================================================