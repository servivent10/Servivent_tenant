# Plan de Implementación: Sistema de Notificaciones Inteligentes

## 1. Visión y Objetivo

El objetivo es transformar el sistema de notificaciones de ServiVENT en una herramienta proactiva e inteligente. Las notificaciones no solo deben informar sobre eventos, sino también alertar sobre situaciones críticas (como el stock bajo) y proporcionar acciones directas que agilicen la gestión del usuario.

## 2. Arquitectura de Backend (El Cerebro)

La arquitectura se basará en la lógica existente, pero se refinará para generar notificaciones más contextuales y específicas.

### 2.1. Tabla `notificaciones` (Estructura Final)

Se mantendrá la estructura actual, que es robusta y flexible. Las columnas clave son:
-   `id`, `empresa_id`, `created_at`
-   `mensaje`: El texto descriptivo y coherente de la notificación.
-   `tipo_evento`: Un código interno (ej. `NUEVA_VENTA`, `PRODUCTO_STOCK_BAJO`) que el frontend usará para la iconografía y la lógica de navegación.
-   `entidad_id`: El `uuid` del registro principal relacionado (una venta, un producto, etc.).
-   `sucursales_destino_ids`: El array de `uuid` que define a qué sucursales notificar. Si es `NULL`, es una notificación global para el Propietario.

### 2.2. Lógica de Generación de Notificaciones

La inteligencia reside en **dónde y cómo** se generan las notificaciones. La función `notificar_cambio()` seguirá siendo el despachador, pero la lógica para llamarla se integrará en las funciones de negocio.

#### Alertas de Stock Bajo (Nueva Implementación)

Después de cualquier operación que modifique el inventario, se verificará el estado del stock.

1.  **En `registrar_venta()` y `registrar_traspaso()` (para la sucursal de origen):**
    -   Después de descontar el stock de cada producto, se ejecutará una comprobación: `IF nuevo_stock <= stock_minimo THEN ...`.
    -   Si un producto cruza el umbral de stock bajo, se llamará a `notificar_cambio()` con el evento `PRODUCTO_STOCK_BAJO`, el `producto_id` como `entidad_id` y el `sucursal_id` de la sucursal afectada.

2.  **Notificación de Múltiples Productos (Inteligencia Agregada):**
    -   Para evitar "spam" de notificaciones en ventas grandes, la función `registrar_venta()` recopilará una lista de todos los productos que entraron en stock bajo durante esa transacción.
    -   Si la lista contiene **más de un producto**, en lugar de enviar notificaciones individuales, se enviará una única notificación con el tipo `MULTIPLE_PRODUCTOS_STOCK_BAJO` y la `venta_id` como `entidad_id`. Esto le indicará al frontend que debe mostrar un mensaje genérico y enlazar a una vista filtrada.

## 3. Lógica de Frontend (La Acción)

La inteligencia en el frontend se centrará en la navegación contextual al hacer clic en una notificación.

### Componente `DashboardLayout.tsx`

La función `getNotificationLink()` se expandirá para generar enlaces con parámetros de consulta (`query params`), que las páginas de destino podrán interpretar para aplicar filtros.

-   **Notificaciones Simples:** (Ej: `NUEVA_VENTA`) seguirán generando un enlace directo: `#/ventas/{entidad_id}`.
-   **Notificaciones de Stock Bajo (NUEVO):**
    -   Para `PRODUCTO_STOCK_BAJO`: Generará un enlace como `#/inventarios?search=[SKU_del_producto]`. La página de inventarios leerá el parámetro `search` y filtrará la lista automáticamente.
    -   Para `MULTIPLE_PRODUCTOS_STOCK_BAJO`: Generará un enlace como `#/inventarios?status=low_stock`. La página de inventarios leerá el parámetro `status` y aplicará el filtro de "Bajo Stock".

## 4. Catálogo Detallado de Eventos y Mensajes

Esta tabla resume la implementación completa, incluyendo tus últimas sugerencias.

| Área del Sistema | Evento (Código Interno) | Mensaje de Notificación (Ejemplo Coherente) | Quiénes Serán Notificados (Lógica de Destino) | Enlace de Acción (Frontend) |
| :--- | :--- | :--- | :--- | :--- |
| **Ventas / Gastos**| `NUEVA_VENTA` / `NUEVO_GASTO` | `Nueva venta de Bs 150.00 registrada en tu sucursal.` | **Solo la sucursal de la operación.** | `#/ventas/[venta_id]` |
| **Compras** | `NUEVA_COMPRA` | `Se recibió mercancía del proveedor 'Proveedor A' en tu sucursal.` | **Todas las sucursales que reciben stock.** | `#/compras/[compra_id]` |
| **Traspasos** | `TRASPASO_ENVIADO` | `Se enviaron 25 productos desde 'Suc. Central' hacia tu sucursal.` | **La sucursal de ORIGEN y la de DESTINO.** | `#/traspasos/[traspaso_id]` |
| | `TRASPASO_RECIBIDO` | `Se recibieron los 25 productos del traspaso desde 'Suc. Central'.` | **La sucursal de ORIGEN y la de DESTINO.** | `#/traspasos/[traspaso_id]` |
| **Inventario** | `PRODUCTO_STOCK_BAJO` | `El producto 'Laptop Gamer' tiene stock bajo (3 unidades) en tu sucursal.` | **Solo la sucursal del ajuste.** | `#/inventarios?search=[SKU]` |
| | `MULTIPLE_PRODUCTOS_STOCK_BAJO`| `Varios productos con stock bajo tras la venta VENTA-00125.` | **Solo la sucursal del ajuste.** | `#/inventarios?status=low_stock` |
| **Productos, Proveedores**| `NUEVO_PRODUCTO`, etc. | `El usuario 'Juan Pérez' ha creado el nuevo producto 'Teclado Mecánico'.` | **TODAS las sucursales (`NULL`).** | `#/productos/[producto_id]` |
| **Usuarios, Clientes** | `NUEVO_CLIENTE`, etc. | `Se ha registrado un nuevo cliente: 'Cliente Importante SA'.` | **TODAS las sucursales (`NULL`).** | `#/clientes` |
| **Catálogo Web** | `NUEVO_PEDIDO_RETIRO` | `Nuevo pedido web para retiro en tu sucursal (Folio: VENTA-00123).` | **Solo la sucursal de retiro.** | `#/ventas/[venta_id]` |
| | `NUEVO_PEDIDO_ENVIO` | `Nuevo pedido web para envío a domicilio (Folio: VENTA-00124).` | **TODAS las sucursales (`NULL`).** | `#/ventas/[venta_id]` |

---

Este plan unificado implementa una solución de notificaciones verdaderamente inteligente, contextual y accionable. Una vez que me des tu aprobación sobre este documento, procederé con la implementación técnica.
