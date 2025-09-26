-- =============================================================================
-- DATABASE FIX SCRIPT: Resolve Price Function Ambiguity
-- =============================================================================
-- Este script soluciona el error "Could not choose the best candidate function"
-- que ocurre al guardar los precios de un producto.
--
-- **PROBLEMA:**
-- Un script de migración anterior no eliminó correctamente una versión antigua
-- de la función `update_product_prices`. Esto dejó dos funciones con el mismo
-- nombre pero diferentes tipos de argumentos (`price_update[]` vs `price_rule_input[]`),
-- causando una ambigüedad que la base de datos no puede resolver.
--
-- **SOLUCIÓN:**
-- Este script elimina de forma segura la función y el tipo de dato obsoletos,
-- dejando únicamente la versión correcta y resolviendo el conflicto.
--
-- **INSTRUCCIONES:**
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- Es seguro ejecutarlo varias veces.
-- =============================================================================

DO $$
BEGIN

-- -----------------------------------------------------------------------------
-- Paso 1: Eliminar la función obsoleta que usa el tipo `price_update[]`
-- -----------------------------------------------------------------------------
-- Es crucial especificar los tipos de argumento para eliminar la sobrecarga correcta.
DROP FUNCTION IF EXISTS public.update_product_prices(uuid, public.price_update[]);
RAISE NOTICE 'Paso 1/2: Función obsoleta "update_product_prices(uuid, price_update[])" eliminada si existía.';

-- -----------------------------------------------------------------------------
-- Paso 2: Eliminar el tipo de dato obsoleto `price_update`
-- -----------------------------------------------------------------------------
-- Se usa CASCADE para eliminar cualquier dependencia residual que pueda existir.
DROP TYPE IF EXISTS public.price_update CASCADE;
RAISE NOTICE 'Paso 2/2: Tipo obsoleto "price_update" eliminado si existía.';

END $$;
-- =============================================================================
-- Fin del script. El error al guardar precios debería estar resuelto.
-- =============================================================================
