-- =============================================================================
-- REALTIME DATA CLEANUP SCRIPT (V4)
-- =============================================================================
-- Este script ELIMINA la implementación anterior de notificaciones en tiempo
-- real que utilizaba `pg_notify` y el sistema de Broadcast de Supabase.
--
-- MOTIVO:
-- La nueva arquitectura utilizará el sistema de `postgres_changes` de Supabase,
-- que es más simple, directo y robusto. El frontend se suscribirá directamente
-- a los cambios en las tablas, eliminando la necesidad de triggers y funciones
-- de notificación manuales en la base de datos.
--
-- INSTRUCCIONES:
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase para
-- limpiar la implementación anterior y evitar conflictos.
-- =============================================================================

DO $$
BEGIN

-- -----------------------------------------------------------------------------
-- Paso 1: Eliminar los triggers de las tres tablas
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_data_change_notify ON public.inventarios;
RAISE NOTICE 'Trigger de tiempo real eliminado de la tabla "inventarios".';

DROP TRIGGER IF EXISTS on_data_change_notify ON public.productos;
RAISE NOTICE 'Trigger de tiempo real eliminado de la tabla "productos".';

DROP TRIGGER IF EXISTS on_data_change_notify ON public.precios_productos;
RAISE NOTICE 'Trigger de tiempo real eliminado de la tabla "precios_productos".';

-- -----------------------------------------------------------------------------
-- Paso 2: Eliminar la función de notificación genérica
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.broadcast_data_change();
RAISE NOTICE 'Función de notificación "broadcast_data_change" eliminada.';

END;
$$;


-- =============================================================================
-- Fin del script de limpieza. La base de datos está lista para la nueva
-- implementación de tiempo real basada en `postgres_changes`.
-- =============================================================================