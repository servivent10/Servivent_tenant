# MÓDULO 00: CORE
## Arquitectura de Persistencia de Estado Transitorio

Este documento define la arquitectura de **"Contextos de Estado Transitorio"**, un patrón fundamental en ServiVENT diseñado para proteger el trabajo en progreso del usuario contra la pérdida de datos causada por recargas de la aplicación, revalidaciones de datos o cambios de foco en la ventana del navegador.

## 1. Objetivo

El objetivo principal es garantizar una experiencia de usuario fluida y sin frustraciones. Un sistema profesional **NUNCA debe descartar los datos que un usuario está introduciendo sin su consentimiento explícito**. Esta arquitectura asegura que el estado no guardado de un formulario, un carrito de compras o cualquier flujo de varios pasos se preserve a través de las actualizaciones de la interfaz.

## 2. El Problema: El Conflicto entre Sincronización y Estado Local

La aplicación se enfrenta a dos necesidades que, sin la arquitectura correcta, entran en conflicto:

1.  **Necesidad de Sincronización:** Para garantizar la integridad de los datos, la aplicación debe estar constantemente sincronizada con el servidor. Esto se logra mediante:
    -   **Actualizaciones en Tiempo Real:** Recibidas a través de WebSockets.
    -   **Revalidación al Enfocar (`refetch-on-focus`):** Comprobación de datos al volver a la pestaña de la aplicación.
    -   **Resultado:** Estas sincronizaciones a menudo provocan una nueva renderización (`re-render`) de los componentes de la página.

2.  **Necesidad de Persistencia:** El usuario debe poder iniciar una tarea, desviarse y volver para encontrar su trabajo intacto.
    -   **Ejemplos:** Un carrito de compras a medio llenar, un formulario de creación de producto con datos ya introducidos, un asistente de compra de varios pasos.
    -   **Estado Vulnerable:** Este "estado transitorio" (aún no guardado en la base de datos) reside en la memoria del componente (usando `useState`).

**El Conflicto:** La re-renderización provocada por la sincronización "destruye" el estado local del componente, borrando todo el trabajo del usuario y creando una experiencia de usuario inaceptable.

## 3. La Solución Arquitectónica: Contextos de Estado Transitorio

La solución es aplicar el patrón de diseño **"Elevar el Estado" (State Lifting)** a nivel de arquitectura, utilizando el sistema de Contextos de React (o Preact).

**Concepto Clave:** En lugar de que una página o modal gestione su propio estado transitorio, ese estado se "eleva" a un **Proveedor de Contexto** (`Context Provider`) que envuelve a los componentes de la aplicación.

-   **La "Caja Fuerte":** El `Provider` actúa como una "caja fuerte" en la memoria de la aplicación, pero fuera del ciclo de vida de la página que se recarga.
-   **El Flujo:**
    1.  La página (`TerminalVentaPage`, `NuevaCompraPage`, etc.) ya no usa `useState` para su carrito o datos de formulario.
    2.  En su lugar, lee y escribe los datos directamente en el `Contexto` proporcionado por su `Provider` padre.
    3.  Cuando ocurre una revalidación (ej. al volver a la pestaña), la página se vuelve a renderizar para obtener datos frescos del servidor (como el stock).
    4.  Inmediatamente después, vuelve a leer el estado transitorio (el carrito, el formulario) desde el `Contexto`, que ha permanecido **intacto** durante todo el proceso.

El flujo visual es el siguiente:
```
App.tsx
└── TerminalVentaProvider (Guarda el estado del carrito aquí)
    └── TerminalVentaPage (Lee y modifica el carrito desde el Provider)
```

## 4. Implementación Práctica y Escalabilidad

Este patrón se implementará de forma modular para cada flujo de trabajo que lo necesite. Esto mantiene el código organizado y evita un único "Contexto Dios" monolítico.

-   **`TerminalVentaProvider`:** Gestionará el estado del carrito del Punto de Venta.
-   **`NuevaCompraProvider`:** Gestionará el estado del formulario de nueva compra.
-   **`ProductFormProvider`:** Gestionará el estado del formulario de creación/edición de productos, permitiendo al usuario cerrar y reabrir el modal sin perder datos.
-   **`NuevoTraspasoProvider`:** Gestionará el estado del asistente de traspaso.
-   **(Futuro)** Cualquier otro flujo complejo seguirá este mismo patrón.

## 5. Comparativa: Contexto vs. `localStorage`

Aunque `localStorage` parece una solución intuitiva, se descartó por ser una práctica riesgosa y de alto mantenimiento para el estado transitorio en una aplicación compleja como ServiVENT:

| Característica | Arquitectura de Contextos (Solución Elegida) | `localStorage` (Solución Descartada) |
| :--- | :--- | :--- |
| **Ciclo de Vida** | El estado vive en la memoria de JS. Se **limpia automáticamente** al cerrar la pestaña o la sesión. | El estado persiste en el disco del navegador. Requiere **limpieza manual** y es propenso a dejar "basura". |
| **Riesgo de Datos** | **Bajo.** El estado coexiste con los datos frescos del servidor. Es inherentemente "de sesión". | **Alto.** Riesgo de cargar datos "viejos" (ej. un ID de categoría que ya fue eliminado) que pueden causar fallos al guardar. |
| **Gestión** | **Centralizada y declarativa.** La lógica vive en el `Provider`. El componente solo consume el estado. | **Manual y propensa a errores.** Requiere lógica de `guardar/leer/limpiar` en cada componente, para cada campo. |
| **Escalabilidad** | **Alta.** Es un patrón de diseño limpio y escalable que forma parte de la arquitectura de React. | **Baja.** Se vuelve inmanejable a medida que la aplicación crece. |

## 6. Resultado Final: Experiencia de Usuario sin Interrupciones

Con esta arquitectura, logramos lo mejor de ambos mundos:

1.  **Fiabilidad de Datos:** La aplicación sigue sincronizándose y revalidando los datos del servidor para garantizar que la información (stock, precios) sea siempre precisa.
2.  **Experiencia de Usuario Fluida:** El trabajo del usuario (carritos, formularios) está completamente protegido de estas sincronizaciones de fondo, eliminando la frustración de la pérdida de datos y creando una sensación de estabilidad y profesionalismo.
