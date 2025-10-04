# Problema 4: El Fallo Silencioso - Recursión Infinita en Políticas RLS de Tiempo Real

-   **Fecha:** Julio, 2024
-   **Módulos Afectados:** Sistema de Tiempo Real (`useRealtime.js`), Políticas de Seguridad a Nivel de Fila (RLS).

## Síntomas

Este fue uno de los problemas más difíciles y engañosos de diagnosticar, caracterizado por una "falla silenciosa":

1.  **Ausencia de Notificaciones:** Se realizaba una acción en un cliente (ej. una venta en la PC) que modificaba la base de datos, pero **ninguna notificación** o `console.log` aparecía en la consola del navegador del otro cliente (ej. la tablet).
2.  **Conexión Aparentemente Exitosa:** La UI de la aplicación (el `RealtimeStatusIndicator`) mostraba que la conexión en tiempo real estaba `SUBSCRIBED` (activa y funcionando).
3.  **El Error Clave (en los Logs de Supabase):** El único lugar donde se manifestaba el problema era en los logs del servicio "Realtime" dentro del panel de Supabase. El error era: `PoolingReplicationError: ... "infinite recursion detected in policy for relation \\\"usuarios\\\""`.

## Análisis de la Causa Raíz

El problema residía en la interacción entre el servicio de tiempo real de Supabase y las políticas de seguridad (RLS) de PostgreSQL. El flujo que causaba el fallo era el siguiente:

1.  **Cambio Detectado:** El servicio de Realtime detecta un cambio en una tabla, por ejemplo, un `INSERT` en la tabla `ventas`.
2.  **Validación de Permisos:** Antes de enviar la notificación al navegador de la tablet, el servicio debe asegurarse de que el usuario de la tablet tiene permiso para ver esa nueva venta. Para ello, intenta ejecutar la política RLS de la tabla `ventas` en nombre de ese usuario.
3.  **Inicio de la Recursión:** Nuestras políticas RLS (versiones V2 y V3) para la tabla `ventas` contenían una subconsulta para determinar a qué empresa pertenece el usuario actual. La consulta era similar a: `... WHERE empresa_id = (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid())`.
4.  **El Ciclo Mortal:** Para poder ejecutar esa subconsulta, PostgreSQL primero debe aplicar la política RLS de la tabla `public.usuarios`. Pero la política de `usuarios` también contenía una consulta a sí misma para verificar el `empresa_id`. Esto creaba un ciclo infinito:
    -   El servicio de Realtime pregunta: "¿Puede el usuario ver esta **venta**?"
    -   La RLS de `ventas` responde: "Necesito saber su `empresa_id`. Voy a consultarlo en **`usuarios`**."
    -   La RLS de `usuarios` se activa y pregunta: "¿Puede este usuario ver su propio perfil en **`usuarios`**?"
    -   La RLS de `usuarios` responde: "Necesito saber su `empresa_id`. Voy a consultarlo en **`usuarios`**."
    -   ...y así sucesivamente.
5.  **Fallo y Descarte Silencioso:** La base de datos detecta esta recursión, aborta la consulta y devuelve un error. El servicio de Realtime interpreta este error como un "no" a la pregunta de permisos y, en lugar de notificar un error al cliente, simplemente **descarta la notificación**. Por eso, el navegador nunca recibía nada.

## La Solución Definitiva: Arquitectura JWT

La única forma de romper este ciclo era obtener el `empresa_id` del usuario **sin consultar la tabla `public.usuarios` en absoluto**. La solución, implementada en el script `29_FINAL_RLS_RESET_V4_JWT.md`, consistió en una re-arquitectura completa:

1.  **Sincronizar `empresa_id` con `auth.users`:** Se creó un `TRIGGER` en la base de datos. Cada vez que se crea o actualiza un perfil en `public.usuarios`, este trigger copia el valor de `empresa_id` a un campo de metadatos (`raw_app_meta_data`) en la tabla `auth.users`, que es la tabla de autenticación interna de Supabase.

2.  **Incrustar en el JWT:** Por diseño, Supabase incluye automáticamente el contenido de `raw_app_meta_data` dentro del **JSON Web Token (JWT)** que entrega al usuario cada vez que inicia sesión.

3.  **Nuevas Políticas RLS Basadas en JWT:**
    -   Se creó una nueva función SQL, `get_empresa_id_from_jwt()`, extremadamente simple y rápida. Esta función no consulta ninguna tabla; simplemente lee el `empresa_id` directamente del JWT del usuario activo.
    -   **TODAS las políticas RLS** del sistema se reescribieron para usar esta nueva función. Ahora, la política de `ventas` dice: `... WHERE empresa_id = public.get_empresa_id_from_jwt()`.

### ¿Por Qué Funciona?

La nueva política RLS ya no necesita consultar la tabla `usuarios` para verificar los permisos. La comprobación se resuelve instantáneamente leyendo un dato que ya está presente en el token de autenticación del usuario. Esto rompe el ciclo de recursión de raíz y permite que la validación de permisos del servicio de tiempo real se complete con éxito, enviando la notificación al navegador como se esperaba.

### Acción Crucial del Usuario

Un último paso fue fundamental: después de aplicar el script, era **obligatorio que el usuario cerrara sesión y volviera a iniciarla**. Esto fuerza al navegador a solicitar un **nuevo JWT**, que ahora sí contendría el `empresa_id` en sus metadatos, completando la solución.