-- =============================================================================
-- FINAL REALTIME FIX: CONFIGURE POSTGRESQL PUBLICATION
-- =============================================================================
-- Este es el script final y definitivo para resolver las notificaciones
-- inconsistentes en tiempo real.
--
-- PROBLEMA:
-- El sistema de tiempo real de Supabase depende de una "publicación" de
-- PostgreSQL llamada `supabase_realtime`. Esta publicación es una lista
-- explícita de las tablas para las cuales la base de datos debe emitir
-- notificaciones de cambio. Por defecto, Supabase no añade automáticamente
-- todas tus tablas a esta lista. Si una tabla no está en la publicación,
-- NINGÚN cambio en ella generará una notificación, y el frontend nunca se
-- enterará. Este es el motivo del comportamiento errático.
--
-- SOLUCIÓN:
-- Este script añade explícitamente TODAS las tablas relevantes de la aplicación
-- a la publicación `supabase_realtime`, asegurando que cada cambio sea
-- notificado y que el sistema en tiempo real funcione de manera 100% fiable.
--
-- INSTRUCCIONES:
-- Ejecuta este script COMPLETO en el Editor SQL de tu proyecto de Supabase.
-- Si una tabla ya ha sido añadida, recibirás una notificación de aviso, lo cual
-- es normal y seguro.
-- =============================================================================

-- Habilita la publicación para todas las tablas clave de la aplicación.
-- Es crucial incluir no solo las tablas principales, sino también las
-- tablas de detalle (como `venta_items`) si deseas que los cambios en ellas
-- también se reflejen.

ALTER PUBLICATION supabase_realtime ADD TABLE
    public.productos,
    public.inventarios,
    public.precios_productos,
    public.categorias,
    public.listas_precios,
    public.movimientos_inventario,
    public.proveedores,
    public.compras,
    public.compra_items,
    public.pagos_compras,
    public.clientes,
    public.ventas,
    public.venta_items,
    public.pagos_ventas,
    public.usuarios,
    public.sucursales;

-- =============================================================================
-- Fin del script. Después de ejecutar esto, el sistema de tiempo real
-- debería funcionar de manera consistente para todas las tablas.
-- =============================================================================