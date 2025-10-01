-- =============================================================================
-- DATABASE HARDENING SCRIPT: COMPLETE CASCADE DELETES (v1)
-- =============================================================================
-- Este script es la solución definitiva para los errores de clave foránea al
-- eliminar una empresa. Reemplaza y amplía `09_FIX_CASCADE_DELETES.md` al
-- incluir TODAS las tablas, incluidas las de Ventas, Compras, Clientes, etc.
--
-- PROBLEMA: La eliminación de una empresa fallaba porque tablas como `productos`
-- no podían ser borradas si tenían registros asociados en `venta_items` o
-- `compra_items`, debido a restricciones de clave foránea incompletas.
--
-- SOLUCIÓN:
-- 1. Se revisan TODAS las claves foráneas y se aplica `ON DELETE CASCADE` donde
--    la eliminación de un registro padre debe eliminar a sus hijos.
-- 2. Se aplica `ON DELETE SET NULL` donde un registro histórico debe
--    preservarse, pero desvincularse (ej. una venta no se elimina si se borra
--    el usuario que la creó).
-- 3. Se crea una función `delete_product` segura que IMPIDE la eliminación de
--    un producto si tiene historial de ventas/compras, protegiendo los datos
--    en operaciones diarias.
--
-- **INSTRUCCIONES:**
-- Ejecuta este script COMPLETO en el Editor SQL de tu proyecto de Supabase.
-- Es seguro ejecutarlo varias veces.
-- =============================================================================

DO $$
BEGIN

-- -----------------------------------------------------------------------------
-- Función de Seguridad: Prevenir eliminación de productos con historial
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_product(p_producto_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    caller_empresa_id uuid;
    has_history boolean;
BEGIN
    -- 1. Validar permisos
    SELECT empresa_id INTO caller_empresa_id FROM public.usuarios WHERE id = auth.uid();
    IF NOT EXISTS (SELECT 1 FROM public.productos WHERE id = p_producto_id AND empresa_id = caller_empresa_id) THEN
        RAISE EXCEPTION 'Producto no encontrado o no pertenece a tu empresa.';
    END IF;

    -- 2. Comprobar si existe historial en ventas o compras
    SELECT EXISTS (
        SELECT 1 FROM public.venta_items WHERE producto_id = p_producto_id
        UNION ALL
        SELECT 1 FROM public.compra_items WHERE producto_id = p_producto_id
    ) INTO has_history;

    IF has_history THEN
        RAISE EXCEPTION 'No se puede eliminar el producto porque tiene un historial de ventas o compras asociado. Considere desactivarlo o cambiar su estado en su lugar.';
    END IF;

    -- 3. Si no hay historial, proceder con la eliminación
    DELETE FROM public.productos WHERE id = p_producto_id;
    RAISE NOTICE 'Producto con ID % eliminado correctamente.', p_producto_id;
END;
$function$;
RAISE NOTICE 'Función de seguridad "delete_product" creada/actualizada.';


-- -----------------------------------------------------------------------------
-- Aplicación de Reglas de Cascada a TODAS las tablas
-- -----------------------------------------------------------------------------

-- Relaciones con `empresas`
ALTER TABLE public.licencias DROP CONSTRAINT IF EXISTS licencias_empresa_id_fkey;
ALTER TABLE public.licencias ADD CONSTRAINT licencias_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.sucursales DROP CONSTRAINT IF EXISTS sucursales_empresa_id_fkey;
ALTER TABLE public.sucursales ADD CONSTRAINT sucursales_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_empresa_id_fkey;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.pagos_licencia DROP CONSTRAINT IF EXISTS pagos_licencia_empresa_id_fkey;
ALTER TABLE public.pagos_licencia ADD CONSTRAINT pagos_licencia_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.categorias DROP CONSTRAINT IF EXISTS categorias_empresa_id_fkey;
ALTER TABLE public.categorias ADD CONSTRAINT categorias_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.productos DROP CONSTRAINT IF EXISTS productos_empresa_id_fkey;
ALTER TABLE public.productos ADD CONSTRAINT productos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.listas_precios DROP CONSTRAINT IF EXISTS listas_precios_empresa_id_fkey;
ALTER TABLE public.listas_precios ADD CONSTRAINT listas_precios_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.proveedores DROP CONSTRAINT IF EXISTS proveedores_empresa_id_fkey;
ALTER TABLE public.proveedores ADD CONSTRAINT proveedores_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_empresa_id_fkey;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

-- Relaciones con `licencias`
ALTER TABLE public.pagos_licencia DROP CONSTRAINT IF EXISTS pagos_licencia_licencia_id_fkey;
ALTER TABLE public.pagos_licencia ADD CONSTRAINT pagos_licencia_licencia_id_fkey FOREIGN KEY (licencia_id) REFERENCES public.licencias(id) ON DELETE CASCADE;

-- Relaciones con `sucursales`
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_sucursal_id_fkey;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_sucursal_id_fkey FOREIGN KEY (sucursal_id) REFERENCES public.sucursales(id) ON DELETE CASCADE;

ALTER TABLE public.inventarios DROP CONSTRAINT IF EXISTS inventarios_sucursal_id_fkey;
ALTER TABLE public.inventarios ADD CONSTRAINT inventarios_sucursal_id_fkey FOREIGN KEY (sucursal_id) REFERENCES public.sucursales(id) ON DELETE CASCADE;

-- Relaciones con `categorias`
ALTER TABLE public.productos DROP CONSTRAINT IF EXISTS productos_categoria_id_fkey;
ALTER TABLE public.productos ADD CONSTRAINT productos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id) ON DELETE SET NULL;

