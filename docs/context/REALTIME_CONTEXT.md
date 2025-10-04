# Contexto y Especificación: Arquitectura en Tiempo Real

Este documento describe la lógica y el funcionamiento del sistema de notificaciones en tiempo real de ServiVENT, que permite que los cambios realizados en un dispositivo se reflejen instantáneamente en todos los demás clientes conectados.

## 1. Objetivo del Sistema

El objetivo principal es mantener la consistencia de los datos en toda la aplicación sin necesidad de que el usuario recargue la página. Por ejemplo, si un vendedor registra una venta en la `TerminalVentaPage`, el stock de los productos vendidos debe actualizarse automáticamente para otro usuario que esté viendo la página de `InventariosPage` en otro dispositivo.

## 2. Arquitectura y Flujo de Datos

El sistema se basa en la funcionalidad "Realtime" de Supabase, que escucha los cambios directamente de la base de datos PostgreSQL (`postgres_changes`). El flujo completo es el siguiente:

1.  **Cambio en la Base de Datos:** Un usuario realiza una acción que modifica una tabla (ej. `INSERT` en `ventas`, `UPDATE` en `inventarios`).

2.  **Publicación de PostgreSQL (`supabase_realtime`):** La base de datos, gracias a la configuración del script `27_FINAL_REALTIME_PUBLICATION_FIX_V2.md`, tiene una "publicación" que actúa como un cartero. Esta publicación le dice a PostgreSQL: "Notifícame de cualquier cambio que ocurra en estas tablas específicas (`ventas`, `inventarios`, `productos`, etc.)".

3.  **Servicio de Replicación de Supabase:** La plataforma de Supabase tiene un servicio que escucha constantemente las notificaciones de este "cartero".

4.  **Comprobación de Seguridad (El Paso Crítico):** Antes de retransmitir una notificación a un navegador, el servicio de Supabase realiza una última y crucial comprobación de seguridad. Mira al usuario que está en el otro extremo (ej. en la tablet) y se pregunta: **"¿El usuario de la tablet tiene permiso, según las Políticas de Seguridad a Nivel de Fila (RLS), para *VER* la nueva fila que se acaba de crear?"**.

5.  **Transmisión (Broadcast) por WebSocket:** Si la comprobación de RLS es exitosa, el servicio de Supabase envía la notificación del cambio a través de una conexión WebSocket a todos los navegadores que estén suscritos. Si la comprobación falla (como ocurría con el error de recursión infinita), la notificación se descarta silenciosamente.

6.  **Receptor en el Frontend (`RealtimeProvider`):**
    -   El componente `src/hooks/useRealtime.js` establece una conexión permanente al canal de cambios de la base de datos.
    -   Dentro de este componente, un `console.log` crucial nos permite ver **cada mensaje** que llega al navegador, lo que fue vital para el diagnóstico.
    -   Cuando llega una notificación para una tabla relevante (`ventas`, `inventarios`, etc.), el proveedor hace dos cosas:
        a.  Muestra una notificación `Toast` informativa al usuario (ej. "El inventario se ha actualizado.").
        b.  Incrementa un contador de cambios (`changeCounter`).

7.  **Actualización de la UI (`useRealtimeListener`):**
    -   Las páginas que necesitan datos en vivo (como `TerminalVentaPage`, `InventariosPage`) utilizan el hook `useRealtimeListener`.
    -   Este hook simplemente "observa" el `changeCounter` del `RealtimeProvider`.
    -   Cuando el contador cambia, el hook ejecuta la función de `callback` que se le pasó, que generalmente es `fetchData()`.
    -   Esto provoca que la página vuelva a solicitar los datos más recientes de la base de datos y se renderice de nuevo con la información actualizada.

## 3. Archivos Clave

-   **`src/hooks/useRealtime.js`:** El corazón del sistema en el frontend. Gestiona la conexión, recibe los mensajes y orquesta la actualización de la UI.
-   **`src/components/RealtimeStatusIndicator.tsx`:** Un pequeño componente visual que muestra el estado de la conexión WebSocket.
-   **`docs/sql_scripts/29_FINAL_RLS_RESET_V4_JWT.md`:** La configuración de RLS que permite que el paso 4 (Comprobación de Seguridad) funcione sin errores.
-   **`docs/sql_scripts/27_FINAL_REALTIME_PUBLICATION_FIX_V2.md`:** El script que configura el paso 2 (Publicación de PostgreSQL).