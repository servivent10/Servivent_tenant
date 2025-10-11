# MÓDULO 00: CORE
## Arquitectura en Tiempo Real

Este documento describe la lógica y el funcionamiento del sistema de notificaciones en tiempo real de ServiVENT, que permite que los cambios realizados en un dispositivo se reflejen instantáneamente en todos los demás clientes conectados.

## 1. Objetivo del Sistema

El objetivo principal es mantener la consistencia de los datos en toda la aplicación sin necesidad de que el usuario recargue la página. Por ejemplo, si un vendedor registra una venta en la `TerminalVentaPage`, o un propietario cambia una configuración de la empresa, el estado de la aplicación debe actualizarse automáticamente para todos los usuarios afectados que estén viendo cualquier página relevante (`InventariosPage`, `TerminalVentaPage`, etc.) en otros dispositivos.

## 2. Arquitectura y Flujo de Datos

El sistema se basa en la funcionalidad "Realtime" de Supabase, que escucha los cambios directamente de la base de datos PostgreSQL (`postgres_changes`). El flujo completo es el siguiente:

1.  **Cambio en la Base de Datos:** Un usuario realiza una acción que modifica una tabla (ej. `INSERT` en `ventas`, `UPDATE` en `empresas`).

2.  **Publicación de PostgreSQL (`supabase_realtime`):** La base de datos, configurada mediante el script `27_FINAL_REALTIME_PUBLICATION_FIX_V2.md`, tiene una "publicación" que le indica de qué tablas debe notificar los cambios.

3.  **Servicio de Replicación de Supabase:** La plataforma de Supabase escucha estas notificaciones de la base de datos.

4.  **Comprobación de Seguridad (La Causa del Problema y la Solución):** Antes de retransmitir una notificación a un navegador (ej. el de la tablet), el servicio de Supabase debe verificar si el usuario de la tablet tiene permiso para ver el cambio (la nueva venta). Para ello, ejecuta la Política de Seguridad a Nivel de Fila (RLS) de la tabla `ventas`.
    -   **El Problema (Recursión Infinita):** La política RLS anterior intentaba verificar el `empresa_id` del usuario consultando la tabla `public.usuarios`. Esto activaba la RLS de `usuarios`, que a su vez consultaba a `usuarios`, creando un bucle infinito. La base de datos detectaba esto, abortaba la consulta con un error, y el servicio de Supabase **descartaba silenciosamente la notificación**.
    -   **La Solución (Arquitectura JWT):** La nueva política RLS, implementada con el script `29_FINAL_RLS_RESET_V4_JWT.md`, ya no consulta la tabla `usuarios`. En su lugar, utiliza la función `public.get_empresa_id_from_jwt()`, que lee el `empresa_id` directamente del token de autenticación (JWT) del usuario. Esta operación es instantánea y no activa ninguna otra política, rompiendo el ciclo de recursión.

5.  **Transmisión (Broadcast) por WebSocket:** Con la validación de RLS ahora exitosa y sin recursión, el servicio de Supabase envía la notificación del cambio a través de WebSocket a todos los navegadores suscritos.

6.  **Receptor en el Frontend (`RealtimeProvider`):**
    -   El componente `src/hooks/useRealtime.js` es el núcleo del sistema en el frontend. Gestiona la conexión WebSocket y se suscribe a los cambios de una **lista predefinida de tablas de negocio** (ej. `ventas`, `inventarios`, `sesiones_caja`, `empresas`, etc.).
    -   Al recibir una notificación de CUALQUIER cambio (INSERT, UPDATE, DELETE) en una de estas tablas, su acción principal es **incrementar un contador de cambios (`changeCounter`)**.
    -   Adicionalmente, si el cambio proviene específicamente de la tabla `notificaciones`, también se encarga de mostrar un `Toast` al usuario (siempre que el cambio no haya sido generado por el mismo usuario).

7.  **Actualización de la UI (`useRealtimeListener`):**
    -   Las páginas como `DashboardPage`, `InventariosPage`, `TerminalVentaPage`, etc., usan el hook `useRealtimeListener`.
    -   Este hook observa el `changeCounter`.
    -   Cuando el contador cambia, ejecuta su callback, que es la función `fetchData()` de la página. Esto provoca que la página solicite los datos más recientes y se actualice de forma fluida.

## 3. Archivos Clave

-   **`src/hooks/useRealtime.js`:** El corazón del sistema en el frontend. Gestiona la conexión, recibe los mensajes y orquesta la actualización de la UI.
-   **`src/components/ConnectivityCenter.tsx`:** Un componente visual que muestra el estado de la conexión WebSocket.
-   **`docs/sql_scripts/29_FINAL_RLS_RESET_V4_JWT.md`:** La configuración de RLS que implementa la arquitectura JWT, permitiendo que el paso 4 funcione sin errores.
-   **`docs/sql_scripts/27_FINAL_REALTIME_PUBLICATION_FIX_V2.md`:** El script que configura el paso 2 (Publicación de PostgreSQL).
-   **`docs/sql_scripts/33_FEATURE_notifications.md`:** El script que configura el sistema de notificaciones, incluyendo la función `notificar_cambio` que ahora también usa la arquitectura JWT.