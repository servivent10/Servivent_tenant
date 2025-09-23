# Problema 1: Error `stack depth limit exceeded` al iniciar sesión

-   **Fecha:** Julio, 2024
-   **Módulo Afectado:** Carga de datos del usuario y la empresa (`App.tsx`).

## Síntomas

-   La aplicación se quedaba "colgada" indefinidamente en la pantalla de carga (`LoadingPage.tsx`).
-   La consola del navegador mostraba un error `500 (Internal Server Error)` al intentar hacer un `select` a la tabla `empresas`.
-   El detalle del error de Supabase era `code: '54001', message: 'stack depth limit exceeded'`.
-   El proceso de carga se detenía en "Verificando Información de la Empresa...".

## Análisis de la Causa Raíz

El problema era causado por una **recursión infinita** entre las políticas de seguridad a nivel de fila (RLS) de las tablas `usuarios` y `empresas`. El flujo era el siguiente:

1.  **Llamada Inicial:** El frontend, después de que el usuario iniciaba sesión, intentaba obtener los datos de la empresa del usuario actual (`select * from empresas where id = ...`).
2.  **Activación de Política RLS en `empresas`:** La política de seguridad de la tabla `empresas` se activaba para verificar si el usuario tenía permiso para ver esa fila. Para hacerlo, esta política necesitaba consultar la tabla `usuarios` para obtener el `empresa_id` del usuario autenticado.
3.  **Activación de Política RLS en `usuarios`:** Al intentar leer la tabla `usuarios`, se activaba la política de seguridad de *esa* tabla. Esta política, a su vez, necesitaba verificar a qué empresa pertenecía el usuario, por lo que intentaba consultar la tabla `empresas`.
4.  **Bucle Infinito:** Esto creaba un ciclo sin fin: `select from empresas` -> `RLS empresas` -> `select from usuarios` -> `RLS usuarios` -> `select from empresas`... y así sucesivamente.

Este bucle consumía rápidamente la pila de llamadas de la base de datos, resultando en el colapso de la consulta y el error `stack depth limit exceeded`.

## Solución Implementada

La solución fue evitar por completo las políticas RLS durante la carga inicial de datos, centralizando toda la lógica en una única función de base de datos con privilegios elevados.

1.  **Creación de una Función RPC:** Se creó una función PostgreSQL llamada `get_user_profile_data`.
2.  **Uso de `security definer`:** La función fue declarada como `security definer`. Esto es clave, ya que le indica a PostgreSQL que ejecute la función con los permisos del usuario que la *definió* (el administrador), en lugar de los permisos del usuario que la *llama*. En la práctica, esto hace que la función **ignore temporalmente las políticas RLS** del usuario que ha iniciado sesión.
3.  **Consulta Única y Completa:** La función se diseñó para obtener **toda la información necesaria** para el arranque de la aplicación en una sola consulta eficiente:
    -   Datos del perfil del usuario (`usuarios`).
    -   Datos de la empresa (`empresas`).
    -   El plan actual del usuario (`licencias`).
    -   El nombre de la sucursal principal (`sucurales`).
4.  **Refactorización del Frontend:** En `App.tsx`, se eliminaron las llamadas separadas a las tablas. En su lugar, ahora se realiza una única llamada a la función RPC: `supabase.rpc('get_user_profile_data')`.

Este enfoque no solo resolvió el error de recursión de forma definitiva, sino que también optimizó el rendimiento al reducir múltiples llamadas de red a una sola.

## Lecciones Aprendidas

-   Inicialmente, la función solo obtenía los datos del usuario, lo que solucionó el primer bucle pero no el segundo que se activaba al consultar la tabla `empresas`.
-   Al intentar modificar la función para que devolviera más columnas (los datos de la empresa), nos encontramos con el error `cannot change return type of existing function`. La lección fue que para modificar la "firma" (los parámetros de entrada o salida) de una función en PostgreSQL, primero hay que eliminarla con `DROP FUNCTION IF EXISTS ...` antes de volver a crearla con `CREATE OR REPLACE FUNCTION`.
