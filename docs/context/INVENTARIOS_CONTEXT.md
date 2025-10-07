# MÓDULO 05: CATÁLOGO
## Inventarios

Este documento define la arquitectura y funcionalidad del módulo de **Inventarios**. Mientras que "Productos" es el catálogo (el "qué"), Inventarios es el sistema de **control de existencias** (el "cuántos" y "dónde").

## 1. Objetivo del Módulo

-   Proporcionar una vista en tiempo real de la cantidad exacta de cada producto disponible en cada sucursal.
-   Permitir a los administradores realizar ajustes manuales de stock para corregir discrepancias (ej. por pérdidas o errores de conteo).
-   Ofrecer KPIs y filtros para una supervisión eficiente del valor y estado del inventario.

## 2. Página Clave: `InventariosPage.tsx`

-   **KPIs:** Muestra tarjetas con el valor total del inventario (calculado al costo), el número de productos con bajo stock y el número de productos agotados.
-   **Filtrado Avanzado:** Permite buscar productos por texto (nombre, SKU) y filtrar por estado de stock, categoría y marca.
-   **Visualización Responsiva:**
    -   **Escritorio:** Una tabla muestra cada producto con su costo, stock total, valor de inventario y estado. Una fila expandible permite ver el desglose de stock por sucursal.
    -   **Móvil/Tablet:** Se utilizan tarjetas que resumen la información de cada producto, con un botón para expandir y ver el desglose por sucursal.

## 3. Funcionalidad de Ajuste de Inventario

-   En la `ProductoDetailPage`, la pestaña "Inventario" ahora incluye un botón "Ajustar Stock" para cada sucursal (visible para Propietarios y Administradores).
-   Este botón abre el `InventoryAdjustModal`, donde el usuario puede:
    -   Ingresar una cantidad de ajuste (positiva para añadir, negativa para quitar).
    -   Ver el nuevo stock resultante.
    -   Proporcionar un motivo para el ajuste.
-   Al guardar, se invoca la función `ajustar_inventario_lote`.

## 4. Lógica de Backend

-   **Tabla `inventarios`:** Almacena la cantidad y el stock mínimo de un `producto_id` en una `sucursal_id` específica.
-   **Tabla `movimientos_inventario`:** Actúa como un libro de contabilidad (ledger) inmutable. Cada vez que el stock de un producto cambia (por venta, compra o ajuste), se inserta un nuevo registro aquí. Esto proporciona una trazabilidad completa de cada unidad.
-   **Función `get_company_products_with_stock_and_cost()`:** Obtiene la lista de productos con su stock total y stock en la sucursal del usuario actual.
-   **Función `ajustar_inventario_lote()`:** Función transaccional que:
    1.  Recibe el producto, la cantidad de ajuste y el motivo.
    2.  Actualiza la tabla `inventarios` con la nueva cantidad.
    3.  Inserta un registro en `movimientos_inventario` de tipo "Ajuste" para auditar el cambio.
