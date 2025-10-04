-- =============================================================================
-- FINAL RLS RESET SCRIPT (V4 - JWT ARCHITECTURE - THE DEFINITIVE FIX)
-- =============================================================================
-- Este script implementa la arquitectura recomendada por Supabase para resolver
-- de forma definitiva el error "infinite recursion detected" que bloquea las
-- notificaciones en tiempo real.
--
-- PROBLEMA RESUELTO:
-- Las políticas RLS anteriores intentaban verificar el `empresa_id` del usuario
-- haciendo una subconsulta a la tabla `public.usuarios`. Esto creaba un ciclo
-- de recursión (`RLS de ventas` -> `SELECT de usuarios` -> `RLS de usuarios` ->
-- `SELECT de usuarios`...), causando el fallo.
--
-- SOLUCIÓN (ARQUITECTURA JWT):
-- 1.  **Sincronización con auth.users:** Se crea un trigger que copia el `empresa_id`
--     del perfil de `public.usuarios` a los metadatos (`raw_app_meta_data`)
--     de la tabla `auth.users`.
-- 2.  **Población de Datos Existentes:** Se ejecuta un script para actualizar
--     estos metadatos para todos los usuarios ya registrados.
-- 3.  **Lectura desde el JWT:** Se crea una nueva función `get_empresa_id_from_jwt()`
--     que lee el `empresa_id` directamente del token (JWT) del usuario actual.
--     Esta operación es instantánea y NO activa ninguna política RLS.
-- 4.  **Reescritura de Políticas:** TODAS las políticas RLS se reescriben para
--     usar esta nueva función, rompiendo el ciclo de recursión para siempre.
--
-- **INSTRUCCIONES CRÍTICAS:**
-- 1.  Ejecuta este script completo en el Editor SQL de tu proyecto.
-- 2.  **CIERRA SESIÓN Y VUELVE A INICIAR SESIÓN EN TU APLICACIÓN.** Este paso
--     es OBLIGATORIO para que tu navegador obtenga el nuevo JWT con el `empresa_id`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Limpieza Profunda de Todas las Políticas y Funciones RLS Antiguas
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_my_empresa_id() CASCADE;
DROP FUNCTION IF EXISTS public.is_my_product(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_my_compra(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_my_venta(uuid) CASCADE;

-- Eliminar todas las políticas existentes para una reconstrucción limpia
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "Enable all for own company" ON public.' || quote_ident(r.tablename);
    END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- Paso 2: Sincronización de `empresa_id` con `auth.users`
-- -----------------------------------------------------------------------------
-- Función que se ejecutará en el trigger
CREATE OR REPLACE FUNCTION public.sync_user_metadata_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Actualiza los metadatos en auth.users con el empresa_id del perfil
    UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('empresa_id', NEW.empresa_id)
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$;

-- Trigger que se dispara al insertar o actualizar `empresa_id` en `usuarios`
DROP TRIGGER IF EXISTS on_user_profile_change ON public.usuarios;
CREATE TRIGGER on_user_profile_change
AFTER INSERT OR UPDATE OF empresa_id ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_metadata_to_auth();


-- -----------------------------------------------------------------------------
-- Paso 3: Backfill - Poblar metadatos para usuarios existentes
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    user_record RECORD;
BEGIN
    RAISE NOTICE 'Iniciando backfill de metadatos de empresa para usuarios existentes...';
    FOR user_record IN
        SELECT id, empresa_id FROM public.usuarios WHERE empresa_id IS NOT NULL
    LOOP
        UPDATE auth.users
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('empresa_id', user_record.empresa_id)
        WHERE id = user_record.id;
    END LOOP;
    RAISE NOTICE 'Backfill completado.';
END;
$$;


-- -----------------------------------------------------------------------------
-- Paso 4: Nueva Función de Lectura desde JWT y Reconstrucción de Políticas
-- -----------------------------------------------------------------------------
-- Nueva función que lee el `empresa_id` directamente del JWT. ¡No toca `public.usuarios`!
CREATE OR REPLACE FUNCTION public.get_empresa_id_from_jwt()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid
$$;


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
        EXECUTE format('
            CREATE POLICY "Enable all for own company" ON public.%I
            FOR ALL USING (
                empresa_id = public.get_empresa_id_from_jwt()
            );
        ', table_name);
    END LOOP;
END;
$$;


-- -- POLÍTICAS PARA TABLAS CON REFERENCIA INDIRECTA -- --
-- Se usan subconsultas a las tablas padre, pero la condición final SIEMPRE
-- se resuelve con `get_empresa_id_from_jwt()`, rompiendo el ciclo.

-- Tabla: inventarios (depende de productos)
ALTER TABLE public.inventarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for own company" ON public.inventarios FOR ALL USING (
    EXISTS (SELECT 1 FROM public.productos p WHERE p.id = producto_id AND p.empresa_id = public.get_empresa_id_from_jwt())
);

-- Tabla: precios_productos (depende de productos)
ALTER TABLE public.precios_productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for own company" ON public.precios_productos FOR ALL USING (
    EXISTS (SELECT 1 FROM public.productos p WHERE p.id = producto_id AND p.empresa_id = public.get_empresa_id_from_jwt())
);

-- Tabla: imagenes_productos (depende de productos)
ALTER TABLE public.imagenes_productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for own company" ON public.imagenes_productos FOR ALL USING (
    EXISTS (SELECT 1 FROM public.productos p WHERE p.id = producto_id AND p.empresa_id = public.get_empresa_id_from_jwt())
);

-- Tabla: movimientos_inventario (depende de productos)
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for own company" ON public.movimientos_inventario FOR ALL USING (
    EXISTS (SELECT 1 FROM public.productos p WHERE p.id = producto_id AND p.empresa_id = public.get_empresa_id_from_jwt())
);

-- Tabla: compra_items (depende de compras)
ALTER TABLE public.compra_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for own company" ON public.compra_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.compras c WHERE c.id = compra_id AND c.empresa_id = public.get_empresa_id_from_jwt())
);

-- Tabla: pagos_compras (depende de compras)
ALTER TABLE public.pagos_compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for own company" ON public.pagos_compras FOR ALL USING (
    EXISTS (SELECT 1 FROM public.compras c WHERE c.id = compra_id AND c.empresa_id = public.get_empresa_id_from_jwt())
);

-- Tabla: venta_items (depende de ventas)
ALTER TABLE public.venta_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for own company" ON public.venta_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.ventas v WHERE v.id = venta_id AND v.empresa_id = public.get_empresa_id_from_jwt())
);

-- Tabla: pagos_ventas (depende de ventas)
ALTER TABLE public.pagos_ventas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for own company" ON public.pagos_ventas FOR ALL USING (
    EXISTS (SELECT 1 FROM public.ventas v WHERE v.id = venta_id AND v.empresa_id = public.get_empresa_id_from_jwt())
);


-- =============================================================================
-- Fin del script. El error de recursión infinita ha sido resuelto.
-- RECUERDA: DEBES CERRAR Y VOLVER A INICIAR SESIÓN EN LA APLICACIÓN.
-- =============================================================================
