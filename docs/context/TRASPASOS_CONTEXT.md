# MÓDULO 06: OPERACIONES
## Traspasos

Este documento define la arquitectura y funcionalidad del módulo de **Traspasos**, diseñado para permitir la transferencia de stock de productos entre las diferentes sucursales de la empresa a través de un flujo auditable de dos pasos.

## 1. Objetivo del Módulo

-   Proporcionar a los Propietarios y Administradores una herramienta para **enviar** inventario desde una sucursal de origen a una de destino.
-   Permitir a los usuarios de la sucursal de destino **confirmar la recepción** de la mercancía, actualizando su propio stock.
-   Asegurar que cada traspaso sea una operación transaccional y auditable, registrando quién envía, quién recibe y cuándo ocurren ambas acciones.
-   Mantener un historial completo de todos los movimientos de inventario entre sucursales, con estados claros ("En Camino", "Recibido").
-   Integrarse con el sistema de tiempo real para notificar a los usuarios relevantes sobre el envío y la recepción de traspasos.

## 2. Flujo de Usuario y Páginas

-   **`TraspasosPage.tsx` (Página de Listado):**
    -   Es la página principal del módulo, accesible solo para Propietarios y Administradores.
    -   Muestra KPIs relevantes y un historial de todos los traspasos con su estado actual.
    -   Un botón "Nuevo Traspaso" dirige al usuario al asistente de creación.

-   **`NuevoTraspasoPage.tsx` (Asistente de Creación):**
    -   Un asistente de 3 pasos guía al usuario para **iniciar un envío**:
        1.  **Origen y Destino:** Se selecciona la sucursal que envía y la que recibe.
        2.  **Selección de Productos:** Un buscador muestra solo productos con stock en la **sucursal de origen**. El usuario define la cantidad a traspasar.
        3.  **Confirmación:** Se muestra un resumen antes de procesar el envío. Al confirmar, el traspaso se crea con estado "En Camino".

-   **`TraspasoDetailPage.tsx` (Página de Detalle y Recepción):**
    -   Muestra toda la información de un traspaso: folio, sucursales, fechas, y productos.
    -   **Funcionalidad Interactiva:** Si el usuario actual pertenece a la sucursal de destino y el traspaso está "En Camino", verá un botón para **"Confirmar Recepción de Mercancía"**.
    -   **Auditoría:** Muestra claramente quién envió y quién recibió el traspaso, junto con las fechas de cada acción.

## 3. Lógica de Backend (Funciones RPC)

El proceso se divide en dos funciones transaccionales clave:

-   **`registrar_traspaso()`:** Gestiona el **envío**.
    1.  Valida permisos y stock en origen.
    2.  Crea el registro de `traspasos` con estado **"En Camino"** y la información del usuario que envía.
    3.  **Resta el stock** de la tabla `inventarios` para la sucursal de **origen**.
    4.  Crea un movimiento de auditoría de "Salida por Traspaso" en `movimientos_inventario`.
    5.  Genera una notificación en tiempo real de `TRASPASO_ENVIADO`.

-   **`confirmar_recepcion_traspaso()`:** Gestiona la **recepción**.
    1.  Valida que el usuario pertenezca a la sucursal de destino y que el traspaso esté "En Camino".
    2.  Actualiza el estado del traspaso a **"Recibido"** y registra al usuario y la fecha de recepción.
    3.  **Suma el stock** a la tabla `inventarios` para la sucursal de **destino**.
    4.  Crea un movimiento de auditoría de "Entrada por Traspaso".
    5.  Genera una notificación en tiempo real de `TRASPASO_RECIBIDO`.

-   **Otras Funciones:** `get_traspasos_data`, `get_data_for_new_traspaso`, `get_products_for_traspaso(p_sucursal_id)`, `get_traspaso_details(p_traspaso_id)`.