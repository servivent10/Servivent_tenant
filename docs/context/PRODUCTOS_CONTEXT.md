# MÓDULO 05: CATÁLOGO
## Productos

Este documento define la arquitectura y funcionalidad del módulo de **Productos**, que actúa como el **catálogo maestro digital** de la empresa. Su objetivo es centralizar toda la información descriptiva y de precios de los artículos.

## 1. Objetivo del Módulo

-   Gestionar la información fundamental de cada producto: nombre, SKU, marca, modelo, descripción, unidad de medida y categoría.
-   Administrar la galería de imágenes de cada producto.
-   Definir y gestionar múltiples **listas de precios** para implementar estrategias comerciales flexibles (ej. precios mayoristas, ofertas, etc.).
-   Visualizar el **Costo Promedio Ponderado (CAPP)**, que es un valor calculado automáticamente por el módulo de Compras.

## 2. Páginas y Componentes Clave

-   **`ProductosPage.tsx`:** Página principal que muestra el listado completo de productos. Incluye:
    -   KPIs sobre el estado general del catálogo.
    -   Una barra de filtros con búsqueda por texto y un panel de filtros avanzados por categoría y marca.
    -   Un sistema de visualización responsivo (tarjetas en móvil, tabla en escritorio).
    -   Acciones para añadir, importar/exportar productos y gestionar categorías.

-   **`ProductoDetailPage.tsx`:** Página de detalle de un producto específico, organizada en pestañas:
    -   **Inventario:** Muestra el stock del producto en cada sucursal (gestionado por el módulo de Inventarios).
    -   **Precios y Costos:** Panel para gestionar los precios de venta del producto para cada una de las `listas_precios` de la empresa. Muestra el CAPP como valor de solo lectura.
    -   **Detalles:** Muestra la información descriptiva del producto.

-   **`ProductFormModal.tsx`:** Modal para crear y editar la información de los productos.
-   **`CategoryManagerModal.tsx`:** Modal para gestionar las categorías de productos.

## 3. Lógica de Backend (Funciones RPC)

-   **`get_company_products_with_stock_and_cost()`:** Obtiene todos los productos con su stock y precio base para la `ProductosPage`.
-   **`get_product_details()`:** Obtiene toda la información de un producto, incluyendo su galería, inventario y todos sus precios asignados.
-   **`upsert_product()`:** Función para crear o actualizar productos.
-   **`delete_product()`:** Elimina un producto, bloqueando la acción si tiene un historial de ventas o compras.
-   **`update_product_prices()`:** Actualiza todos los precios de un producto para las diferentes listas.
-   **`import_products_in_bulk()`:** Procesa la importación masiva de productos desde un archivo CSV.
