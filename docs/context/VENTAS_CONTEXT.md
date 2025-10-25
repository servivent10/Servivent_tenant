# MÓDULO 06: OPERACIONES
## Ventas y Punto de Venta

Este documento define la arquitectura, diseño y funcionalidad del módulo de **Ventas**, una de las áreas más críticas de ServiVENT. Abarca desde la interfaz del Punto de Venta (POS) para el registro de transacciones hasta el historial detallado para el análisis de datos.

## 1. Objetivo del Módulo

-   **Punto de Venta (`TerminalVentaPage.tsx`):** Proporcionar una interfaz rápida, intuitiva y optimizada para pantallas táctiles que permita a los empleados registrar ventas de manera eficiente, aplicando dinámicamente diferentes políticas de precios y gestionando clientes.
-   **Historial de Ventas (`VentasPage.tsx`):** Ofrecer una herramienta potente para que los administradores y propietarios puedan buscar, filtrar y analizar el historial completo de ventas, obteniendo KPIs clave sobre el rendimiento del negocio.
-   **Detalle de Venta (`VentaDetailPage.tsx`):** Permitir la visualización detallada de una transacción específica, incluyendo los productos vendidos, y la gestión de pagos para las ventas a crédito.

## 2. Flujo Funcional y UI/UX

### `TerminalVentaPage.tsx` (Punto de Venta)

-   **Layout Responsivo:** En escritorio, muestra un catálogo de productos y un carrito lateral fijo. En móvil, el catálogo es a pantalla completa y un botón flotante abre el carrito.
-   **Catálogo de Productos:** Búsqueda rápida y filtros. Los productos sin stock o precio se muestran deshabilitados.
-   **Gestión de Clientes y Precios:** Permite buscar y seleccionar clientes. Si el plan de la empresa lo permite, también se puede seleccionar una lista de precios, recalculando el carrito al instante.
-   **Carrito de Venta (`CartPanel`):** Permite ajustar cantidades, aplicar precios personalizados y descuentos globales limitados por el margen de ganancia.
-   **Finalización (`CheckoutModal`):** Modal para capturar método de pago, tipo de venta (Contado/Crédito) y calcular el cambio.

### `VentasPage.tsx` (Historial de Ventas)

-   **KPIs Dinámicos:** Muestra totales de ventas, cuentas por cobrar, etc., que se recalculan en tiempo real según los filtros.
-   **Filtrado Avanzado:** Por fecha, estado, tipo, cliente, vendedor y sucursal.
-   **Visualización Responsiva:** Tabla en escritorio y tarjetas en móvil.

### `VentaDetailPage.tsx` (Detalle de Venta)

-   Muestra un desglose completo de la transacción.
-   Incluye un **gestor de pagos** para registrar abonos a las ventas a crédito, actualizando el saldo pendiente.
-   **Gestión de Pedidos Web:** Para las ventas que provienen del catálogo público, la página ahora incluye un panel de **"Gestión de Pedido Web"**. Este panel realiza una verificación de stock en tiempo real y presenta la acción correspondiente:
    -   **Si hay stock:** Habilita un botón para "Confirmar y Procesar Pedido", que descuenta el inventario.
    -   **Si el stock es insuficiente:** Habilita un botón que abre un modal de logística, desde el cual el personal puede solicitar un traspaso de los productos faltantes a otras sucursales, replicando la funcionalidad inteligente del módulo de Proformas.

## 3. Lógica de Backend (Funciones RPC)

-   **`registrar_venta()`:** Función transaccional que crea la venta, descuenta el stock, registra el movimiento y actualiza los saldos del cliente.
-   **`get_company_sales()`:** Obtiene el historial de ventas.
-   **`get_sale_details()`:** Recupera la información para la página de detalle.
-   **`registrar_pago_venta()`:** Registra un abono y actualiza los saldos.
-   **`get_sales_filter_data()`:** Carga los datos para los menús desplegables de los filtros.
-   **`verificar_stock_para_venta()`:** Verifica el stock disponible para un pedido web.
-   **`confirmar_pedido_web()`:** Finaliza un pedido web, descontando el stock.
-   **`solicitar_traspaso_desde_venta()`:** Crea un registro de solicitud de traspaso para un pedido web.

## 4. Pagos Múltiples para Ventas (Contado y Crédito)

