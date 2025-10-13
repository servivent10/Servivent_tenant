# Directrices para la Provisión de Scripts SQL

Este documento establece las buenas prácticas que debo seguir al proporcionar scripts SQL para la base de datos de ServiVENT. El objetivo es garantizar la seguridad, fiabilidad y facilidad de mantenimiento de la base de datos a medida que evoluciona, proporcionando al mismo tiempo una red de seguridad para la gestión de versiones.

## 1. Scripts Idempotentes

**Principio:** Todos los scripts que modifiquen la estructura o lógica de la base de datos (funciones, tablas, políticas) serán **idempotentes**.

**Definición:** Un script idempotente es aquel que puede ejecutarse una o más veces y siempre producirá el mismo resultado final, sin generar errores en ejecuciones posteriores.

**Técnicas a Utilizar:**
-   **Funciones y Vistas:** Usar `CREATE OR REPLACE` en lugar de `CREATE`.
-   **Tablas y Columnas:** Usar `ADD COLUMN IF NOT EXISTS`. Para eliminar, usar `DROP COLUMN IF EXISTS`.
-   **Políticas y Triggers:** Usar `DROP POLICY IF EXISTS` y `DROP TRIGGER IF EXISTS` antes de cada `CREATE`.
-   **Constraints:** Usar `DROP CONSTRAINT IF EXISTS` antes de `ADD CONSTRAINT`.

**Beneficio:** Reduce drásticamente el riesgo de fallos a mitad de camino y te permite aplicar actualizaciones con confianza, sabiendo que no "romperás" nada si un script se ejecuta dos veces.

## 2. Estrategia de Reversión (Rollback) - Tu Red de Seguridad

**Principio:** Para darte la flexibilidad de "deshacer" cambios en el backend que no cumplan tus expectativas, para cada script que **modifique** la base de datos (ej. `[XX]_FEATURE_...`), te proporcionaré un segundo script de **reversión** (`[XX]_REVERT_...`).

**¿Cómo funciona?**

-   **Script de Avance:** Contiene los cambios nuevos. Por ejemplo, `CREATE OR REPLACE FUNCTION mi_funcion_V2(...) ...`.
-   **Script de Reversión:** Contiene el código necesario para devolver la base de datos al estado **exactamente anterior** a la aplicación del script de avance. Por ejemplo: `CREATE OR REPLACE FUNCTION mi_funcion_V1(...) ...` (restaurando la versión V1 de la función).

**Flujo de Trabajo:**

1.  **Guardas tu versión estable:** Tienes una versión del frontend y backend que funciona.
2.  **Aplicas el script de avance:** Ejecutas el script `[XX]_FEATURE_...` que te proporciono.
3.  **Pruebas la nueva funcionalidad:** Revisas los cambios en el frontend y backend.
4.  **Decisión:**
    -   **¿Te gusta?** Perfecto. El cambio se queda.
    -   **¿No te gusta?** Simplemente ejecuta el script `[XX]_REVERT_...` correspondiente. Tu base de datos volverá al estado anterior, y puedes descartar los cambios del frontend.

**Limitación Importante:** Esta estrategia es ideal para cambios de **lógica** (funciones, políticas, vistas). Para cambios **estructurales** que implican datos (como `DROP COLUMN`), la reversión automática no es segura y el método recomendado sigue siendo una restauración desde un backup de Supabase. Afortunadamente, la mayoría de nuestras actualizaciones son de lógica.

**Beneficio:** Te da un control total y una red de seguridad, similar a `git checkout` pero para tu base de datos, permitiéndote probar nuevas funcionalidades sin miedo.

## 3. Nomenclatura Clara y Secuencial

**Principio:** Todos los scripts de base de datos seguirán una convención de nomenclatura numérica y descriptiva.

**Formato:** `[NúmeroSecuencial]_[TIPO]_[Descripción].md`
-   `[NúmeroSecuencial]`: Un número incremental de dos dígitos (ej. `01_`, `02_`).
-   `[TIPO]`: `FEATURE` para nuevas funcionalidades, `FIX` para correcciones, `REVERT` para scripts de reversión.
-   `[Descripción]`: Un nombre corto, claro y en minúsculas que describa el propósito del script (ej. `gestion_usuarios`).

**Ejemplo:**
-   `04_FEATURE_gestion_usuarios.md`
-   `04_REVERT_gestion_usuarios.md`

**Beneficio:** Crea un historial claro y ordenado de la evolución de la base de datos, similar a un sistema de migraciones. Esto facilita la revisión de cambios, la depuración y la aplicación de actualizaciones en el orden correcto.
