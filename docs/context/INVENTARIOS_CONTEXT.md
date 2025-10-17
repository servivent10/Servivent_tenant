# MÓDULO 05: CATÁLOGO
## Inventarios

Este documento define la arquitectura y funcionalidad del módulo de **Inventarios**. Mientras que "Productos" es el catálogo (el "qué"), Inventarios es el sistema de **control de existencias** (el "cuántos" y "dónde").

## 1. Objetivo del Módulo

-   Proporcionar una vista en tiempo real de la cantidad exacta de cada producto disponible en cada sucursal.
-   Permitir a los administradores realizar **ajustes manuales de stock**, especificando un motivo claro para cada ajuste (ej. "Carga Inicial de Inventario", "Pérdida", "Error de conteo").
-   Permitir la definición de un **stock mínimo de alerta** para cada producto en cada sucursal, haciendo que las alertas de "Bajo Stock" sean precisas y personalizables.
-   Ofrecer KPIs y filtros para una supervisión eficiente del valor y estado del inventario.

## 2. Página Clave: `InventariosPage.tsx`

-   **KPIs:** Muestra tarjetas con el valor total del inventario (calculado al costo), el número de productos con bajo stock y el número de productos agotados.
-   **Filtrado Avanzado:** Permite buscar productos por texto (nombre, SKU) y filtrar por estado de stock, categoría y marca.
-   **Visualización Responsiva:**
    -   **Escritorio:** Una tabla muestra cada producto con su costo, stock total, valor de inventario y estado. Una fila expandible permite ver el desglose de stock por sucursal.
    -   **Móvil/Tablet:** Se utilizan tarjetas que resumen la información de cada producto, con un botón para expandir y ver el desglose por sucursal.

## 3. Funcionalidad de Ajuste de Inventario

-   En la `ProductoDetailPage`, la pestaña "Inventario" incluye un botón **"Ajustar Stock"** para cada sucursal (visible para Propietarios y Administradores).
-   Este botón abre el `InventoryAdjustModal`, donde el usuario puede:
    -   Ingresar una cantidad de ajuste (positiva para añadir, negativa para quitar).
    -   Definir o actualizar el **"Stock Mínimo de Alerta"** para ese producto en esa sucursal.
    -   Seleccionar un **"Motivo"** de un menú desplegable, que incluye la opción **"Carga Inicial de Inventario"**.
-   Al guardar, se invoca la función `ajustar_inventario_lote`.

## 4. Lógica de Backend

-   **Tabla `inventarios`:** Almacena la `cantidad` y ahora también el `stock_minimo` de un `producto_id` en una `sucursal_id` específica.
-   **Tabla `movimientos_inventario`:** Actúa como un libro de contabilidad (ledger) inmutable. Cada vez que el stock de un producto cambia (por venta, compra o ajuste), se inserta un nuevo registro aquí, incluyendo el `motivo` del ajuste.
-   **Función `get_company_products_with_stock_and_cost()`:** Obtiene la lista de productos con su stock total y stock en la sucursal del usuario actual.
-   **Función `ajustar_inventario_lote()`:** Función transaccional que:
    1.  Recibe el producto, los ajustes por sucursal y el motivo.
    2.  Actualiza la `cantidad` y el `stock_minimo` en la tabla `inventarios`.
    3.  Inserta un registro en `movimientos_inventario` de tipo "Ajuste", guardando el `motivo` proporcionado para una auditoría completa.