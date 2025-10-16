# MÓDULO 03: GESTIÓN DE EMPRESA
## Recibos de Licencia y Gestión de Módulos

Este documento detalla la arquitectura y el flujo de la funcionalidad para generar y visualizar recibos de pago de licencias, incluyendo la gestión de módulos adicionales en el momento del pago.

## 1. Objetivo del Módulo

-   Proporcionar a los **tenants** una forma sencilla de ver, imprimir y guardar un recibo oficial y detallado por cada pago de suscripción realizado.
-   Permitir al **SuperAdmin** gestionar los módulos adicionales de una empresa directamente al registrar un nuevo pago.
-   Asegurar que los recibos contengan un desglose completo de los cobros: plan base, módulos adicionales, subtotal, descuentos y total.
-   Integrar esta funcionalidad de manera fluida en la interfaz existente.

## 2. Arquitectura de Backend (Base de Datos)

Para que los recibos fueran completos y autocontenidos, se realizaron cambios clave en la base de datos.

### 2.1. Modificación de la Tabla `pagos_licencia`

Se añadieron columnas a la tabla `pagos_licencia` para almacenar el desglose del pago en el momento en que se registra. Esto es crucial para la integridad histórica, ya que los precios de los planes y módulos pueden cambiar en el futuro.

-   `concepto` (text): Almacena el nombre del plan en el momento del pago (ej. "Profesional (Mensual)").
-   `precio_plan` (numeric): El precio base del plan antes de cualquier descuento.
-   `descuento` (numeric): El monto que se descontó del subtotal.
-   `modulos_incluidos` (jsonb): **(NUEVO)** Almacena un array de objetos JSON con el detalle de cada módulo adicional pagado en esa transacción. Ejemplo: `[{"nombre": "Catálogo Web", "precio": 50.00}]`.

### 2.2. Actualización de Funciones RPC (SuperAdmin)

-   **`add_license_payment`:** La función que utiliza el SuperAdmin para registrar un pago fue actualizada para aceptar el nuevo parámetro `p_modulos_activados` (jsonb). Al ejecutarse, no solo guarda el desglose en `pagos_licencia`, sino que también actualiza el estado de los módulos de la empresa en la tabla `empresa_modulos`.

### 2.3. Función RPC para Tenants

-   **`get_my_payment_receipt_details(p_pago_id)`:**
    -   **Funcionalidad Actualizada:** Ahora también devuelve el campo `modulos_incluidos` del pago, permitiendo que el frontend del tenant renderice un recibo con el desglose completo.

## 3. Implementación de Frontend

### 3.1. Flujo del SuperAdmin (`CompanyDetailsPage.tsx`)

-   **Modal "Añadir Pago" Mejorado:**
    -   **Gestión de Módulos:** Al abrir el modal, se carga una lista de todos los módulos adicionales disponibles y se marcan los que la empresa ya tiene activos.
    -   **Interactividad:** El SuperAdmin puede activar o desactivar módulos para la empresa directamente desde este modal usando checkboxes.
    -   **Cálculo Dinámico:** El "Monto a Pagar" se recalcula automáticamente en tiempo real, sumando el precio del plan seleccionado más el precio de todos los módulos activados, y restando cualquier descuento aplicado.
    -   **Lógica de Guardado:** Al confirmar, la función `add_license_payment` es llamada con toda la información, incluyendo el desglose de los módulos. El frontend también se encarga de llamar a `toggle_company_module` para actualizar el estado de los módulos en `empresa_modulos`.

### 3.2. Flujo del Tenant (`LicenciaPage.tsx`)

-   **`ReciboModal` Detallado:**
    -   **Desglose Completo:** El modal del recibo ahora muestra una vista detallada de la transacción.
    -   **Renderizado:** Muestra una tabla o lista que incluye:
        1.  Una línea para el **plan base** con su precio.
        2.  Una línea separada para **cada módulo adicional** incluido en ese pago, con su respectivo precio.
        3.  Un **subtotal** (suma del plan y los módulos).
        4.  Una línea para el **descuento** aplicado.
        5.  El **TOTAL FINAL** pagado.
    -   **Lógica de Datos:** Utiliza el campo `modulos_incluidos` devuelto por la función `get_my_payment_receipt_details` para generar dinámicamente las líneas de los módulos.

### 3.3. Lógica de Impresión Robusta

La lógica para imprimir o guardar el recibo como PDF se mantiene, garantizando una salida limpia y profesional sin los elementos de la interfaz del modal.
-   **Función `handlePrint`:**
    1.  Clona el contenido del recibo.
    2.  Lo inyecta temporalmente en el `body`.
    3.  Usa CSS `@media print` para aislarlo.
    4.  Llama a `window.print()`.
    5.  Limpia el DOM después de la impresión.
