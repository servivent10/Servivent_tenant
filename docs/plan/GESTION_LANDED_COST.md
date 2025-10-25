# Plan de Implementación: Gestión de Costo de Adquisición Total (Landed Cost)

Este documento detalla la arquitectura técnica y el flujo de usuario para implementar la funcionalidad de **Costo de Adquisición Total (Landed Cost)** en ServiVENT. Su objetivo es permitir a las empresas registrar y prorratear los gastos adicionales de una compra (aduana, transporte, etc.) para obtener el costo real y preciso de su inventario.

## 1. Visión y Objetivo

-   **Visión:** Transformar la gestión de costos de ServiVENT de un simple registro de precio de proveedor a un sistema contable preciso que refleje el verdadero valor del inventario.
-   **Objetivo:** Implementar un flujo de trabajo de dos etapas que permita primero registrar una compra y, posteriormente, aplicar y distribuir los gastos adicionales entre los productos de esa compra, actualizando su costo de forma permanente y auditable.

---

## 2. Arquitectura de Backend (Base de Datos y RPCs)

La lógica se centralizará en el backend para garantizar la integridad de los datos y la correcta aplicación de las reglas de negocio.

### 2.1. Cambios en el Esquema de la Base de Datos

#### a. Nueva Tabla: `gastos_compra`
Esta tabla almacenará los registros de gastos individuales asociados a una compra específica.

| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | `uuid` | PK, Identificador único del gasto. |
| `empresa_id` | `uuid` | FK a `empresas`. Para seguridad RLS. |
| `compra_id` | `uuid` | **(CRÍTICO)** FK a `compras`. Vínculo con la compra. |
| `concepto` | `text` | Descripción del gasto (ej. "Transporte Marítimo", "Arancel Aduanero"). |
| `monto` | `numeric` | Monto del gasto en la moneda de la compra. |
| `created_at` | `timestamptz` | Fecha de registro del gasto. |

#### b. Modificación (Opcional pero Recomendada): Tabla `compra_items`
Para una auditoría más robusta, se recomienda añadir una columna para almacenar el costo final prorrateado.

| Columna a Añadir | Tipo | Descripción |
| :--- | :--- | :--- |
| `costo_unitario_real` | `numeric` | Almacenará el `costo_unitario` original + la porción prorrateada del gasto adicional. Inicialmente será `NULL` o igual al `costo_unitario`. |

### 2.2. Nueva Función RPC: `aplicar_costos_adicionales_a_compra()`

Esta será la función transaccional principal que orquestará todo el proceso.

**Firma:** `aplicar_costos_adicionales_a_compra(p_compra_id uuid, p_metodo_prorrateo text)`
-   `p_metodo_prorrateo` aceptará los valores `'VALOR'` o `'CANTIDAD'`.

**Lógica Interna Detallada (Transaccional):**

1.  **Validación:**
    -   Verifica que el usuario tenga permisos (Propietario/Administrador).
    -   Confirma que la `p_compra_id` existe y pertenece a la empresa del usuario.
    -   (Opcional) Se podría añadir una validación para impedir que se apliquen costos si alguno de los productos de la compra ya tiene movimientos de salida (ventas/traspasos), aunque esto podría ser demasiado restrictivo.

2.  **Cálculo de Totales:**
    -   Calcula el `total_gastos_adicionales` sumando todos los `monto` de la tabla `gastos_compra` para la `p_compra_id`.
    -   Calcula la `base_de_prorrateo` según `p_metodo_prorrateo`:
        -   Si es `'VALOR'`, la base es la suma de `(cantidad * costo_unitario)` para todos los ítems de la compra.
        -   Si es `'CANTIDAD'`, la base es la suma de `cantidad` para todos los ítems.

3.  **Cálculo del Factor de Prorrateo:**
    -   `factor_prorrateo = total_gastos_adicionales / base_de_prorrateo`.
    -   Este factor representa qué porción del gasto le corresponde a cada unidad de valor o cantidad.

4.  **Iteración y Actualización de Ítems:**
    -   La función itera sobre cada registro en `compra_items` asociado a `p_compra_id`.
    -   Para cada ítem, calcula el `costo_adicional_por_item`:
        -   Si es por `'VALOR'`: `(item.cantidad * item.costo_unitario) * factor_prorrateo`.
        -   Si es por `'CANTIDAD'`: `item.cantidad * factor_prorrateo`.
    -   Calcula el `costo_adicional_unitario`: `costo_adicional_por_item / item.cantidad`.
    -   Calcula el `nuevo_costo_unitario_real`: `item.costo_unitario + costo_adicional_unitario`.
    -   **Actualiza `compra_items`:** `SET costo_unitario_real = nuevo_costo_unitario_real WHERE id = item.id`.

