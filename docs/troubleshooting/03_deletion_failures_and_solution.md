# Problema 3: Fallos en Cascada al Eliminar Entidades (Usuarios y Empresas)

-   **Fecha:** Julio, 2024
-   **Módulos Afectados:** Gestión de Usuarios (`SucursalDetailPage`), Panel de SuperAdmin (`SuperAdminPage`).

## Síntomas

Durante el desarrollo, se encontraron múltiples errores que impedían la eliminación segura y fiable de entidades clave en la base de datos. Estos problemas se manifestaron de diferentes formas:

1.  **Error de Permisos al Eliminar Usuario:** Un Propietario o Administrador no podía eliminar a un usuario de su empresa. La operación fallaba con el error: `function auth.admin_delete_user(uuid) does not exist`.
2.  **Error de Recursión al Eliminar Empresa:** Un SuperAdmin no podía eliminar una empresa. La operación fallaba con el error de base de datos: `stack depth limit exceeded`.
3.  **Reaparición del Error de Permisos:** Un intento de solucionar el error de recursión (moviendo la lógica a una función SQL) provocaba que el error de permisos del síntoma #1 volviera a aparecer en el contexto del SuperAdmin.

## Análisis de la Causa Raíz

Los tres síntomas, aunque diferentes, se originaban en dos problemas fundamentales de la interacción entre la aplicación y la arquitectura de Supabase/PostgreSQL:

### 1. Problema de Permisos

La función `auth.admin.deleteUser()` de Supabase es una operación privilegiada que requiere la `SERVICE_ROLE_KEY`. Una función de base de datos en PostgreSQL, incluso si se declara como `SECURITY DEFINER`, se ejecuta dentro del entorno de la base de datos y **no tiene los permisos** para invocar funciones del esquema `auth`. Este es un mecanismo de seguridad de Supabase. Cualquier intento de hacerlo desde SQL resultaba en el error `function does not exist`.

### 2. Problema de Recursión del Planificador de Consultas

El error `stack depth limit exceeded` no era un problema de ejecución, sino de **planificación**. Antes de ejecutar el `DELETE`, el planificador de PostgreSQL analizaba las reglas `ON DELETE CASCADE` para prever el impacto. Detectaba un **ciclo de dependencia teórico**:

`empresas` → `sucursales` (elimina sucursales) → `usuarios` (elimina usuarios de esas sucursales) → `empresas` (los usuarios tienen una referencia de vuelta a la empresa).

Este bucle, aunque lógicamente no es infinito en la práctica, era suficiente para que el planificador abortara la operación para prevenir un posible colapso.

## Solución Implementada: Arquitectura de "Demolición Controlada"

La solución final fue diseñar una arquitectura robusta que centraliza y secuencia toda la lógica de eliminación en **Edge Functions**, que actúan como un orquestador seguro y con los privilegios necesarios.

### 1. Orquestación desde Edge Functions

-   Toda la lógica de eliminación se movió a las Edge Functions (`delete-company-user` y `delete-company-forcefully`).
-   Estas funciones se ejecutan en un entorno de servidor seguro y utilizan un cliente de Supabase inicializado con la `SERVICE_ROLE_KEY`, lo que les otorga los permisos necesarios para llamar a `auth.admin.deleteUser()`.

### 2. Proceso de Demolición en Dos Etapas (para Empresas)

Para evitar el error de recursión, la función `delete-company-forcefully` implementa un proceso de "demolición controlada" en dos etapas:

-   **Etapa 1: Romper el Eslabón del Ciclo.**
    -   La Edge Function primero obtiene una lista de todos los IDs de los usuarios que pertenecen a la empresa a eliminar.
    -   Luego, itera sobre esa lista y llama a `supabaseAdmin.auth.admin.deleteUser()` para cada uno.
    -   **Este es el paso crucial:** Al eliminar los usuarios de `auth.users`, la cascada elimina sus perfiles en `public.usuarios`, rompiendo así el eslabón `usuarios -> empresas` que causaba el ciclo.

-   **Etapa 2: Ejecutar la Demolición Principal.**
    -   Solo después de que todos los usuarios han sido eliminados, la Edge Function ejecuta el comando final: `supabase.from('empresas').delete()`.
    -   En este punto, el planificador de la base de datos ve una cadena de dependencias lineal (`empresas` → `sucursales` → `productos`, etc.) y la regla `ON DELETE CASCADE` puede ejecutarse de forma segura y completa para todas las tablas restantes.

### 3. Endurecimiento de la Base de Datos

Para asegurar el éxito de la Etapa 2, se creó y ejecutó el script `09_FIX_CASCADE_DELETES.md`. Este script revisa todas las claves foráneas relevantes y se asegura de que la regla `ON DELETE CASCADE` esté aplicada correctamente, garantizando que no queden datos huérfanos.

## Lecciones Aprendidas

-   Las operaciones que involucran el esquema `auth` de Supabase deben realizarse exclusivamente desde un entorno de servidor (como Edge Functions), nunca directamente desde funciones SQL.
-   Para operaciones de eliminación complejas con `ON DELETE CASCADE`, es vital considerar el orden de las operaciones para evitar ciclos de dependencia que puedan confundir al planificador de PostgreSQL. Orquestar la eliminación en etapas desde una Edge Function es la estrategia más segura.