# MÓDULO 06: OPERACIONES
## Compras

Este documento define la arquitectura y el diseño del módulo de **Compras**, enfocado en el registro de adquisiciones de mercancía a proveedores.

## 1. Objetivo del Módulo

Permitir el registro de las compras a proveedores, actualizando tanto el costo de los productos (mediante el cálculo del Costo Promedio Ponderado - CAPP) como el inventario en las sucursales correspondientes.

## 2. Páginas y Flujo de Usuario

-   **`ComprasPage.tsx` (Historial de Compras):**
    -   Muestra KPIs clave como el total comprado y las cuentas por pagar.
    -   Presenta una lista del historial de compras con filtros avanzados por fecha, estado, proveedor, etc.
    -   La visualización es responsiva (tabla en escritorio, tarjetas en móvil).

-   **`NuevaCompraPage.tsx` (Registro de Compra):**
    -   Un **asistente de 3 pasos** guía al usuario a través del registro:
        1.  **Información General:** Se selecciona el proveedor, la fecha, la moneda y el número de factura.
        2.  **Productos:** Se buscan y añaden productos a la orden. Para cada producto, un modal permite definir su **costo unitario** y la **distribución de la cantidad** entre las diferentes sucursales. También se pueden ajustar los precios de venta en base al nuevo costo.
        3.  **Pago:** Se define el tipo de pago (Contado/Crédito) y se registran abonos iniciales si aplica.

-   **`CompraDetailPage.tsx` (Detalle de Compra):**
    -   Muestra el detalle completo de una compra, incluyendo los productos y un gestor de pagos para las compras a crédito.

## 3. Lógica de Backend (Funciones RPC)

-   **`registrar_compra()`:** Es la función transaccional principal. Al ejecutarse:
    1.  Crea el registro de la compra y sus ítems.
    2.  **Aumenta el stock** del inventario en las sucursales correspondientes.
    3.  **Recalcula y actualiza el Costo Promedio Ponderado (CAPP)** del producto en la tabla `productos`.
    4.  Registra los movimientos de inventario.
    5.  Actualiza los saldos del proveedor si la compra es a crédito.

-   **`get_company_purchases()`:** Obtiene el historial de compras para la `ComprasPage`.
-   **`get_purchase_details()`:** Recupera la información detallada de una compra.
-   **`registrar_pago_compra()`:** Registra un abono a una compra a crédito.
-   **`get_purchases_filter_data()`:** Carga los datos para los menús desplegables de los filtros.