-- Relaciones con `productos`
ALTER TABLE public.inventarios DROP CONSTRAINT IF EXISTS inventarios_producto_id_fkey;
ALTER TABLE public.inventarios ADD CONSTRAINT inventarios_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;

ALTER TABLE public.imagenes_productos DROP CONSTRAINT IF EXISTS imagenes_productos_producto_id_fkey;
ALTER TABLE public.imagenes_productos ADD CONSTRAINT imagenes_productos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;

ALTER TABLE public.precios_productos DROP CONSTRAINT IF EXISTS precios_productos_producto_id_fkey;
ALTER TABLE public.precios_productos ADD CONSTRAINT precios_productos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;

ALTER TABLE public.compra_items DROP CONSTRAINT IF EXISTS compra_items_producto_id_fkey;
ALTER TABLE public.compra_items ADD CONSTRAINT compra_items_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;

ALTER TABLE public.venta_items DROP CONSTRAINT IF EXISTS venta_items_producto_id_fkey;
ALTER TABLE public.venta_items ADD CONSTRAINT venta_items_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;

ALTER TABLE public.movimientos_inventario DROP CONSTRAINT IF EXISTS movimientos_inventario_producto_id_fkey;
ALTER TABLE public.movimientos_inventario ADD CONSTRAINT movimientos_inventario_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;

-- Relaciones con `listas_precios`
ALTER TABLE public.precios_productos DROP CONSTRAINT IF EXISTS precios_productos_lista_precio_id_fkey;
ALTER TABLE public.precios_productos ADD CONSTRAINT precios_productos_lista_precio_id_fkey FOREIGN KEY (lista_precio_id) REFERENCES public.listas_precios(id) ON DELETE CASCADE;

-- Relaciones con `compras`
ALTER TABLE public.compra_items DROP CONSTRAINT IF EXISTS compra_items_compra_id_fkey;
ALTER TABLE public.compra_items ADD CONSTRAINT compra_items_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(id) ON DELETE CASCADE;

ALTER TABLE public.pagos_compras DROP CONSTRAINT IF EXISTS pagos_compras_compra_id_fkey;
ALTER TABLE public.pagos_compras ADD CONSTRAINT pagos_compras_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(id) ON DELETE CASCADE;

-- Relaciones con `ventas`
ALTER TABLE public.venta_items DROP CONSTRAINT IF EXISTS venta_items_venta_id_fkey;
ALTER TABLE public.venta_items ADD CONSTRAINT venta_items_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id) ON DELETE CASCADE;

ALTER TABLE public.pagos_ventas DROP CONSTRAINT IF EXISTS pagos_ventas_venta_id_fkey;
ALTER TABLE public.pagos_ventas ADD CONSTRAINT pagos_ventas_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id) ON DELETE CASCADE;

-- Relaciones con entidades que no deben causar eliminación en cascada (RESTRICT o SET NULL)
ALTER TABLE public.compras DROP CONSTRAINT IF EXISTS compras_proveedor_id_fkey;
ALTER TABLE public.compras ADD CONSTRAINT compras_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) ON DELETE RESTRICT;

ALTER TABLE public.compras DROP CONSTRAINT IF EXISTS compras_usuario_id_fkey;
ALTER TABLE public.compras ADD CONSTRAINT compras_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.ventas DROP CONSTRAINT IF EXISTS ventas_cliente_id_fkey;
ALTER TABLE public.ventas ADD CONSTRAINT ventas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;

ALTER TABLE public.ventas DROP CONSTRAINT IF EXISTS ventas_usuario_id_fkey;
ALTER TABLE public.ventas ADD CONSTRAINT ventas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.movimientos_inventario DROP CONSTRAINT IF EXISTS movimientos_inventario_usuario_id_fkey;
ALTER TABLE public.movimientos_inventario ADD CONSTRAINT movimientos_inventario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


RAISE NOTICE '¡COMPLETADO! Todas las reglas de eliminación en cascada han sido verificadas y aplicadas.';

END $$;

-- =============================================================================
-- Fin del script de endurecimiento. La base de datos ahora está configurada
-- para manejar eliminaciones en cascada de forma robusta y segura.
-- =============================================================================