-- =============================================================================
-- FINAL RLS RESET SCRIPT (V2 - Best Practices Architecture)
-- =============================================================================
-- Este script es la solución definitiva y más robusta para los problemas de
-- RLS y las notificaciones inconsistentes en tiempo real. Implementa la
-- arquitectura recomendada por Supabase para aplicaciones complejas.
--
-- ¿QUÉ HACE ESTE SCRIPT?
-- 1.  Elimina todas las políticas y funciones auxiliares RLS antiguas.
-- 2.  Crea pequeñas funciones auxiliares `SECURITY DEFINER` que realizan una
--     única comprobación de pertenencia (ej. `is_my_product`). Esto rompe
--     los ciclos de recursión que causan los fallos en las notificaciones.
-- 3.  Reconstruye desde cero las políticas para TODAS las tablas, utilizando
--     estas nuevas funciones auxiliares para las tablas relacionadas.
--
-- **INSTRUCCIONES:**
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- Es seguro ejecutarlo varias veces y dejará tu sistema RLS en el estado
-- óptimo y más seguro.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Limpieza Profunda de Políticas y Funciones Antiguas
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_current_user_empresa_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_empresa_id() CASCADE;
DROP FUNCTION IF EXISTS public.is_my_product(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_my_compra(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_my_venta(uuid) CASCADE;

-- -----------------------------------------------------------------------------
-- Paso 2: Crear las Funciones Auxiliares de Seguridad
-- -----------------------------------------------------------------------------
-- Función principal para obtener el ID de la empresa del usuario actual.
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

-- Funciones auxiliares para verificar la pertenencia de registros relacionados.
CREATE OR REPLACE FUNCTION is_my_product(p_product_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS
$function$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.productos WHERE id = p_product_id AND empresa_id = get_my_empresa_id());
END;
$function$;

CREATE OR REPLACE FUNCTION is_my_compra(p_compra_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS
$function$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.compras WHERE id = p_compra_id AND empresa_id = get_my_empresa_id());
END;
$function$;

CREATE OR REPLACE FUNCTION is_my_venta(p_venta_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS
$function$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.ventas WHERE id = p_venta_id AND empresa_id = get_my_empresa_id());
END;
$function$;

-- -----------------------------------------------------------------------------
-- Paso 3: Reconstrucción de Políticas con la Nueva Arquitectura
-- -----------------------------------------------------------------------------

-- Tablas con referencia directa a `empresa_id`
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
        EXECUTE format('CREATE POLICY "Enable all for own company" ON public.%I FOR ALL USING (empresa_id = get_my_empresa_id());', table_name);
    END LOOP;
END;
$$;


-- Tablas con referencia indirecta (usando las nuevas funciones auxiliares)

-- Tabla: inventarios (depende de productos)
ALTER TABLE public.inventarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.inventarios;
CREATE POLICY "Enable all for own company" ON public.inventarios FOR ALL USING (is_my_product(producto_id));

-- Tabla: precios_productos (depende de productos)
ALTER TABLE public.precios_productos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.precios_productos;
CREATE POLICY "Enable all for own company" ON public.precios_productos FOR ALL USING (is_my_product(producto_id));

-- Tabla: imagenes_productos (depende de productos)
ALTER TABLE public.imagenes_productos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.imagenes_productos;
CREATE POLICY "Enable all for own company" ON public.imagenes_productos FOR ALL USING (is_my_product(producto_id));

-- Tabla: movimientos_inventario (depende de productos)
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.movimientos_inventario;
CREATE POLICY "Enable all for own company" ON public.movimientos_inventario FOR ALL USING (is_my_product(producto_id));

-- Tabla: compra_items (depende de compras)
ALTER TABLE public.compra_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.compra_items;
CREATE POLICY "Enable all for own company" ON public.compra_items FOR ALL USING (is_my_compra(compra_id));

-- Tabla: pagos_compras (depende de compras)
ALTER TABLE public.pagos_compras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.pagos_compras;
CREATE POLICY "Enable all for own company" ON public.pagos_compras FOR ALL USING (is_my_compra(compra_id));

-- Tabla: venta_items (depende de ventas)
ALTER TABLE public.venta_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.venta_items;
CREATE POLICY "Enable all for own company" ON public.venta_items FOR ALL USING (is_my_venta(venta_id));

-- Tabla: pagos_ventas (depende de ventas)
ALTER TABLE public.pagos_ventas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.pagos_ventas;
CREATE POLICY "Enable all for own company" ON public.pagos_ventas FOR ALL USING (is_my_venta(venta_id));

-- =============================================================================
-- Fin del script. El sistema RLS ahora es robusto, seguro y compatible con
-- notificaciones en tiempo real consistentes.
-- =============================================================================