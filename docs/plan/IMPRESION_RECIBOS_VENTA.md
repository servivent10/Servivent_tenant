# Plan de Implementación: Impresión y Descarga de Recibos de Venta

## 1. Visión y Objetivo

-   **Visión:** Proporcionar una experiencia de usuario fluida y profesional para la generación de comprobantes de venta, permitiendo tanto la impresión tradicional como la descarga directa en PDF, adaptándose perfectamente a cualquier dispositivo.
-   **Objetivo:** Implementar un sistema dual en la `VentaDetailPage.tsx` y `VentasPage.tsx` que permita al usuario:
    1.  Previsualizar e imprimir recibos en dos formatos (Nota de Venta A4 y Ticket) a través de una ventana modal.
    2.  Descargar directamente los mismos recibos en formato PDF con un solo clic.

---

## 2. Análisis de la Solución Técnica

Se implementarán dos soluciones complementarias para cubrir ambos casos de uso: impresión y descarga.

### A. Para la Impresión (Ventana Modal)

Se utilizarán **hojas de estilo CSS específicas para impresión (`@media print`)** para aislar el contenido del recibo dentro de un modal, evitando que el resto de la interfaz de la aplicación se imprima. Esta estrategia es ideal para una previsualización limpia antes de enviar a la impresora.

### B. Para la Descarga Directa en PDF

Se generará el PDF directamente en el navegador del cliente utilizando una combinación de dos librerías estándar de la industria:
-   **`html2canvas`:** Para tomar una "captura" de alta calidad del componente de la plantilla del recibo (ya sea `NotaVentaTemplate` o `TicketTemplate`), renderizado de forma invisible.
-   **`jspdf`:** Para crear un nuevo documento PDF y pegar la captura generada por `html2canvas` en él, para luego iniciar la descarga.

**Consideración Importante:** El PDF generado de esta manera será un **PDF de imagen**, lo que significa que el texto no será seleccionable. Esto es perfectamente aceptable para recibos, pero es una distinción técnica importante.

---

## 3. Fases de Implementación

### Fase 1: El Contenedor de Impresión (`PrintModal.tsx`)

-   **Propósito:** Crear el componente base para la previsualización de impresión modal.
-   **Características:**
    *   Diseño responsivo.
    *   Recibirá el contenido del recibo (`children`).
    *   Tendrá botones "Cerrar" e "Imprimir" (que llama a `window.print()`).
    *   El contenido del recibo estará envuelto en un `div` con la clase `print-modal-content` para el aislamiento por CSS.

### Fase 2: Las Plantillas de Recibo

-   **`NotaVentaTemplate.tsx` (Formato A4):** Diseñado con dimensiones proporcionales a una hoja A4. Contendrá todos los detalles formales.
-   **`TicketTemplate.tsx` (Formato Ticket):** Diseñado con un ancho fijo y estrecho (ej. `72mm`), optimizado para impresoras térmicas.

### Fase 3: Lógica de Generación de PDF (Utilidad Reutilizable)

-   **Propósito:** Centralizar la lógica de creación de PDFs para poder llamarla desde cualquier parte de la aplicación.
-   **Archivo:** Se creará una función de utilidad, por ejemplo en `src/lib/pdfGenerator.js`.
-   **Función:** `generatePdfFromComponent(componentNode, fileName)`:
    1.  Recibe el nodo DOM del componente a convertir y el nombre del archivo.
    2.  Utiliza `html2canvas` para obtener una imagen del nodo.
    3.  Utiliza `jspdf` para crear el PDF, añadir la imagen y guardarlo.

### Fase 4: Integración en la Interfaz (`VentaDetailPage.tsx`)

-   **Botón de Acciones Unificado:** Se añadirá un botón "Recibo" con un menú desplegable que ofrecerá todas las opciones:
    1.  "Imprimir Nota de Venta" (abre el modal).
    2.  "Imprimir Ticket" (abre el modal).
    3.  **"Descargar Nota (PDF)"** (llama a la utilidad de generación de PDF).
    4.  **"Descargar Ticket (PDF)"** (llama a la utilidad de generación de PDF).

### Fase 5: Integración en la Lista (`VentasPage.tsx`)

-   **Propósito:** Permitir la descarga rápida sin necesidad de entrar al detalle.
-   **Implementación:**
    *   En la **vista de tabla (escritorio)**, se añadirá una nueva columna de "Acciones" con un icono de descarga (`ICONS.download`).
    *   En la **vista de tarjetas (móvil)**, se añadirá el mismo icono de descarga en un lugar visible de la tarjeta.
    *   **Acción:** Al hacer clic en este icono, se llamará directamente a la función de utilidad para generar y descargar el PDF en el formato **"Nota de Venta"** (el más formal y estándar para archivar).

### Fase 6: Estilos de Impresión (`index.css`)

-   **Propósito:** Añadir las reglas `@media print` para aislar el contenido del recibo durante la impresión desde el modal.
-   **Implementación:**
    *   Se añadirá una clase `no-print` a los componentes principales.
    *   Se crearán las reglas CSS para asegurar que solo el `div.print-modal-content` se envíe a la impresora.

---

## 4. Análisis para el Módulo de Compras

Se mantiene la recomendación de **no implementar** un sistema de recibos con diseño para las compras, ya que el documento oficial es el del proveedor. La solución de hacer la página de detalle "amigable con la impresión" sigue siendo la más pragmática y eficiente.

---

## 5. Resumen del Plan de Acción Actualizado

1.  **Crear `PrintModal.tsx`** para la previsualización de impresión.
2.  **Crear `NotaVentaTemplate.tsx` y `TicketTemplate.tsx`**.
3.  **Crear la utilidad `generatePdfFromComponent`** usando `jspdf` y `html2canvas`.
4.  **Modificar `VentaDetailPage.tsx`** para incluir un menú con las 4 opciones (imprimir/descargar para ambos formatos).
5.  **Modificar `VentasPage.tsx`** para añadir un icono de descarga directa de PDF en cada registro de la lista.
6.  **Actualizar `index.css`** con las reglas `@media print`.
