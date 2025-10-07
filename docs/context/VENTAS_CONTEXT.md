# MÓDULO 06: OPERACIONES
## Ventas y Punto de Venta

Este documento define la arquitectura, diseño y funcionalidad del módulo de **Ventas**, una de las áreas más críticas de ServiVENT. Abarca desde la interfaz del Punto de Venta (POS) para el registro de transacciones hasta el historial detallado para el análisis de datos.

## 1. Objetivo del Módulo

-   **Punto de Venta (`TerminalVentaPage.tsx`):** Proporcionar una interfaz rápida, intuitiva y optimizada para pantallas táctiles que permita a los empleados registrar ventas de manera eficiente, aplicando dinámicamente diferentes políticas de precios y gestionando clientes.
-   **Historial de Ventas (`VentasPage.tsx`):** Ofrecer una herramienta potente para que los administradores y propietarios puedan buscar, filtrar y analizar el historial completo de ventas, obteniendo KPIs clave sobre el rendimiento del negocio.
-   **Detalle de Venta (`VentaDetailPage.tsx`):** Permitir la visualización detallada de una transacción específica, incluyendo los productos vendidos, los totales y la gestión de pagos para las ventas a crédito.

## 2. Flujo Funcional y UI/UX

### `TerminalVentaPage.tsx` (Punto de Venta)

-   **Layout Responsivo:** En escritorio, muestra un catálogo de productos y un carrito lateral fijo. En móvil, el catálogo es a pantalla completa y un botón flotante abre el carrito.
-   **Catálogo de Productos:** Búsqueda rápida y filtros. Los productos sin stock o precio se muestran deshabilitados.
-   **Gestión de Clientes y Precios:** Permite buscar y seleccionar clientes y listas de precios, recalculando el carrito al instante.
-   **Carrito de Venta (`CartPanel`):** Permite ajustar cantidades, aplicar precios personalizados y descuentos globales limitados por el margen de ganancia.
-   **Finalización (`CheckoutModal`):** Modal para capturar método de pago, tipo de venta (Contado/Crédito) y calcular el cambio.

### `VentasPage.tsx` (Historial de Ventas)

-   **KPIs Dinámicos:** Muestra totales de ventas, cuentas por cobrar, etc., que se recalculan en tiempo real según los filtros.
-   **Filtrado Avanzado:** Por fecha, estado, tipo, cliente, vendedor y sucursal.
-   **Visualización Responsiva:** Tabla en escritorio y tarjetas en móvil.

### `VentaDetailPage.tsx` (Detalle de Venta)

-   Muestra un desglose completo de la transacción.
-   Incluye un **gestor de pagos** para registrar abonos a las ventas a crédito, actualizando el saldo pendiente.

## 3. Lógica de Backend (Funciones RPC)

-   **`registrar_venta()`:** Función transaccional que crea la venta, descuenta el stock, registra el movimiento y actualiza los saldos del cliente.
-   **`get_company_sales()`:** Obtiene el historial de ventas.
-   **`get_sale_details()`:** Recupera la información para la página de detalle.
-   **`registrar_pago_venta()`:** Registra un abono y actualiza los saldos.
-   **`get_sales_filter_data()`:** Carga los datos para los menús desplegables de los filtros.
