# MÓDULO 05: CATÁLOGO E INVENTARIOS
## Flujo de Carga Inicial y Gestión de Stock Mínimo

Este documento define la arquitectura y el plan de acción para mejorar la gestión del inventario, abordando dos necesidades críticas: la definición del **stock mínimo de alerta** por producto y sucursal, y la simplificación de la **carga inicial de productos y costos** para nuevas empresas.

---

## 1. Gestión del Stock Mínimo (Alertas de Bajo Stock)

Esta funcionalidad permitirá definir umbrales de stock personalizados, haciendo que las alertas sean precisas y relevantes para la operación de cada sucursal.

### Backend (Base de Datos)

-   **Tabla `inventarios`:** Se añadirá una nueva columna `stock_minimo` de tipo `numeric`.
    -   **Justificación:** Se coloca en `inventarios` en lugar de `productos` porque el umbral de stock mínimo es una variable que depende de la demanda y capacidad de cada sucursal. Una sucursal principal puede requerir un mínimo de 20 unidades, mientras que una más pequeña solo 5 del mismo producto.

### Frontend (Interfaz de Usuario)

-   **Modal `InventoryAdjustModal.tsx`:** Este modal, accesible desde `ProductoDetailPage.tsx`, se modificará para incluir un nuevo campo:
    -   **"Stock Mínimo de Alerta":** Permitirá al usuario definir y actualizar el umbral para ese producto específico en esa sucursal en particular.

### Beneficio

Con este cambio, las alertas, informes y KPIs de "Bajo Stock" serán 100% precisos y personalizables para la realidad operativa de cada sucursal, optimizando la gestión de reabastecimiento.

---

## 2. Flujo de Carga Inicial de Inventario

Se creará un flujo de trabajo rápido y auditable para que las nuevas empresas puedan registrar su inventario existente sin recurrir a la creación de compras ficticias.

### Paso 1: Establecer el Costo Inicial del Producto

-   **Backend:**
    -   **Tabla `productos`:** Se añadirá una nueva columna `costo_inicial` de tipo `numeric`, que puede ser nula.
    -   **Lógica Clave:**
        1.  La columna `precio_compra` existente continuará siendo el **Costo Promedio Ponderado (CAPP)** y se actualizará automáticamente con cada compra real.
        2.  Al crear un producto, si se proporciona un `costo_inicial`, este valor se usará como el CAPP base.
        3.  La primera compra real de ese producto recalculará el CAPP como es debido, pero el sistema ya tendrá un punto de partida contablemente correcto.

-   **Frontend:**
    -   **Creación Manual (`ProductFormModal.tsx`):** Se añadirá un campo **"Costo Inicial"**.
    -   **Importación Masiva (`ProductImportModal.tsx`):** La plantilla CSV incluirá una nueva columna opcional `costo_inicial`.

### Paso 2: Registrar el Stock Inicial

-   **Backend:** No se requieren cambios. La lógica existente de ajuste de inventario es adecuada para este propósito.

-   **Frontend:**
    -   **Flujo de Usuario:** La empresa utilizará la funcionalidad existente de **"Ajustar Stock"** para establecer la cantidad inicial de cada producto en cada sucursal.
    -   **Mejora de UX y Auditoría:** Se modificará el modal de "Ajustar Stock":
        -   El campo de texto "Motivo" se convertirá en un menú desplegable (`select`).
        -   Se añadirán opciones predefinidas como "Pérdida", "Error de Conteo", "Devolución", etc.
        -   La opción por defecto será **"Carga Inicial de Inventario"**, haciendo el proceso claro y auditable.

### Beneficio

Esto crea un registro de auditoría claro en la tabla `movimientos_inventario`, permitiendo un seguimiento preciso de la carga inicial. Se reutiliza y mejora una funcionalidad existente, haciendo el proceso simple, robusto y profesional.

---

## 3. Resumen del Nuevo Flujo de Onboarding

Con estos cambios, el proceso para una nueva empresa será el siguiente:

1.  **Preparar Datos:** La empresa prepara su lista de productos en un archivo CSV, incluyendo la nueva columna `costo_inicial`.
2.  **Importar Catálogo:** Usan la herramienta de importación para cargar todos sus productos de una sola vez. Alternativamente, pueden crearlos manualmente, llenando el campo "Costo Inicial".
3.  **Cargar Stock:** Van a la página de "Inventarios" o de detalle de producto y, para cada ítem/sucursal, usan "Ajustar Stock", seleccionan el motivo "Carga Inicial de Inventario" e ingresan la cantidad física.
4.  **¡Listo!** A partir de ese momento, el CAPP y el stock se gestionarán automáticamente con las operaciones diarias (compras y ventas), pero la configuración inicial habrá sido rápida, precisa y auditable.