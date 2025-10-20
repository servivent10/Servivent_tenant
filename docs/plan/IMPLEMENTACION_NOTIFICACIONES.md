
# Plan de Implementación: Sistema de Notificaciones Inteligentes V2

## 1. Visión y Objetivo

Implementar el sistema de notificaciones contextuales y proactivas descrito en `docs/plan/NOTIFICACIONES_INTELIGENTES.md`. Esto incluye alertas de stock bajo, mensajes más descriptivos, enlaces de acción inteligentes y la unificación de la lógica de backend para eliminar duplicaciones y mejorar la mantenibilidad del sistema.

---

## Fases de Implementación

### Fase 1: Unificación y Refactorización del Backend (Fuente Única de Verdad)

-   **Objetivo:** Consolidar las múltiples versiones de funciones RPC (`registrar_venta`, `registrar_compra`) en una única versión definitiva y correcta, aplicando el principio de Fuente Única de Verdad (SSOT).
-   **Acciones:**
    1.  Se identificará la versión más completa y correcta de cada función transaccional (ej. `registrar_compra` de `31_FEATURE_compras_distribucion.md` que incluye la lógica de distribución y el fix de zona horaria).
    2.  Se centralizará la lógica de generación de notificaciones dentro de estas versiones unificadas, asegurando que cualquier llamada a estas funciones genere la notificación correcta.
    3.  Se actualizarán los scripts SQL correspondientes para reflejar esta unificación.

### Fase 2: Implementación de Lógica de Notificaciones en Backend

-   **Objetivo:** Modificar las funciones RPC unificadas para generar los mensajes, tipos de evento y destinos correctos según el plan de `NOTIFICACIONES_INTELIGENTES.md`.
-   **Acciones:**
    1.  **`registrar_venta`:**
        -   Se añadirá lógica para verificar si `stock_nuevo <= stock_minimo` después de cada actualización de inventario.
        -   Se recopilará una lista de productos que entren en stock bajo durante la transacción.
        -   Se implementará la lógica para generar `PRODUCTO_STOCK_BAJO` (con SKU en el mensaje) si es un solo producto, o `MULTIPLE_PRODUCTOS_STOCK_BAJO` si son varios.
        -   Se mejorará el mensaje del evento `NUEVA_VENTA` para ser más descriptivo.
    2.  **`registrar_traspaso` y `confirmar_recepcion_traspaso`:** Se ajustará la lógica para que las notificaciones se envíen tanto a la sucursal de origen como a la de destino.
    3.  **`upsert_product`, `upsert_client`, etc.:** Se añadirá la llamada a `notificar_cambio` con `sucursales_destino_ids = NULL` para generar notificaciones globales (visibles para el Propietario).
    4.  **`registrar_pedido_web`:** Se actualizará la lógica para diferenciar entre `NUEVO_PEDIDO_RETIRO` (notificación a sucursal específica) y `NUEVO_PEDIDO_ENVIO` (notificación global), con mensajes claros y contextuales.

### Fase 3: Implementación de Navegación Contextual en Frontend

-   **Objetivo:** Hacer que el frontend entienda los nuevos tipos de notificación y genere enlaces inteligentes que apliquen filtros automáticamente.
-   **Acciones (en `DashboardLayout.tsx`):**
    1.  Se modificará la función `getNotificationLink`.
    2.  Se añadirán nuevas sentencias `case` para los nuevos tipos de evento:
        -   **`PRODUCTO_STOCK_BAJO`:** Se extraerá el SKU del mensaje de la notificación y se generará un enlace `#/inventarios?search=[SKU]`.
        -   **`MULTIPLE_PRODUCTOS_STOCK_BAJO`:** Se generará un enlace `#/inventarios?status=low_stock`.
    3.  Se verificarán y ajustarán los enlaces para el resto de los eventos (`NUEVO_PRODUCTO`, etc.) para asegurar que lleven al lugar correcto.

### Fase 4: Verificación y Entrega

-   **Objetivo:** Revisar todos los cambios para garantizar la coherencia, la calidad y el cumplimiento de la solicitud.
-   **Acciones:**
    1.  Verificar que todos los archivos modificados (frontend y backend) son consistentes entre sí.
    2.  Confirmar que la lógica duplicada ha sido eliminada.
    3.  Preparar la respuesta final en formato XML con la explicación detallada de los cambios.
