# Problema 2: Error `stack depth limit exceeded` o de permisos al eliminar una empresa

-   **Fecha:** Julio, 2024
-   **Módulo Afectado:** Panel de SuperAdmin (`SuperAdminPage.tsx`), Edge Function `delete-company-forcefully`.

## Síntomas

-   Al intentar eliminar una empresa desde el panel de SuperAdmin, la operación fallaba.
-   La interfaz de usuario mostraba un error genérico o se quedaba procesando indefinidamente.
-   Los logs de la Edge Function `delete-company-forcefully` podían mostrar dos errores diferentes:
    1.  `code: '54001', message: 'stack depth limit exceeded'`
    2.  `Error: Error en la etapa de preparación: function auth.admin_delete_user(uuid) does not exist`

## Análisis de la Causa Raíz

Ambos errores, aunque parecen diferentes, tienen la misma causa raíz: una gestión incorrecta del proceso de eliminación en cascada de Supabase.

### Causa del Error `stack depth limit exceeded`

El planificador de consultas de PostgreSQL detectaba una **recursión infinita** al analizar las reglas de eliminación en cascada (`ON DELETE CASCADE`). El ciclo vicioso era:

1.  **Orden de Eliminación:** "Elimina la `empresa` con ID 'X'".
2.  **Cascada a `sucursales`:** La regla `ON DELETE CASCADE` en `sucursales` se prepara para eliminar las sucursales.
3.  **Cascada a `usuarios`:** La regla en `usuarios` se prepara para eliminar a los usuarios de esas sucursales.
4.  **El Bucle:** La tabla `usuarios` tiene una clave foránea que apunta de vuelta a `empresas`. El planificador detectaba un camino circular: `empresas` → `sucursales` → `usuarios` → `empresas`.

Este bucle teórico era suficiente para que el planificador abortara la operación para proteger la base de datos.

### Causa del Error de Permisos (`auth.admin_delete_user does not exist`)

Este error ocurría en un intento de solución que movía la lógica de eliminación de usuarios a una función SQL (`_prepare_company_for_deletion`). El problema es que una función de PostgreSQL, incluso con `SECURITY DEFINER`, **no tiene los permisos para llamar a funciones protegidas del esquema `auth` de Supabase**. La función `auth.admin_delete_user` es una operación privilegiada que solo puede ser llamada por un cliente de Supabase inicializado con la `SERVICE_ROLE_KEY` (es decir, desde un entorno de servidor como una Edge Function).

## Solución Implementada: Arquitectura de "Demolición Controlada" Orquestada por la Edge Function

La solución definitiva fue centralizar y secuenciar toda la operación dentro de la Edge Function `delete-company-forcefully`, evitando tanto el ciclo de recursión como el problema de permisos.

1.  **Etapa 1: Romper el Eslabón Débil (Dentro de la Edge Function):**
    -   La Edge Function, después de verificar los permisos del SuperAdmin, utiliza su cliente de administrador (inicializado con la `SERVICE_ROLE_KEY`) para realizar las siguientes acciones:
        a.  **Obtener la lista de usuarios:** Hace un `SELECT` a la tabla `usuarios` para obtener todos los `id` de los usuarios que pertenecen a la empresa que se va a eliminar.
        b.  **Eliminar usuarios de `auth`:** Itera sobre esa lista y llama a `supabaseAdmin.auth.admin.deleteUser(userId)` para cada uno.
    -   **El Truco:** Esta operación elimina a los usuarios directamente del sistema de autenticación de Supabase. Gracias a la cascada en la tabla `public.usuarios`, esto también elimina sus perfiles. Crucialmente, este paso **rompe el ciclo** (`usuarios` -> `empresas`) antes de que comience la eliminación principal.

2.  **Etapa 2: Demoler el Resto (Dentro de la Edge Function):**
    -   Solo después de que la eliminación de todos los usuarios ha sido exitosa, la Edge Function ejecuta el comando final: `supabase.from('empresas').delete()`.
    -   Cuando el planificador de la base de datos analiza esta segunda llamada, el "plano" que ve ya es lineal: `empresas` → `sucursales` → (ya no hay usuarios). El ciclo está roto y la eliminación en cascada para el resto de las tablas (sucursales, licencias, productos, etc.) procede de forma segura y sin errores.

## Lecciones Aprendidas

-   El planificador de consultas de PostgreSQL es extremadamente conservador y analiza las rutas de dependencia completas **antes** de la ejecución.
-   Las funciones del esquema `auth` de Supabase son altamente protegidas y solo pueden ser llamadas desde un entorno de servidor seguro con la clave de servicio.
-   Para operaciones de eliminación complejas, la mejor arquitectura es usar una Edge Function como orquestador para secuenciar las operaciones en transacciones separadas, rompiendo cualquier ciclo de dependencia antes de ejecutar la eliminación principal.