5.  **Recálculo del Costo Promedio Ponderado (CAPP):**
    -   Este es el paso más crítico. Para cada ítem de la compra:
        a.  Se obtiene el `stock_total_actual` y el `capp_actual` del producto desde la tabla `productos`.
        b.  Se calcula un `valor_inventario_actual` (`stock_total_actual * capp_actual`).
        c.  Se calcula el `valor_compra_real` para este ítem (`item.cantidad * nuevo_costo_unitario_real`).
        d.  Se calcula el **`nuevo_capp`**: `(valor_inventario_actual + valor_compra_real) / (stock_total_actual + item.cantidad)`.
        e.  **Actualiza `productos`:** `SET precio_compra = nuevo_capp WHERE id = item.producto_id`.

6.  **Auditoría y Notificación:**
    -   Se genera un registro en `historial_cambios` para la tabla `compras` con la acción "APLICAR_COSTOS".
    -   Se genera una notificación para el Propietario: "Se han aplicado costos adicionales a la compra `COMP-00123`, actualizando el valor del inventario."

---

## 3. Implementación de Frontend (UI/UX)

La interfaz se integrará de forma natural en la página de detalle de la compra.

### 3.1. Ubicación: `CompraDetailPage.tsx`

-   Se añadirá un nuevo sistema de pestañas (`Tabs.tsx`) con dos vistas: "Detalle de Productos" (la vista actual) y **"Costos Adicionales"**.

### 3.2. Pestaña "Costos Adicionales"

Esta nueva pestaña contendrá:

1.  **Formulario de Registro de Gastos:**
    -   `FormInput` para `Concepto` (ej. "Flete Marítimo").
    -   `FormInput` para `Monto`.
    -   Botón "Añadir Gasto", que insertará el registro en `gastos_compra` y refrescará la lista.

2.  **Lista de Gastos Añadidos:**
    -   Una tabla o lista de tarjetas que muestre los gastos ya registrados para esa compra, con su concepto, monto y un botón para eliminar.
    -   Un `KPI_Card` o un texto prominente que muestre el **"Total de Gastos Adicionales"**.

3.  **Panel de Prorrateo y Aplicación:**
    -   Un `FormSelect` para elegir el **"Método de Prorrateo"** (`Por Valor` / `Por Cantidad`).
    -   Un botón principal, **"Aplicar Costos y Recalcular Inventario"**, que estará deshabilitado si no hay gastos añadidos.
    -   Al hacer clic, se invocará la función RPC `aplicar_costos_adicionales_a_compra`. Se activará el `useLoading` para mostrar la `ProgressBar` global.

---

## 4. Análisis de Impacto en Módulos Existentes

### a. Módulo de Compras
-   **`NuevaCompraPage.tsx`:** No se ve afectado. Se mantiene simple, registrando solo el costo de factura del proveedor.
-   **`CompraDetailPage.tsx`:** Es el principal afectado, donde se alojará la nueva funcionalidad.

### b. Módulo de Inventarios
-   **Impacto Positivo:** El **Costo Promedio Ponderado (CAPP)**, visible en `InventariosPage.tsx` y `ProductoDetailPage.tsx`, será ahora mucho más preciso.
-   **`Valor del Inventario` (KPI):** Este KPI se volverá contablemente correcto, ya que se basará en el `landed_cost` real.

### c. Módulo de Ventas y Dashboard
-   **Impacto Positivo Crítico:** Cualquier cálculo de **Ganancia Bruta** (`precio_venta - costo`) será ahora preciso.
-   **KPIs Afectados:** `Ganancia Bruta`, `Ganancia NETA`, y todos los gráficos de rentabilidad en el `DashboardPage.tsx` reflejarán la verdadera rentabilidad del negocio.

### d. Módulo de Auditoría
-   No se requieren cambios. El recálculo del CAPP es una actualización del campo `precio_compra` en `productos` y ya está cubierto por el trigger de auditoría existente. El nuevo registro en `historial_cambios` para la compra proporcionará el contexto de la operación.

---

## 5. Resumen de Beneficios

-   **Precisión Contable:** Proporciona el verdadero costo del inventario.
-   **Mejora en la Toma de Decisiones:** Los reportes de rentabilidad serán fiables.
-   **Flujo de Trabajo Realista:** Permite registrar la compra primero y añadir los gastos logísticos después, como ocurre en la realidad.
-   **Auditoría Clara:** Mantiene un registro separado de los costos de producto y los costos logísticos.

Este plan ofrece una solución completa y profesional que se integra de forma limpia en la arquitectura existente, aportando un valor significativo a la plataforma.