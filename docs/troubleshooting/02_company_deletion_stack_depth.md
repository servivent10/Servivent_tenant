# Problema 2: Error `stack depth limit exceeded` al eliminar una empresa

-   **Fecha:** Julio, 2024
-   **Módulo Afectado:** Panel de SuperAdmin (`SuperAdminPage.tsx`), Edge Function `delete-company-forcefully`.

## Síntomas

-   Al intentar eliminar una empresa desde el panel de SuperAdmin, la operación fallaba.
-   La interfaz de usuario mostraba un error genérico o se quedaba procesando indefinidamente.
-   Los logs de la Edge Function `delete-company-forcefully` mostraban el error `code: '54001', message: 'stack depth limit exceeded'`.
-   Esto ocurría a pesar de que la eliminación manual de los mismos registros directamente en la base de datos funcionaba.

## Análisis de la Causa Raíz

El problema era idéntico en su naturaleza al encontrado durante el inicio de sesión: una **recursión infinita** detectada por el **planificador de consultas de PostgreSQL**, causada por las reglas de eliminación en cascada (`ON DELETE CASCADE`).

El ciclo vicioso que el planificador detectaba era el siguiente:

1.  **Orden de Eliminación:** La Edge Function le pedía a la base de datos: "Elimina la `empresa` con ID 'X'".
2.  **Cascada a `sucursales`:** La regla `ON DELETE CASCADE` en la tabla `sucursales` se preparaba para eliminar todas las sucursales de esa empresa.
3.  **Cascada a `usuarios`:** A su vez, la regla `ON DELETE CASCADE` en la tabla `usuarios` se preparaba para eliminar a todos los usuarios de esas sucursales.
4.  **El Bucle:** La tabla `usuarios` tiene una clave foránea que apunta de vuelta a `empresas`. El planificador de la base de datos, al analizar todas las posibles consecuencias de la orden original, detectaba un camino circular: `empresas` → `sucursales` → `usuarios` → `empresas`.

Este bucle teórico, aunque no necesariamente se daría en la ejecución real, era suficiente para que el planificador abortara la operación con el error `stack depth limit exceeded` para protegerse de un posible colapso, **incluso antes de intentar ejecutar una sola línea de código**.

### Intentos Fallidos de Solución

1.  **Función Maestra Única en SQL:** Se intentó mover toda la lógica a una sola función SQL que primero borraba los usuarios y luego la empresa. Esto falló porque la sentencia final `DELETE FROM empresas` dentro de la misma función seguía activando la misma validación recursiva en el planificador.
2.  **Cambio de `SECURITY DEFINER` a `INVOKER`:** Se pensó que era un problema de permisos, pero esto no afectaba la forma en que el planificador analizaba la consulta antes de la ejecución.

## Solución Implementada: Arquitectura de "Demolición Controlada" en Dos Etapas

La solución definitiva fue separar la operación en dos transacciones completamente distintas, para que el planificador nunca viera el ciclo completo.

### 1. Etapa 1: Romper el Eslabón Débil (Función SQL `_prepare_company_for_deletion`)

-   Se creó una nueva función SQL llamada `_prepare_company_for_deletion`.
-   **Responsabilidad Única:** Su único propósito es eliminar a todos los usuarios de la empresa (`auth.admin_delete_user`), lo que a su vez elimina las filas en `public.usuarios`.
-   **El Truco:** Esta función **nunca** contiene la sentencia `DELETE FROM empresas`. Al no tenerla, el planificador no tiene motivo para revisar la cascada completa y ejecuta la eliminación de usuarios sin problemas. Este paso rompe efectivamente el eslabón del ciclo `usuarios -> empresas`.

### 2. Etapa 2: Demoler el Resto (Edge Function)

-   La Edge Function `delete-company-forcefully` fue refactorizada para actuar como un orquestador:
    1.  **Verificación de Seguridad:** Primero, valida la identidad y contraseña del SuperAdmin.
    2.  **Llama a la Etapa 1:** Invoca la función `_prepare_company_for_deletion` para eliminar a todos los usuarios.
    3.  **Llama a la Etapa 2:** Solo si el paso anterior tiene éxito, ejecuta el comando final `supabase.from('empresas').delete()`.
-   Cuando el planificador de la base de datos analiza esta segunda llamada, el "plano" que ve es ahora lineal: `empresas` → `sucursales` → (ya no hay usuarios). El ciclo está roto y la eliminación en cascada para el resto de las tablas (sucursales, licencias, productos, etc.) procede de forma segura.

## Lecciones Aprendidas

-   El planificador de consultas de PostgreSQL es extremadamente conservador y analiza las rutas de dependencia completas **antes** de la ejecución, no durante.
-   Para operaciones de eliminación complejas con cascadas circulares, la única solución es dividir la operación en transacciones separadas para "romper" el ciclo antes de ejecutar la eliminación principal.
-   Separar las responsabilidades (Edge Function para orquestación y seguridad, funciones SQL para tareas atómicas de base de datos) conduce a una arquitectura más robusta y predecible.
