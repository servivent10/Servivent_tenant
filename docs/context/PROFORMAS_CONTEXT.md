# MÓDULO 06: OPERACIONES
## Proformas (Cotizaciones)

Este documento define la arquitectura, el diseño y la funcionalidad del módulo de **Proformas** (también conocido como Cotizaciones o Presupuestos). Su objetivo es proporcionar una herramienta para formalizar ofertas a clientes sin afectar el inventario o la contabilidad de la empresa hasta que la venta se concrete.

## 1. Visión y Objetivo

-   **Formalización de Ofertas:** Permitir la creación de documentos profesionales para presentar precios y condiciones a los clientes.
-   **Integridad del Inventario:** Asegurar que la creación de una proforma **NUNCA** descuente el stock de los productos.
-   **Flujo de Venta Eficiente:** Facilitar la conversión de una proforma aceptada en una venta real con un solo clic, precargando toda la información en el Punto de Venta.
-   **Análisis Comercial:** Proporcionar KPIs sobre la cantidad y el monto de las proformas generadas, así como la tasa de conversión a ventas.

## 2. Arquitectura de Base de Datos

Se crearán dos nuevas tablas, análogas a las de `ventas` pero con campos específicos para el flujo de cotización.

### 2.1. Tabla `proformas`

Almacenará la cabecera de cada proforma.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | `uuid` | PK, Identificador único. |
| `empresa_id` | `uuid` | FK a `empresas`. |
| `sucursal_id` | `uuid` | FK a `sucursales`. Sucursal que genera la proforma. |
| `usuario_id` | `uuid` | FK a `usuarios`. Usuario que genera la proforma. |
| `cliente_id` | `uuid` | FK a `clientes`. Cliente al que se dirige. |
| `folio` | `text` | Código único de la proforma (ej. PROF-00001). |
| `fecha_emision`| `timestamptz`| Fecha y hora de creación. |
| `fecha_vencimiento`| `date` | Fecha hasta la cual la oferta es válida. |
| `subtotal` | `numeric` | Suma de los precios de los ítems antes de descuentos e impuestos. |
| `descuento` | `numeric` | Descuento global aplicado a la proforma. |
| `impuestos` | `numeric` | Impuestos calculados sobre el subtotal. |
| `total` | `numeric` | Monto final de la proforma. |
| `estado` | `text` | 'Vigente', 'Convertida', 'Anulada', 'Vencida'. |
| `notas` | `text` | Términos, condiciones o notas para el cliente. |

### 2.2. Tabla `proforma_items`

Almacenará el detalle de los productos en cada proforma.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | `uuid` | PK, Identificador único. |
| `proforma_id`| `uuid` | FK a `proformas`. |
| `producto_id`| `uuid` | FK a `productos`. |
| `cantidad` | `numeric` | Cantidad del producto cotizado. |
| `precio_unitario_aplicado`| `numeric`| Precio del producto en el momento de la cotización. |
| `costo_unitario_en_proforma`|`numeric`| Costo del producto en el momento de la cotización, para calcular márgenes. |


## 3. Lógica de Backend (Funciones RPC)

-   **`crear_proforma(p_proforma jsonb, p_items jsonb[])`:**
    -   Recibe los datos de la cabecera (incluyendo `subtotal`, `descuento`, `impuestos`) y un array de productos (incluyendo `costo_unitario_en_proforma`).
    -   Crea los registros en `proformas` y `proforma_items`.
    -   **Regla Crítica:** Esta función **NO DEBE afectar el stock** en la tabla `inventarios`.

-   **`get_proformas_list(filtros)`:**
    -   Obtiene la lista de proformas aplicando filtros de fecha, cliente, sucursal, usuario y estado.
    -   Respeta los roles: El Propietario ve todas; Administrador/Empleado ven solo las de su sucursal.

-   **`get_proforma_details(p_proforma_id)`:**
    -   Obtiene la información completa de una proforma, incluyendo el desglose financiero (`subtotal`, `descuento`, `impuestos`).

-   **`verificar_stock_proforma(p_proforma_id)` (NUEVO):**
    -   Función crítica para la conversión a venta.
    -   Recibe el ID de una proforma y la sucursal donde se intenta realizar la venta.
    -   Compara la cantidad de cada ítem de la proforma con el stock actual en la tabla `inventarios`.
    -   Devuelve un JSON con el estado: `{ "status": "ok" }` si todo el stock está disponible, o `{ "status": "insufficient", "items": [...] }` si hay faltantes, detallando los productos y las cantidades.

