# MÓDULO 06: OPERACIONES
## Traspasos

Este documento define la arquitectura y funcionalidad del módulo de **Traspasos**, diseñado para permitir la transferencia de stock de productos entre las diferentes sucursales de la empresa.

## 1. Objetivo del Módulo

-   Proporcionar a los Propietarios y Administradores una herramienta para mover inventario de una sucursal de origen a una de destino.
-   Asegurar que cada traspaso sea una operación transaccional que actualice el stock en ambas sucursales de forma atómica.
-   Mantener un historial completo y auditable de todos los movimientos de inventario entre sucursales.
-   Integrarse con el sistema de tiempo real para que los cambios de stock se reflejen instantáneamente en toda la aplicación.

## 2. Flujo de Usuario y Páginas

-   **`TraspasosPage.tsx` (Página de Listado):**
    -   Es la página principal del módulo, accesible solo para Propietarios y Administradores.
    -   Muestra KPIs relevantes como el total de traspasos del mes y el producto más movido.
    -   Presenta un historial de todos los traspasos en una vista responsiva (tabla en escritorio, tarjetas en móvil).
    -   Un botón "Nuevo Traspaso" dirige al usuario al asistente de creación.

-   **`NuevoTraspasoPage.tsx` (Asistente de Creación):**
    -   Un asistente de 3 pasos guía al usuario:
        1.  **Origen y Destino:** Se selecciona la sucursal que envía y la que recibe, junto con la fecha y notas opcionales.
        2.  **Selección de Productos:** Un buscador de productos inteligente muestra únicamente los artículos con stock en la **sucursal de origen**. El usuario añade productos y define la cantidad a traspasar, con validación en tiempo real para no exceder el stock disponible.
        3.  **Confirmación:** Se muestra un resumen completo del traspaso antes de procesarlo.

-   **`TraspasoDetailPage.tsx` (Página de Detalle):**
    -   Una vista de solo lectura que muestra toda la información de un traspaso ya realizado: folio, sucursales, fecha, usuario que lo realizó y un listado detallado de los productos y cantidades transferidas.

## 3. Lógica de Backend (Funciones RPC)

-   **`registrar_traspaso()`:** Es la función transaccional principal. Al ejecutarse, realiza las siguientes acciones de forma atómica:
    1.  Valida que el usuario tenga permisos (Propietario o Administrador).
    2.  Valida por última vez que la sucursal de origen tenga stock suficiente para cada producto.
    3.  Crea un nuevo registro en la tabla `traspasos` y los registros correspondientes en `traspaso_items`.
    4.  **Actualiza el inventario:** Resta la cantidad de la tabla `inventarios` para la sucursal de origen y la suma para la sucursal de destino.
    5.  **Crea un registro de auditoría:** Inserta dos movimientos en la tabla `movimientos_inventario`: uno de "Salida por Traspaso" en el origen y otro de "Entrada por Traspaso" en el destino.

-   **`get_traspasos_data()`:** Obtiene el historial de traspasos y los datos para los KPIs de la página principal.
-   **`get_data_for_new_traspaso()`:** Obtiene la lista de sucursales para el formulario de nuevo traspaso.
-   **`get_products_for_traspaso(p_sucursal_id)`:** Obtiene la lista de productos con su stock disponible *únicamente* en la sucursal de origen especificada.
-   **`get_traspaso_details(p_traspaso_id)`:** Recupera toda la información para la página de detalle.