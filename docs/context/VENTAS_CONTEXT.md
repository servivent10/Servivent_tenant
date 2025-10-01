# Contexto y Especificación: Módulo de Ventas

Este documento define la arquitectura, diseño y funcionalidad del módulo de **Ventas**, una de las áreas más críticas de ServiVENT. Abarca desde la interfaz del Punto de Venta (POS) para el registro de transacciones hasta el historial detallado para el análisis de datos.

## 1. Objetivo del Módulo

-   **Punto de Venta (`TerminalVentaPage.tsx`):** Proporcionar una interfaz rápida, intuitiva y optimizada para pantallas táctiles que permita a los empleados registrar ventas de manera eficiente, aplicando dinámicamente diferentes políticas de precios y gestionando clientes.
-   **Historial de Ventas (`VentasPage.tsx`):** Ofrecer una herramienta potente para que los administradores y propietarios puedan buscar, filtrar y analizar el historial completo de ventas, obteniendo KPIs clave sobre el rendimiento del negocio.
-   **Detalle de Venta (`VentaDetailPage.tsx`):** Permitir la visualización detallada de una transacción específica, incluyendo los productos vendidos, los totales y la gestión de pagos para las ventas a crédito.

## 2. Páginas y Componentes Clave

-   **Páginas:**
    -   `src/pages/Tenant/TerminalVentaPage.tsx`: Interfaz principal del Punto de Venta.
    -   `src/pages/Tenant/VentasPage.tsx`: Vista de lista para el historial de ventas con filtros avanzados.
    -   `src/pages/Tenant/VentaDetailPage.tsx`: Vista de detalle para una venta individual.
-   **Modales:**
    -   `src/components/modals/CheckoutModal.tsx`: Modal para finalizar la venta, capturando el método de pago y el monto recibido.
    -   `src/components/modals/ClienteFormModal.tsx`: Permite crear o editar clientes directamente desde el POS.
-   **Base de Datos y Lógica:**
    -   `docs/sql_scripts/15_FEATURE_ventas.md`: Contiene los scripts SQL para las tablas `ventas`, `venta_items`, `pagos_ventas` y las funciones RPC correspondientes.

## 3. Flujo Funcional y UI/UX

### `TerminalVentaPage.tsx` (Punto de Venta)

Es el centro de operaciones para crear una nueva venta. Su diseño se optimiza para la velocidad y la facilidad de uso.

-   **Layout Responsivo:**
    -   **Escritorio:** Un layout de dos columnas donde el catálogo de productos ocupa el espacio principal y el carrito de venta se encuentra en una barra lateral fija.
    -   **Móvil/Tablet:** El catálogo de productos se muestra a pantalla completa. Un **botón flotante** con el ícono del carrito y un contador de artículos permite abrir el carrito como una barra lateral deslizable (`off-canvas`).
-   **Catálogo de Productos:**
    -   Muestra los productos en una cuadrícula de tarjetas (`ProductCard`).
    -   Incluye un buscador por SKU, nombre o modelo y un panel de filtros por categoría y marca.
    -   Los productos sin stock o sin precio asignado se muestran visualmente deshabilitados para prevenir errores.
-   **Gestión de Clientes y Precios:**
    -   Un **selector de clientes con búsqueda** (`SearchableSelect`) permite asociar la venta a un cliente existente o crear uno nuevo sobre la marcha.
    -   Un **selector de listas de precios** permite cambiar dinámicamente los precios aplicados a todos los productos del carrito, ideal para ventas mayoristas o promociones.
-   **Carrito de Venta (`CartPanel`):**
    -   Muestra cada producto añadido con su imagen, nombre y precio.
    -   Permite ajustar la cantidad, eliminar productos y aplicar un **precio unitario personalizado** (descuento manual) a un artículo específico.
    -   Calcula en tiempo real el subtotal, impuestos (configurable), un **descuento global** (limitado por el margen de ganancia total de los productos) y el total final.
-   **Finalización (`CheckoutModal`):**
    -   Al hacer clic en "Finalizar Venta", se abre un modal que resume el total.
    -   Permite seleccionar el **método de pago** (Efectivo, Tarjeta, QR).
    -   Permite definir el **tipo de venta** (Contado o Crédito). La opción de "Crédito" solo se habilita si se ha seleccionado un cliente.
    -   Calcula el cambio a devolver en ventas en efectivo.

### `VentasPage.tsx` (Historial de Ventas)

Esta página permite un análisis profundo del historial de transacciones.

