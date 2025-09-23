# Esquema de Base de Datos Simplificado: ServiVENT

Este documento define la estructura inicial de la base de datos de forma simplificada, mostrando únicamente el nombre de la columna y su tipo de dato.

## Tabla: `empresas`

Almacena la información de cada empresa (tenant) registrada en el sistema.

| Columna | Tipo |
| --- | --- |
| `id` | `uuid` |
| `nombre` | `text` |
| `nit` | `text` |
| `direccion` | `text` |
| `telefono` | `text` |
| `logo` | `text` |
| `created_at` | `timestamptz` |

---

## Tabla: `licencias`

Gestiona el estado de las licencias para cada empresa.

| Columna | Tipo |
| --- | --- |
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `tipo_licencia` | `text` |
| `fecha_inicio` | `date` |
| `fecha_fin` | `date` |
| `estado` | `text` |
| `created_at` | `timestamptz` |

---

## Tabla: `pagos_licencia`

Almacena el historial de pagos de licencias realizados por cada empresa.

| Columna | Tipo |
| --- | --- |
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `licencia_id` | `uuid` |
| `monto` | `numeric` |
| `fecha_pago` | `timestamptz` |
| `metodo_pago` | `text` |
| `notas` | `text` |
| `created_at` | `timestamptz` |

---

## Tabla: `usuarios`

Contiene los perfiles de los usuarios, extendiendo la tabla `auth.users` de Supabase.

| Columna | Tipo |
| --- | --- |
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `nombre_completo` | `text` |
| `rol` | `text` |
| `correo` | `text` |
| `avatar` | `text` |
| `created_at` | `timestamptz` |

---

## Tabla: `sucursales`

Almacena las diferentes sucursales o puntos de venta de cada empresa.

| Columna | Tipo |
| --- | --- |
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `nombre` | `text` |
| `direccion` | `text` |
| `telefono` | `text` |
| `created_at` | `timestamptz` |

---
## **NUEVO:** Tablas de Productos e Inventario
---

## Tabla: `categorias`

Clasificación de los productos.

| Columna | Tipo |
| --- | --- |
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `nombre` | `text` |
| `created_at` | `timestamptz` |

---

## Tabla: `productos`

El catálogo maestro de todos los artículos que vende la empresa.

| Columna | Tipo |
| --- | --- |
| `id` | `uuid` |
| `empresa_id` | `uuid` |
| `nombre` | `text` |
| `sku` | `text` |
| `marca` | `text` |
| `modelo` | `text` |
| `descripcion` | `text` |
| `precio_venta`| `numeric` |
| `precio_compra`| `numeric` |
| `categoria_id` | `uuid` |
| `unidad_medida`| `text` |
| `created_at` | `timestamptz` |

---

## Tabla: `imagenes_productos`

Galería de imágenes para cada producto.

| Columna | Tipo |
| --- | --- |
| `id` | `uuid` |
| `producto_id` | `uuid` |
| `imagen_url` | `text` |
| `orden` | `int` |
| `created_at` | `timestamptz`|

---

## Tabla: `inventarios`

El stock (cantidad) de cada producto en cada sucursal.

| Columna | Tipo |
| --- | --- |
| `id` | `uuid` |
| `producto_id` | `uuid` |
| `sucursal_id` | `uuid` |
| `cantidad` | `numeric` |
| `stock_minimo` | `numeric` |
| `updated_at` | `timestamptz` |
