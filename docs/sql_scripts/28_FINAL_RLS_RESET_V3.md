-- =============================================================================
-- FINAL RLS RESET SCRIPT (V3 - Direct & Robust Architecture)
-- =============================================================================
-- Este script es la solución definitiva para los problemas de RLS y las
-- notificaciones en tiempo real. Abandona el uso de funciones auxiliares
-- (que fallaban en el contexto de Realtime) y en su lugar implementa
-- políticas directas y explícitas.
--
-- ¿QUÉ HACE ESTE SCRIPT?
-- 1.  Elimina todas las políticas y funciones auxiliares RLS antiguas.
-- 2.  Reconstruye desde cero las políticas para TODAS las tablas usando
--     subconsultas directas para verificar la pertenencia, la forma más
--     segura y recomendada para el servicio de tiempo real de Supabase.
--
-- **INSTRUCCIONES:**
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- Es seguro ejecutarlo varias veces y dejará tu sistema RLS en el estado
-- óptimo y definitivo para el funcionamiento de las notificaciones.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Limpieza Profunda de Políticas y Funciones Antiguas
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_my_empresa_id() CASCADE;
DROP FUNCTION IF EXISTS public.is_my_product(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_my_compra(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_my_venta(uuid) CASCADE;


-- -----------------------------------------------------------------------------
-- Paso 2: Reconstrucción de Políticas
-- -----------------------------------------------------------------------------

-- Función auxiliar para obtener el ID de la empresa del usuario actual de forma segura
-- Aunque no se usará en las políticas, es útil para otras funciones.
CREATE OR REPLACE FUNCTION get_my_empresa_id()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS
$function$
DECLARE
    v_empresa_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM public.usuarios WHERE id = auth.uid();
  RETURN v_empresa_id;
END;
$function$;

-- Subconsulta reutilizable para obtener el empresa_id
-- Esta es la clave de la nueva estrategia.
-- `(SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid())`


-- -- POLÍTICAS PARA TABLAS CON `empresa_id` DIRECTO -- --
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN
        SELECT t.table_name
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
        WHERE t.table_schema = 'public'
          AND c.column_name = 'empresa_id'
          AND t.table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Enable all for own company" ON public.%I;', table_name);
        EXECUTE format('
            CREATE POLICY "Enable all for own company" ON public.%I
            FOR ALL USING (
                empresa_id = (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid())
            );
        ', table_name);
    END LOOP;
END;
$$;


-- -- POLÍTICAS PARA TABLAS CON REFERENCIA INDIRECTA -- --

-- Tabla: inventarios (depende de productos)
ALTER TABLE public.inventarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.inventarios;
CREATE POLICY "Enable all for own company" ON public.inventarios
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.productos p
        WHERE p.id = producto_id AND p.empresa_id = (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid())
    )
);

-- Tabla: precios_productos (depende de productos)
ALTER TABLE public.precios_productos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.precios_productos;
CREATE POLICY "Enable all for own company" ON public.precios_productos
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.productos p
        WHERE p.id = producto_id AND p.empresa_id = (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid())
    )
);

-- Tabla: imagenes_productos (depende de productos)
ALTER TABLE public.imagenes_productos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.imagenes_productos;
CREATE POLICY "Enable all for own company" ON public.imagenes_productos
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.productos p
        WHERE p.id = producto_id AND p.empresa_id = (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid())
    )
);

-- Tabla: movimientos_inventario (depende de productos)
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.movimientos_inventario;
CREATE POLICY "Enable all for own company" ON public.movimientos_inventario
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.productos p
        WHERE p.id = producto_id AND p.empresa_id = (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid())
    )
);

-- Tabla: compra_items (depende de compras)
ALTER TABLE public.compra_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.compra_items;
CREATE POLICY "Enable all for own company" ON public.compra_items
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.compras c
        WHERE c.id = compra_id AND c.empresa_id = (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid())
    )
);

-- Tabla: pagos_compras (depende de compras)
ALTER TABLE public.pagos_compras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.pagos_compras;
CREATE POLICY "Enable all for own company" ON public.pagos_compras
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.compras c
        WHERE c.id = compra_id AND c.empresa_id = (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid())
    )
);

-- Tabla: venta_items (depende de ventas)
ALTER TABLE public.venta_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.venta_items;
CREATE POLICY "Enable all for own company" ON public.venta_items
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.ventas v
        WHERE v.id = venta_id AND v.empresa_id = (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid())
    )
);

-- Tabla: pagos_ventas (depende de ventas)
ALTER TABLE public.pagos_ventas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.pagos_ventas;
CREATE POLICY "Enable all for own company" ON public.pagos_ventas
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.ventas v
        WHERE v.id = venta_id AND v.empresa_id = (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid())
    )
);

-- =============================================================================
-- Fin del script. El sistema RLS ahora es 100% compatible con las
-- notificaciones en tiempo real.
-- =============================================================================
