-- =============================================================================
-- FINAL REALTIME FIX (V2 - ROBUST & IDEMPOTENT)
-- =============================================================================
-- Este script es la solución definitiva y más robusta para configurar la
-- publicación de notificaciones en tiempo real de PostgreSQL.
--
-- PROBLEMA RESUELTO:
-- El comando `ALTER PUBLICATION ... ADD TABLE ...` falla por completo si una
-- sola de las tablas en la lista ya es miembro de la publicación.
--
-- SOLUCIÓN (V2):
-- Este script intenta añadir cada tabla en una transacción separada. Si la
-- tabla ya existe en la publicación, se captura la excepción de "objeto
-- duplicado", se muestra un aviso informativo y el script continúa con la
-- siguiente tabla sin fallar. Esto garantiza que el script se pueda ejecutar
-- varias veces de forma segura y que todas las tablas necesarias queden
-- configuradas.
--
-- INSTRUCCIONES:
-- Ejecuta este script COMPLETO en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.productos;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "productos" ya está en la publicación.';
END;
$$;

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
    ALTER PUBLICATION supabase_realtime ADD TABLE public.precios_productos;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "precios_productos" ya está en la publicación.';
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.categorias;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "categorias" ya está en la publicación.';
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.listas_precios;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "listas_precios" ya está en la publicación.';
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

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.proveedores;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "proveedores" ya está en la publicación.';
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.compras;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "compras" ya está en la publicación.';
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.compra_items;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "compra_items" ya está en la publicación.';
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pagos_compras;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "pagos_compras" ya está en la publicación.';
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "clientes" ya está en la publicación.';
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ventas;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "ventas" ya está en la publicación.';
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.venta_items;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "venta_items" ya está en la publicación.';
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pagos_ventas;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "pagos_ventas" ya está en la publicación.';
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.usuarios;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "usuarios" ya está en la publicación.';
END;
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sucursales;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'La tabla "sucursales" ya está en la publicación.';
END;
$$;


-- =============================================================================
-- Fin del script. La configuración de tiempo real ahora está completa y es robusta.
-- =============================================================================