-- =============================================================================
-- DATABASE HARDENING SCRIPT: ENFORCE CASCADE DELETES
-- =============================================================================
-- Este script es una medida de mantenimiento CRUCIAL para garantizar la
-- integridad referencial y el correcto funcionamiento de la eliminación de empresas.
--
-- PROBLEMA: Algunas claves foráneas no fueron creadas con la opción
-- `ON DELETE CASCADE`. Esto causa que al intentar eliminar una empresa, la
-- operación falle con un error de "violates foreign key constraint".
--
-- SOLUCIÓN: Este script recorre todas las relaciones importantes, elimina la
-- restricción de clave foránea existente (si la hay) y la vuelve a crear
-- asegurándose de que `ON DELETE CASCADE` esté presente.
--
-- INSTRUCCIONES:
-- Ejecuta este script COMPLETO en el Editor SQL de tu proyecto de Supabase.
-- Es seguro ejecutarlo varias veces.
-- =============================================================================

DO $$
BEGIN

-- -----------------------------------------------------------------------------
-- Relaciones Directas con `empresas`
-- -----------------------------------------------------------------------------

-- Tabla: licencias
ALTER TABLE public.licencias DROP CONSTRAINT IF EXISTS licencias_empresa_id_fkey;
ALTER TABLE public.licencias ADD CONSTRAINT fk_licencias_empresa_id
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
RAISE NOTICE 'CASCADE DELETE aplicado a: licencias -> empresas';

-- Tabla: sucursales
ALTER TABLE public.sucursales DROP CONSTRAINT IF EXISTS sucursales_empresa_id_fkey;
ALTER TABLE public.sucursales ADD CONSTRAINT fk_sucursales_empresa_id
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
RAISE NOTICE 'CASCADE DELETE aplicado a: sucursales -> empresas';

-- Tabla: usuarios
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_empresa_id_fkey;
ALTER TABLE public.usuarios ADD CONSTRAINT fk_usuarios_empresa_id
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
RAISE NOTICE 'CASCADE DELETE aplicado a: usuarios -> empresas';

-- Tabla: pagos_licencia
ALTER TABLE public.pagos_licencia DROP CONSTRAINT IF EXISTS pagos_licencia_empresa_id_fkey;
ALTER TABLE public.pagos_licencia ADD CONSTRAINT fk_pagos_licencia_empresa_id
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
RAISE NOTICE 'CASCADE DELETE aplicado a: pagos_licencia -> empresas';

-- Tabla: categorias
ALTER TABLE public.categorias DROP CONSTRAINT IF EXISTS categorias_empresa_id_fkey;
ALTER TABLE public.categorias ADD CONSTRAINT fk_categorias_empresa_id
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
RAISE NOTICE 'CASCADE DELETE aplicado a: categorias -> empresas';

-- Tabla: productos
ALTER TABLE public.productos DROP CONSTRAINT IF EXISTS productos_empresa_id_fkey;
ALTER TABLE public.productos ADD CONSTRAINT fk_productos_empresa_id
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
RAISE NOTICE 'CASCADE DELETE aplicado a: productos -> empresas';

-- Tabla: listas_precios
ALTER TABLE public.listas_precios DROP CONSTRAINT IF EXISTS listas_precios_empresa_id_fkey;
ALTER TABLE public.listas_precios ADD CONSTRAINT fk_listas_precios_empresa_id
    FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
RAISE NOTICE 'CASCADE DELETE aplicado a: listas_precios -> empresas';


-- -----------------------------------------------------------------------------
-- Relaciones Indirectas (Cadena de Cascada)
-- -----------------------------------------------------------------------------

-- **LA CLAVE DEL ERROR:** usuarios -> sucursales
-- Cuando se elimina `empresas`, se intenta eliminar `sucursales`. Esto fallaba
-- porque `usuarios` aún tenía una referencia. Ahora, `usuarios` se eliminará
-- en cascada también.
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_sucursal_id_fkey;
ALTER TABLE public.usuarios ADD CONSTRAINT fk_usuarios_sucursal_id
    FOREIGN KEY (sucursal_id) REFERENCES public.sucursales(id) ON DELETE CASCADE;
RAISE NOTICE 'CASCADE DELETE aplicado a: usuarios -> sucursales';

-- inventarios -> sucursales
ALTER TABLE public.inventarios DROP CONSTRAINT IF EXISTS inventarios_sucursal_id_fkey;
ALTER TABLE public.inventarios ADD CONSTRAINT fk_inventarios_sucursal_id
    FOREIGN KEY (sucursal_id) REFERENCES public.sucursales(id) ON DELETE CASCADE;
RAISE NOTICE 'CASCADE DELETE aplicado a: inventarios -> sucursales';

-- inventarios -> productos
ALTER TABLE public.inventarios DROP CONSTRAINT IF EXISTS inventarios_producto_id_fkey;
ALTER TABLE public.inventarios ADD CONSTRAINT fk_inventarios_producto_id
    FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;
RAISE NOTICE 'CASCADE DELETE aplicado a: inventarios -> productos';

-- imagenes_productos -> productos
ALTER TABLE public.imagenes_productos DROP CONSTRAINT IF EXISTS imagenes_productos_producto_id_fkey;
ALTER TABLE public.imagenes_productos ADD CONSTRAINT fk_imagenes_productos_producto_id
    FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;
RAISE NOTICE 'CASCADE DELETE aplicado a: imagenes_productos -> productos';

-- precios_productos -> productos
ALTER TABLE public.precios_productos DROP CONSTRAINT IF EXISTS precios_productos_producto_id_fkey;
ALTER TABLE public.precios_productos ADD CONSTRAINT fk_precios_productos_producto_id
    FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;
RAISE NOTICE 'CASCADE DELETE aplicado a: precios_productos -> productos';

-- precios_productos -> listas_precios
ALTER TABLE public.precios_productos DROP CONSTRAINT IF EXISTS precios_productos_lista_precio_id_fkey;
ALTER TABLE public.precios_productos ADD CONSTRAINT fk_precios_productos_lista_precio_id
    FOREIGN KEY (lista_precio_id) REFERENCES public.listas_precios(id) ON DELETE CASCADE;
RAISE NOTICE 'CASCADE DELETE aplicado a: precios_productos -> listas_precios';

END $$;

-- =============================================================================
-- Fin del script de endurecimiento. La base de datos ahora está configurada
-- para manejar eliminaciones en cascada de forma robusta.
-- =============================================================================