-   **KPIs Dinámicos:** Muestra tarjetas con el total vendido, las cuentas por cobrar y el número de ventas a crédito. Estos valores **se recalculan en tiempo real** según los filtros aplicados.
-   **Sistema de Filtrado Avanzado:**
    -   **Filtros Rápidos:** Menús desplegables para filtrar por rango de fechas (hoy, este mes, etc.), estado de pago y tipo de venta.
    -   **Búsqueda Avanzada:** Un panel desplegable que revela filtros adicionales por:
        -   **Cliente:** Selector con búsqueda.
        -   **Vendedor:** Selector múltiple.
        -   **Sucursal:** Selector múltiple (solo para Propietarios).
        -   **Método de Pago:** Selector múltiple.
-   **Visualización de Datos:**
    -   **Escritorio:** Muestra las ventas en una tabla (`<table>`) con columnas clave.
    -   **Móvil/Tablet:** Adapta la visualización a una lista de tarjetas (`<cards>`), cada una resumiendo una venta para una mejor legibilidad en pantallas pequeñas.

### `VentaDetailPage.tsx` (Detalle de Venta)

Proporciona una vista completa de una sola transacción.

-   **Información General:** Muestra detalles clave como el folio, cliente, vendedor, fecha y condiciones de la venta.
-   **Lista de Productos:** Una tabla detalla cada producto vendido, incluyendo cantidad, precio unitario y subtotal.
-   **Desglose de Totales:** Un pie de tabla resume claramente el subtotal, descuento, impuestos y el total final de la venta.
-   **Gestión de Pagos (para Ventas a Crédito):**
    -   Si la venta tiene un saldo pendiente, se muestra un panel para la gestión de pagos.
    -   Muestra el historial de abonos realizados.
    -   Permite al usuario registrar nuevos abonos, especificando el monto y el método de pago. El sistema recalcula el saldo pendiente automáticamente.

## 4. Arquitectura de Base de Datos

El módulo se apoya en tres tablas principales:

1.  **`ventas` (Cabecera):**
    | Columna | Descripción |
    | --- | --- |
    | `id` | PK, Identificador único de la venta. |
    | `empresa_id`, `sucursal_id`, `cliente_id`, `usuario_id` | FKs que relacionan la venta con las entidades correspondientes. |
    | `folio` | Identificador legible para el usuario (ej. "VENTA-00001"). |
    | `total`, `subtotal`, `descuento`, `impuestos` | Campos numéricos que almacenan el desglose financiero. |
    | `metodo_pago`, `tipo_venta`, `estado_pago` | Campos de texto que definen las condiciones de la transacción. |
    | `saldo_pendiente`, `fecha_vencimiento` | Para la gestión de cuentas por cobrar en ventas a crédito. |

2.  **`venta_items` (Detalle):**
    | Columna | Descripción |
    | --- | --- |
    | `venta_id` | FK, Enlaza el ítem a su venta correspondiente. |
    | `producto_id` | FK, Identifica el producto vendido. |
    | `cantidad` | La cantidad de unidades vendidas de ese producto. |
    | `precio_unitario_aplicado` | El precio final al que se vendió cada unidad (después de descuentos o listas de precios). |
    | `costo_unitario_en_venta` | **Crucial:** Una "foto" del costo del producto en el momento de la venta para futuros cálculos de rentabilidad. |

3.  **`pagos_ventas` (Abonos):**
    | Columna | Descripción |
    | --- | --- |
    | `venta_id` | FK, Enlaza el pago a la venta a crédito correspondiente. |
    | `monto` | El monto abonado. |
    | `metodo_pago` | Cómo se realizó el pago del abono. |

## 5. Lógica de Backend (Funciones RPC)

-   **`registrar_venta(p_venta, p_items)`:** La función principal y más compleja. Es una operación transaccional que:
    1.  Crea la cabecera en la tabla `ventas`.
    2.  Itera sobre los productos del carrito e inserta cada uno en `venta_items`.
    3.  **Descuenta el stock** del `inventario` para cada producto en la sucursal correspondiente.
    4.  Registra un `movimiento_inventario` de tipo "Venta".
    5.  Actualiza el `saldo_pendiente` del cliente si la venta es a crédito.
    6.  Inserta el pago inicial en `pagos_ventas` si es una venta al contado o un crédito con abono.

-   **`get_company_sales()`:** Obtiene el historial completo de ventas para la `VentasPage`, uniendo las tablas `ventas`, `clientes`, `usuarios` y `sucursales` para obtener los nombres en lugar de solo los IDs.

-   **`get_sale_details(p_venta_id)`:** Recupera toda la información para la `VentaDetailPage`, incluyendo los detalles de la venta, la lista de ítems y el historial de pagos.

-   **`registrar_pago_venta(p_venta_id, p_monto, ...)`:** Se encarga de registrar un abono a una venta a crédito, actualizando el `saldo_pendiente` en la tabla `ventas` y el `saldo_pendiente` total en la tabla `clientes`.

-   **`get_sales_filter_data()`:** Una función de optimización que carga en una sola llamada todas las listas de clientes, usuarios y sucursales necesarios para poblar los menús desplegables del panel de búsqueda avanzada.