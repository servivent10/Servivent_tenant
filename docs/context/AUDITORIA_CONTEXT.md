# MÓDULO 08: SEGURIDAD Y AUDITORÍA
## Sistema de Auditoría Completa ("Caja Negra")

Este documento define el plan de implementación para el **Sistema de Auditoría Completa** de ServiVENT. Este módulo actuará como la "caja negra" del sistema, proporcionando un registro inmutable y detallado de cada cambio significativo en los datos, complementando la auditoría operacional ya existente en `movimientos_inventario`.

## 1. Visión y Objetivo

Mientras que `movimientos_inventario` es un libro contable para el **negocio**, `historial_cambios` será un registro forense para la **seguridad y la integridad de los datos**.

-   **Trazabilidad Absoluta:** Responder a las preguntas "¿Quién hizo qué, cuándo, y cómo era antes?" para cualquier dato crítico del sistema.
-   **Seguridad y Control:** Detectar modificaciones no autorizadas o sospechosas, como cambios de precios o de roles de usuario.
-   **Responsabilidad (Accountability):** Fomentar una cultura de responsabilidad, ya que todas las acciones importantes quedan registradas.
-   **Depuración y Recuperación:** Facilitar la investigación de errores de datos reportados por los usuarios y proporcionar un "snapshot" de los datos antes de un cambio incorrecto, permitiendo su restauración manual.

## 2. Arquitectura de Backend (PostgreSQL)

La implementación se basará en un sistema de triggers de PostgreSQL, garantizando que la auditoría sea automática, ineludible y de bajo impacto en el rendimiento.

### 2.1. La Tabla de Auditoría Central (`historial_cambios`)

Esta será la única tabla donde se almacenarán todos los registros de auditoría.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | `bigserial` | PK, Identificador autoincremental del evento de auditoría. |
| `timestamp` | `timestamptz` | Fecha y hora exactas del cambio (`default now()`). |
| `usuario_id` | `uuid` | FK a `auth.users` (`on delete set null`). El usuario que realizó la acción. |
| `usuario_nombre`| `text` | Nombre denormalizado del usuario para facilitar la lectura. |
| `accion` | `text` | El tipo de operación: 'INSERT', 'UPDATE', 'DELETE'. |
| `tabla_afectada` | `text` | El nombre de la tabla modificada (ej. 'productos'). |
| `registro_id` | `uuid` | El ID del registro específico que fue afectado. |
| `datos_anteriores`| `jsonb` | **Snapshot** del registro completo *antes* del cambio. `NULL` para `INSERT`. |
| `datos_nuevos` | `jsonb` | **Snapshot** del registro completo *después* del cambio. `NULL` para `DELETE`. |
| `empresa_id` | `uuid` | FK a `empresas`. Crucial para la seguridad RLS de la propia tabla de historial. |

### 2.2. La Función de Trigger Genérica (`public.registrar_cambio()`)

Se creará una única función de trigger reutilizable que se encargará de toda la lógica de registro.

-   **Funcionamiento:**
    -   Se ejecutará `AFTER INSERT OR UPDATE OR DELETE`.
    -   Utilizará las variables especiales de PostgreSQL: `TG_OP`, `TG_TABLE_NAME`, `OLD` (fila antigua), `NEW` (fila nueva).
    -   Obtendrá el `usuario_id` y `empresa_id` del JWT (`auth.uid()`, `public.get_empresa_id_from_jwt()`) para evitar recursión.
    -   Obtendrá el `usuario_nombre` de los metadatos del JWT.
    -   Convertirá las filas `OLD` y `NEW` a `jsonb` usando `to_jsonb()`.
    -   Insertará el registro completo en la tabla `historial_cambios`.

### 2.3. Aplicación de Triggers

Se "enganchará" la función `registrar_cambio()` a todas las tablas críticas del sistema.

-   **Lista de Tablas a Auditar:**
    -   `productos` (cambios en nombre, SKU, costos, etc.)
    -   `precios_productos` (cambios en precios y márgenes)
    -   `clientes`
    -   `proveedores`
    -   `sucursales`
    -   `usuarios` (cambios de rol, sucursal, etc.)
    -   `gastos`
    -   `ventas` (principalmente para `UPDATE` de estado de pago)
    -   `compras` (principalmente para `UPDATE` de estado de pago)

-   **Ejemplo de Aplicación:**
    ```sql
    CREATE TRIGGER on_productos_change
    AFTER INSERT OR UPDATE OR DELETE ON public.productos
    FOR EACH ROW EXECUTE FUNCTION public.registrar_cambio();
    ```

## 3. Interfaz de Usuario (Frontend)

Se creará una nueva página dedicada, accesible solo para roles de Propietario y Administrador.

### 3.1. Nueva Página: `AuditoriaPage.tsx`

-   **Acceso:** Se añadirá un nuevo enlace en la barra lateral, posiblemente bajo "Configuración" o una nueva sección "Seguridad".
-   **Diseño:** La página presentará un **"Timeline de Actividad"** vertical, mostrando los cambios más recientes primero. Cada entrada será un resumen conciso del cambio.

### 3.2. Componentes de la UI

-   **`FilterBar` de Auditoría:** Una barra de filtros potente será esencial para navegar el historial. Permitirá filtrar por:
    -   Rango de fechas.
    -   Usuario específico.
    -   Tipo de entidad (ej. "Productos", "Clientes").
    -   Tipo de acción ("Creación", "Modificación", "Eliminación").
-   **`AuditEntry.tsx`:** Componente para cada ítem en el timeline. Mostrará:
    -   Icono representativo de la acción.
    -   Mensaje resumido (ej. "Juan Pérez actualizó el producto 'Laptop Gamer'").
    -   Avatar del usuario y timestamp.
    -   Un botón "Ver Detalles".
-   **`AuditDetailModal.tsx`:** Al hacer clic en "Ver Detalles", se abrirá este modal que mostrará:
    -   La información completa del evento (usuario, fecha, tabla, ID del registro).
    -   Una **vista de "diferencias" (diff)**, comparando `datos_anteriores` y `datos_nuevos` lado a lado.
    -   Se resaltarán visualmente los campos específicos que cambiaron, mostrando el valor antiguo y el nuevo.

### 3.3. Lógica de Datos en Frontend

-   Se creará una nueva función RPC, `get_historial_cambios(filtros)`, que permitirá al frontend solicitar el historial de forma paginada y aplicando los filtros seleccionados por el usuario.

## 4. Seguridad y Rendimiento

-   **Seguridad:** La tabla `historial_cambios` tendrá su propia política RLS basada en `empresa_id = public.get_empresa_id_from_jwt()`, asegurando que los usuarios de una empresa no puedan ver el historial de otra.
-   **Rendimiento:**
    -   Los triggers en PostgreSQL son extremadamente rápidos. El impacto en las operaciones de escritura será imperceptible para el usuario.
    -   Se crearán índices en la tabla `historial_cambios` sobre las columnas `empresa_id`, `timestamp`, `usuario_id` y `tabla_afectada` para garantizar que las consultas de filtrado sean muy eficientes, incluso cuando la tabla crezca.
    -   Para empresas con un volumen de transacciones extremadamente alto, se puede considerar la partición de la tabla por fecha como una optimización a futuro.
