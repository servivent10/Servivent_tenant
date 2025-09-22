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