# Contexto y Especificación: Módulos de Productos e Inventarios

Este documento define la arquitectura, diseño y funcionalidad de los módulos de "Productos" e "Inventarios" para ServiVENT. Ambos módulos están diseñados para estar separados lógicamente pero profundamente integrados en la interfaz para una gestión fluida.

## 1. Objetivo de los Módulos

*   **Módulo de Productos (El "Qué"):** Actuará como el **catálogo maestro digital** de la empresa. Centralizará toda la información descriptiva y de precios de los artículos (nombre, marca, SKU, fotos).
*   **Módulo de Inventarios (El "Cuántos" y "Dónde"):** Será el sistema de **control de existencias (stock) en tiempo real**. Su única función es registrar la cantidad exacta de cada producto disponible en cada una de las sucursales.

## 2. Arquitectura y Nuevos Archivos

*   **Páginas:**
    *   `src/pages/Tenant/ProductosPage.tsx`: Página principal para listar y buscar todos los productos.
    *   `src/pages/Tenant/ProductoDetailPage.tsx`: Página para ver los detalles de un producto, incluyendo su galería, desglose de inventario y la nueva gestión de precios.
*   **Modales:**
    *   `src/components/modals/ProductFormModal.tsx`: Para crear y editar la información de los productos.
*   **Base de Datos:**
    *   `PRODUCTOS_FUNCTIONS.md`: Archivo con los nuevos scripts SQL.
    *   `DATABASE_SCHEMA.md`: Se actualizará para reflejar las nuevas tablas.
*   **Navegación:** Se actualizarán `App.tsx` y `src/pages/Tenant/tenantLinks.ts`.

## 3. Diseño de la Base de Datos

### Tablas Principales

1.  **`categorias`**: (Sin cambios)

2.  **`productos`**:
    | Columna | Tipo | Descripción |
    | --- | --- | --- |
    | `id` | `uuid` | PK, Identificador único. |
    | `empresa_id` | `uuid` | FK, A qué empresa pertenece. |
    | `nombre` | `text` | Nombre del producto. |
    | `sku` | `text` | Código único de producto (SKU). **Único por empresa.** |
    | `marca` | `text` | Marca del producto. |
    | `modelo` | `text` | Modelo específico. |
    | `descripcion` | `text` | Descripción detallada (opcional). |
    | `precio_compra`| `numeric`| **NUEVO:** Almacena el **Costo Promedio Ponderado (CAPP)**. Es un valor calculado, no editable directamente. |
    | `categoria_id` | `uuid` | FK, Enlace a `categorias`. |
    | `unidad_medida`| `text` | (ej. "Unidad", "Caja", "Kg"). |
    | `created_at` | `timestamptz`| Fecha de creación. |
    | `precio_venta`| `numeric`| **(ELIMINADO)** - Se gestiona a través de `precios_productos`. |

3.  **`imagenes_productos`**: (Sin cambios)

4.  **`inventarios`**: (Sin cambios)

### NUEVO: Tablas para Gestión de Precios

5.  **`listas_precios`**:
    | Columna | Tipo | Descripción |
    | --- | --- | --- |
    | `id` | `uuid` | PK, Identificador único. |
    | `empresa_id`| `uuid` | FK, A qué empresa pertenece. |
    | `nombre` | `text` | Nombre de la lista (ej. "Mayorista"). |
    | `descripcion`| `text` | Descripción opcional. |
    | `es_predeterminada` | `boolean` | `true` para la lista "General". |
    | `orden` | `integer` | **NUEVO:** Posición de la lista para ordenamiento manual. |
    | `created_at` | `timestamptz`| Fecha de creación. |

6.  **`precios_productos`**:
    | Columna | Tipo | Descripción |
    | --- | --- | --- |
    | `id` | `uuid` | PK, Identificador único. |
    | `producto_id` | `uuid` | FK, El producto al que se le asigna precio. |
    | `lista_precio_id` | `uuid` | FK, La lista de precios aplicada. |
    | `precio` | `numeric` | El precio de venta para esa combinación. |
    | `updated_at` | `timestamptz`| Última actualización. |

### Funciones RPC Propuestas (`PRODUCTOS_FUNCTIONS.md`)

*   `get_company_products_with_stock()`: Obtendrá todos los productos y su **precio base** (de la lista general).
*   `get_product_details()`: Obtendrá la info de un producto, su galería, inventario, CAPP y **todos sus precios** de las diferentes listas.
*   `upsert_product()`: Función para crear/actualizar productos, ahora recibe `p_precio_base`.
*   `delete_product()`: Para eliminar un producto.
*   `get_price_lists()`: Obtiene todas las listas de precios de la empresa.
*   `upsert_price_list()`: Para crear o editar una lista de precios.
*   `delete_price_list()`: Para eliminar una lista de precios (excepto la general).
*   `update_product_prices()`: Actualiza todos los precios de un producto para las diferentes listas en una sola llamada.
*   `update_price_list_order()`: **(NUEVA)** Guarda el nuevo orden manual de las listas de precios.

## 4. Diseño y Experiencia de Usuario (UI/UX)

### Página de Lista de Productos (`ProductosPage.tsx`)

*   **Visualización:** Las tarjetas y la tabla ahora muestran el **Precio Base (General)** del producto.

### Página de Detalle de Producto (`ProductoDetailPage.tsx`)

*   **Pestañas de Información:**
    1.  **Inventario:** (Sin cambios) Muestra el stock por sucursal.
    2.  **Precios y Costos (NUEVA):**
        *   Muestra el **Costo Promedio Ponderado (CAPP)** como un valor de solo lectura, proporcionando una visión clara de la rentabilidad del artículo.
        *   Presenta una **tabla de precios editable** que muestra cada una de las **Listas de Precios** de la empresa (ej. "Mayorista", "Catálogo Web", etc.).
        *   **Beneficio Estratégico:** Desde aquí, el usuario puede introducir y guardar un precio de venta específico para cada lista. Esto permite implementar estrategias comerciales avanzadas, como ofrecer precios más bajos a clientes mayoristas, tener un precio diferente para la venta online o crear listas de precios temporales para ofertas especiales, todo gestionado desde un único lugar.
    3.  **Detalles:** Muestra la información descriptiva (marca, modelo, categoría, etc.).

### Página de Configuración (`ConfiguracionPage.tsx`)

*   **Nueva Pestaña "Listas de Precios":**
    *   Permite a los propietarios **crear, ver, editar y eliminar** sus diferentes listas de precios.
    *   **NUEVO:** Permite **reordenar las listas** mediante "arrastrar y soltar" (drag and drop) para definir su prioridad o visualización en otras partes del sistema.

## 5. Funcionamiento del Costo Promedio Ponderado (CAPP)

*   El campo `precio_compra` en la tabla `productos` ya no es editable manualmente en el formulario del producto.
*   En el futuro, cuando se registre una **Compra**, una función de base de datos calculará automáticamente el nuevo CAPP y actualizará este campo, asegurando que el costo del inventario sea siempre preciso.
    *   **Fórmula:** `Nuevo CAPP = ((Stock Actual * CAPP Actual) + (Cantidad Comprada * Costo de Compra)) / (Stock Actual + Cantidad Comprada)`