# MÓDULO 05: CATÁLOGO Y GESTIÓN DE PRODUCTOS
## Productos

Este documento define la arquitectura y funcionalidad del módulo de **Productos**, que actúa como el **catálogo maestro digital** de la empresa. Su objetivo es centralizar toda la información descriptiva, de costos y de precios de los artículos, y facilitar un flujo de carga inicial de inventario rápido y auditable.

## 1. Visión y Objetivo del Módulo

-   **Centralización:** Gestionar la información fundamental de cada producto: nombre, SKU, marca, modelo, descripción, unidad de medida y categoría.
-   **Gestión Visual:** Administrar la galería de imágenes de cada producto.
-   **Flexibilidad de Precios:** Definir y gestionar múltiples **listas de precios** para implementar estrategias comerciales (ej. precios mayoristas, ofertas). Esta funcionalidad depende de que el plan de la empresa la tenga activada.
-   **Onboarding Simplificado:** Facilitar una configuración inicial ultra-rápida para nuevos productos, permitiendo definir costo, precio y stock inicial en todas las sucursales desde una única interfaz (`InitialSetupModal`).
-   **Claridad Contable:** Visualizar el **Costo Promedio Ponderado (CAPP)**, que es un valor calculado automáticamente por el módulo de Compras. El `costo_inicial` sirve como base para el CAPP hasta que se realice la primera compra real del producto.

## 2. Flujos de Carga de Inventario

Se han diseñado dos flujos de trabajo claros y eficientes para que las nuevas empresas puedan registrar su inventario existente.

### Flujo 1: Configuración Inicial Rápida (Recomendado)

Este es el nuevo flujo optimizado para productos sin historial de ventas o compras.

1.  **Crear Producto:** La empresa crea un nuevo producto (manualmente o por importación), dejando los campos de costo y precio en blanco si lo desea.
2.  **Activar Configuración Rápida:** En la `ProductosPage`, los productos "vírgenes" (sin historial) mostrarán un icono de rayo (`⚡`). Al hacer clic en él, se abre el `InitialSetupModal`.
3.  **Configuración Masiva:** Dentro del modal, el usuario establece de una sola vez:
    *   El **Costo Inicial** del producto (que se guardará como su CAPP base).
    *   El **Precio de Venta Base**.
    *   La **Cantidad Inicial** y el **Stock Mínimo** para **cada una de las sucursales** de la empresa.
4.  **Guardar y Auditar:** Al guardar, la función RPC `set_initial_product_setup` actualiza el costo, el precio y el inventario de forma transaccional, creando los registros correspondientes en `movimientos_inventario` con el motivo "Carga Inicial de Inventario".

### Flujo 2: Ajuste Manual (Para productos existentes)

Este flujo se utiliza para realizar ajustes continuos en productos que ya tienen un historial.

1.  **Navegar al Producto:** El usuario va a la `ProductoDetailPage`.
2.  **Ajustar Stock:** En la pestaña "Inventario", utiliza la función de "Ajustar Stock" para modificar la cantidad en una sucursal específica, seleccionando el motivo adecuado (ej. "Error de conteo", "Pérdida").

## 3. Páginas y Componentes Clave

-   **`ProductosPage.tsx`:** Página principal que muestra el listado de productos. Ahora incluye el icono de rayo (`⚡`) en los productos sin historial para activar el `InitialSetupModal`.

-   **`ProductoDetailPage.tsx`:** Página de detalle de un producto, organizada en pestañas. Permite la gestión continua del inventario y precios.

-   **`ProductFormModal.tsx`:** Modal para crear/editar productos. Incluye los campos "Costo Inicial" y "Precio de Venta Base" (visibles en modo creación/edición sin historial).

-   **`InitialSetupModal.tsx`:** Modal de "Configuración Inicial Rápida". Se activa desde `ProductosPage` para productos sin historial. Permite establecer de forma masiva el costo, precio base, y el stock inicial y mínimo en todas las sucursales.

-   **`ProductImportModal.tsx`:** Modal para la importación masiva. La plantilla CSV incluye las columnas opcionales `costo_inicial` y `precio_base`.

-   **`CategoryManagerModal.tsx`:** Modal para la gestión centralizada de categorías de productos.

## 4. Lógica de Backend (Funciones RPC)

-   **`get_company_products_with_stock_and_cost()`:** Obtiene la lista de productos y ahora devuelve dos nuevos flags booleanos: `has_sales` y `has_purchases`, que el frontend utiliza para decidir si muestra el icono de configuración rápida.
-   **`get_product_details()`:** Obtiene la información completa de un producto.
-   **`upsert_product()`:** Función para crear/editar productos. Al crear, si se proporcionan `p_costo_inicial` y `p_precio_base`, establece el CAPP inicial y el precio de venta por defecto.
-   **`set_initial_product_setup()`:** **(NUEVO)** Función transaccional que recibe el costo, precio y una lista de ajustes de inventario por sucursal. Valida que el producto no tenga historial, actualiza el `precio_compra` (CAPP), la regla de precio 'General', e inserta los registros de `inventarios` y `movimientos_inventario` correspondientes.
-   **`delete_product()`:** Bloquea la eliminación si el producto tiene historial de ventas o compras.
-   **`update_product_prices()`:** Actualiza los precios de un producto.
-   **`import_products_in_bulk()`:** Procesa la importación masiva, incluyendo ahora `costo_inicial` y `precio_base`.