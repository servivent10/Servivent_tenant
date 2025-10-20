# Proceso de Trabajo Riguroso para el Desarrollo de ServiVENT

Este documento establece el proceso metodológico y la lista de verificación que seguiré rigurosamente para cada solicitud de cambio en la aplicación ServiVENT. Su propósito es garantizar la máxima calidad, prevenir regresiones (errores introducidos por nuevas funcionalidades) y asegurar que cada modificación sea coherente con la arquitectura general del proyecto.

Este proceso es un complemento directo a las `INSTRUCCIONES.md` y mi compromiso contigo para la mantenibilidad a largo plazo del sistema.

## Principios Fundamentales

Antes de cada acción, me guiaré por estos cuatro principios inquebrantables:

1.  **No Dañar (Primum non nocere):** Mi prioridad número uno es asegurar que la nueva funcionalidad no rompa ninguna existente. Cada cambio debe ser seguro.
2.  **Fuente Única de Verdad (SSOT - Single Source of Truth):** Lucharé activamente contra la duplicación de código. Si una misma lógica de negocio (como la función `registrar_compra`) existe en múltiples lugares, mi prioridad será unificarla en una única versión correcta y consistente.
3.  **Cambios Mínimos y Atómicos:** Realizaré los cambios más pequeños y enfocados posibles para satisfacer la solicitud. Esto minimiza el riesgo de efectos secundarios inesperados y hace que las actualizaciones sean más fáciles de entender y verificar.
4.  **Consistencia Arquitectónica:** Cada línea de código nuevo o modificado respetará las reglas y patrones establecidos en las `INSTRUCCIONES.md`, desde el estilo de la UI hasta la arquitectura de la base de datos.

## El Proceso de Desarrollo (Checklist por Solicitud)

Para cada solicitud que me hagas, seguiré estos 4 pasos sin excepción:

### Paso 1: Comprensión y Análisis de Impacto

Antes de escribir una sola línea de código:

-   **[✓] Entender la Solicitud:** Analizaré a fondo tu petición para comprender no solo el "qué", sino también el "porqué".
-   **[✓] Análisis de Impacto Holístico:** Realizaré una **búsqueda global en todo el proyecto** (archivos de frontend `.tsx`, `.js` y todos los scripts de backend `.md` en `docs/sql_scripts/`) para identificar cada lugar donde la función, componente, tabla o lógica a modificar se utiliza o se define.
-   **[✓] Identificar Archivos Afectados:** Crearé una lista mental de todos los archivos que necesitarán ser modificados para asegurar que no quede ninguna inconsistencia.

### Paso 2: Implementación y Unificación

Con un plan claro, procederé a la codificación:

-   **[✓] Unificar Lógica Duplicada:** Si en el paso anterior detecté lógica duplicada, mi primera acción será consolidarla en una única función o componente robusto.
-   **[✓] Escribir el Código:** Implementaré la nueva funcionalidad o corrección, adhiriéndome estrictamente a los **Principios Fundamentales**.
-   **[✓] Seguir las `INSTRUCCIONES.md`:** Aplicaré todas las reglas de UI/UX, formato de moneda, arquitectura de backend (uso de RPCs, lógica JWT para RLS), etc.

### Paso 3: Verificación Cruzada y Simulación de Pruebas

Antes de finalizar, realizaré una "revisión de código" de mi propio trabajo:

-   **[✓] Revisar vs. Solicitud:** ¿El cambio satisface completamente la petición original?
-   **[✓] Comprobar Efectos Secundarios:** Basado en el análisis de impacto, simularé mentalmente cómo el cambio podría afectar otras partes de la aplicación. Por ejemplo, si cambio una función RPC, revisaré cada componente del frontend que la llama.
-   **[✓] Validar vs. Principios:** ¿Es el cambio mínimo posible? ¿Mantiene la consistencia? ¿Eliminó la duplicación de código?

### Paso 4: Entrega Documentada

Mi respuesta final siempre seguirá el formato establecido:

-   **[✓] Preparar el XML:** Generaré el bloque `<changes>` conteniendo **únicamente** los archivos que han sido modificados.
-   **[✓] Escribir la Explicación:** Redactaré el resumen en lenguaje natural (`"Entendido. He [acción]..."`) que explica de forma clara y concisa qué hice, qué archivos modifiqué y por qué, dándote total visibilidad sobre el proceso.

---

Este proceso es mi "contrato de calidad" contigo. Al seguirlo rigurosamente, garantizamos que ServiVENT evolucione de manera sólida, segura y mantenible.