-   **`convertir_proforma_a_venta(p_proforma_id)`:** (Opcional, si se decide manejar en backend)
    -   Marca la proforma como 'Convertida'. La lógica principal de precargar el carrito se manejará en el frontend para una mejor experiencia.

-   **`check_and_notify_proformas_expiring()` (Para Cron Job):**
    -   Función a ejecutar diariamente. Busca proformas 'Vigentes' cuya `fecha_vencimiento` esté próxima (ej. en los próximos 3 días) y genera notificaciones.

## 4. Flujo de Usuario y Componentes Frontend

### 4.1. `ProformasPage.tsx` (Página de Listado)

-   **Acceso:** Nuevo enlace "Proformas" en el menú lateral.
-   **KPIs:** Tarjetas con "Total Cotizado (Mes)", "Tasa de Conversión", "Proformas Vigentes".
-   **Filtros Avanzados:** Por rango de fechas, cliente, usuario, sucursal (para Propietario) y estado ('Vigente', 'Convertida', etc.).
-   **Visualización Responsiva:** Tabla en escritorio, lista de tarjetas en móvil.
-   **Acciones:** Botón "Nueva Proforma" que redirige a `NuevaProformaPage.tsx`.

### 4.2. `NuevaProformaPage.tsx` (Página de Creación)

-   **Reutilización Inteligente:** La interfaz será casi idéntica a la de `TerminalVentaPage.tsx`, reutilizando el catálogo de productos y la lógica del carrito para acelerar el desarrollo y mantener la familiaridad del usuario.
-   **Diferencias Clave:**
    -   No habrá gestión de caja (apertura/cierre).
    -   El botón final será "Generar Proforma", que abrirá un modal de confirmación.
-   **Gestión Financiera:** Se incluirán campos para **Impuestos (%)** y **Descuento (monto)**, con la misma lógica de "descuento máximo" basada en el margen de ganancia que existe en el Punto de Venta.
-   **Modal de Finalización:** En lugar de un modal de pago, se mostrará un modal para añadir `fecha_vencimiento` y `notas`, antes de llamar a la RPC `crear_proforma`.

### 4.3. `ProformaDetailPage.tsx` (Página de Detalle)

-   Muestra toda la información de la proforma, los productos, el desglose financiero y las notas.
-   **Botón "Convertir a Venta":** Esta es la acción principal, que inicia el flujo de conversión a venta real.
-   **Acciones Secundarias:** Botones para "Imprimir", "Descargar PDF" y "Anular".

### 4.4. Flujo de Logística Inteligente y Eficiente

Esta sección detalla la re-arquitectura del flujo de gestión de stock insuficiente para convertirlo en un centro de acción logística, optimizando la experiencia tanto para el vendedor que solicita como para el empleado que prepara el traspaso.

#### 4.4.1. Solución de Notificaciones en Tiempo Real

-   **Problema:** Las notificaciones de solicitud de traspaso llegaban con retraso, rompiendo la inmediatez del flujo. La causa era el uso de `SECURITY DEFINER` en la función `notificar_cambio`.
-   **Solución:** Se modificó la función `notificar_cambio` para que se ejecute con los permisos del invocador (`SECURITY INVOKER`). Esto es seguro gracias a la arquitectura JWT para RLS y garantiza la entrega instantánea de las notificaciones a través de `postgres_changes`.

#### 4.4.2. Nueva UI para Solicitudes de Traspaso (`ProformaDetailPage.tsx`)

El modal de "Stock Insuficiente" fue rediseñado para ser un centro de acción.

1.  **Solicitud por Producto (Popover):**
    -   Se reemplazó el texto de disponibilidad por un botón **"Otras Suc."**.
    -   Al hacer clic, se despliega un menú contextual (`popover`) que lista las sucursales con stock disponible.
    -   Cada sucursal en el menú tiene un botón **"Solicitar"** para enviar la petición de traspaso de forma individual y precisa.

2.  **Solicitud en Bloque ("Sugerencias de Traspaso"):**
    -   En la parte inferior del modal, una nueva sección **"Sugerencias de Traspaso"** analiza todos los productos faltantes.
    -   Presenta botones de acción inteligentes que ofrecen la solución más eficiente. Ejemplos:
        -   `"Solicitar los 5 productos desde Sucursal Central"` (si una sucursal tiene todo).
        -   `"Solicitar 4 de 5 productos desde Sucursal Norte"` (si una sucursal tiene la mayoría).
    -   Esto permite al vendedor resolver la falta de stock para múltiples productos con un solo clic.