Para reflejar casos de uso reales donde un cliente paga con varios métodos (ej. parte en efectivo, parte con QR), o desea dar un abono inicial con múltiples métodos en una venta a crédito, se implementa una arquitectura de pagos múltiples.

### 4.1. Visión y Objetivo
Flexibilizar el proceso de cobro en el `CheckoutModal` para que una única venta pueda registrarse con múltiples métodos de pago, ya sea para cubrir el total en una venta al contado, o para registrar un abono inicial en una venta a crédito. La experiencia de usuario debe ser rápida e intuitiva.

### 4.2. Cambios Arquitectónicos (Backend)
-   **Reutilización de `pagos_ventas`:** Esta tabla se convierte en el registro central para **todos los pagos de todas las ventas**. Almacenará `venta_id`, `monto` y `metodo_pago` por cada transacción parcial.
-   **Actualización de `ventas.metodo_pago`:** Esta columna pasa a ser un indicador. Si hay más de un pago, se almacena el valor **"Mixto"**.
-   **Actualización de RPC `registrar_venta()`:** La función se modifica para aceptar un array de objetos de pago (`p_pagos json[]`).
    -   Para ventas al **contado**, la RPC valida que la suma de los montos en `p_pagos` coincida con el total de la venta.
    -   Para ventas a **crédito**, la suma de los montos en `p_pagos` se convierte en el `abono_inicial`.

### 4.3. Cambios en Interfaz y Flujo de Usuario (`CheckoutModal.tsx`)

El modal de finalización de venta se rediseñará para seguir un flujo claro y lógico:

1.  **Orden de Elementos:** La interfaz se presentará en el siguiente orden:
    1.  **Total a Pagar:** Mostrado de forma prominente.
    2.  **Tipo de Venta:** Selector entre "Contado" (por defecto) y "Crédito".
    3.  **Gestor de Métodos de Pago:** La nueva interfaz para añadir múltiples pagos.
    4.  **Campos Adicionales:** Como el cálculo del cambio o la fecha de vencimiento.

2.  **Flujo para Venta al Contado:**
    *   El modal muestra el **"Total a Pagar"** y el **"Monto Restante"**.
    *   El vendedor hace clic en un método de pago (ej. "Efectivo"), lo que añade una nueva entrada a una lista de pagos.
    *   Ingresa el monto para ese método, y el "Monto Restante" se recalcula al instante.
    *   Repite el proceso con otros métodos hasta que el "Monto Restante" sea cero.
    *   El botón "Confirmar Venta" se habilita solo cuando el total está cubierto.

3.  **Flujo para Venta a Crédito:**
    *   Al seleccionar "A Crédito", el campo **"Fecha de Vencimiento"** se hace visible.
    *   El **gestor de métodos de pago permanece activo**, permitiendo al vendedor registrar un **abono inicial**.
    *   El vendedor puede añadir uno o más pagos (ej. parte en efectivo, parte con tarjeta) que constituirán el abono inicial.
    *   El "Monto Restante" en este contexto representa el **saldo pendiente** de la deuda.
    *   El botón "Confirmar Venta" está siempre habilitado (siempre que se haya seleccionado un cliente), ya que se puede realizar una venta a crédito sin abono inicial.

### 4.4. Flujo de Usuario (Ejemplo)

-   **Caso Contado (Venta de Bs 1000):**
    1.  El vendedor agrega un pago de "Efectivo" por Bs 800. El "Monto Restante" muestra Bs 200.
    2.  Agrega un pago de "QR" por Bs 200. El "Monto Restante" muestra Bs 0.
    3.  Confirma. El backend recibe `p_pagos: [{metodo: 'Efectivo', monto: 800}, {metodo: 'QR', monto: 200}]`.

-   **Caso Crédito (Venta de Bs 2000):**
    1.  El vendedor selecciona "A Crédito".
    2.  El cliente desea dar un abono de Bs 500.
    3.  El vendedor agrega un pago de "Efectivo" por Bs 200.
    4.  Agrega un pago de "Tarjeta" por Bs 300.
    5.  El "Monto Restante" (saldo pendiente) muestra Bs 1500.
    6.  Confirma. El backend recibe `p_pagos: [{metodo: 'Efectivo', monto: 200}, {metodo: 'Tarjeta', monto: 300}]` y lo registra como `abono_inicial`.