#### 4.4.3. Flujo Optimizado para el Receptor del Traspaso

Este es el cambio más importante para la eficiencia operativa. El objetivo es que el empleado que recibe la solicitud pueda generar el traspaso con un solo clic.

1.  **Nueva Tabla `solicitudes_traspaso`:**
    -   **Backend:** La función `solicitar_traspaso_desde_proforma` ya no solo genera una notificación. Ahora acepta un array de ítems y crea un registro en la nueva tabla `solicitudes_traspaso`, almacenando: `proforma_id`, sucursales y el `jsonb` de ítems solicitados.
    -   La notificación ahora incluye el `id` de esta nueva solicitud.

2.  **Redirección Inteligente:**
    -   **Frontend (Notificación):** El enlace de la notificación se cambió a `#/traspasos/nuevo?solicitud=[ID_DE_LA_SOLICITUD]`.

3.  **Precarga Automática del Formulario de Traspaso (`NuevoTraspasoPage.tsx`):**
    -   **Frontend:** Esta página ahora detecta el parámetro `solicitud` en la URL.
    -   Si lo encuentra, llama a una nueva función RPC, `get_solicitud_traspaso_details`, para obtener los datos de la solicitud.
    -   Usa estos datos para **precargar y autocompletar todo el formulario de traspaso**:
        -   **Paso 1:** Origen y Destino se seleccionan automáticamente.
        -   **Paso 2:** El listado de productos se llena con los ítems y cantidades solicitadas (ajustadas al stock disponible si es necesario, con una advertencia).
    -   El empleado solo necesita verificar la información y hacer clic en "Confirmar y Guardar", eliminando todo el trabajo manual y agilizando drásticamente la logística entre sucursales.

## 5. Integración con Módulos Existentes

### 5.1. Dashboard (`DashboardPage.tsx`)

-   La RPC `get_dashboard_data` se actualizará para devolver nuevos KPIs:
    -   **Total Cotizado:** Suma de los montos de proformas en el período.
    -   **Tasa de Conversión:** Porcentaje de proformas convertidas a venta en el período.

### 5.2. Notificaciones (`notificar_cambio`)

Se crearán nuevos tipos de evento y mensajes contextuales:

| Evento (Código Interno) | Mensaje de Notificación (Ejemplo) | Quiénes Serán Notificados |
| :--- | :--- | :--- |
| `NUEVA_PROFORMA` | `Se generó la proforma PROF-00123 para el cliente 'Cliente X'.` | La sucursal que la generó. |
| `PROFORMA_CONVERTIDA`| `La proforma PROF-00123 fue convertida en la venta VENTA-00456.` | La sucursal que la generó. |
| `PROFORMA_POR_VENCER`| `La proforma PROF-00120 para 'Cliente Y' vence en 2 días.` | La sucursal que la generó. |
| `PROFORMA_ANULADA` | `La proforma PROF-00123 fue anulada por el usuario 'Admin'.` | La sucursal que la generó. |
| `SOLICITUD_TRASPASO`| `Suc. Norte solicita 5x 'Laptop Gamer' para la proforma PROF-00125.`| La sucursal de origen del traspaso.|

### 5.3. Roles y Permisos

-   **Crear/Editar/Anular:** `Propietario`, `Administrador`, `Empleado`.
-   **Visualización:**
    -   `Propietario`: Puede ver y filtrar proformas de todas las sucursales.
    -   `Administrador` / `Empleado`: Solo pueden ver y gestionar las proformas de su propia sucursal.

## 6. Documento de Proforma (Impresión y Descarga)

-   **Nuevo Componente `ProformaTemplate.tsx`:**
    -   Será una variación de `NotaVentaTemplate.tsx`.
    -   El título será "PROFORMA" o "COTIZACIÓN".
    -   **NO** incluirá información de pagos ni estado de pago.
    -   **SÍ** incluirá un desglose financiero completo: `Subtotal`, `Descuento`, `Impuestos` y `Total`.
    -   **SÍ** incluirá los campos `Fecha de Validez` y `Términos y Condiciones / Notas`.
-   **Integración:**
    -   Se usará el `PrintModal.tsx` existente para la previsualización e impresión.
    -   La utilidad `pdfGenerator.ts` se reutilizará para la descarga directa en PDF desde `ProformaDetailPage.tsx` y la lista `ProformasPage.tsx`.