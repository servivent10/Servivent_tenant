# MÓDULO 01: AUTENTICACIÓN
## Herramienta de Administrador

Este documento describe la funcionalidad de la "Herramienta de Eliminación de Usuario" (`AdminToolPage.tsx`), una utilidad de mantenimiento crítica pero separada de la aplicación principal.

## 1. Propósito

La herramienta fue creada para resolver un problema específico: **¿Qué sucede si el flujo de registro de una empresa falla a mitad de camino?**

En un escenario de fallo (ej. el NIT ya existe), es posible que se cree una cuenta de usuario en el sistema de autenticación de Supabase (`auth.users`), pero no se complete el registro en las tablas públicas (`empresas`, `usuarios`). Esto deja un "usuario huérfano" que no puede iniciar sesión (porque no tiene perfil) y no puede volver a registrarse (porque su correo ya existe).

La Herramienta de Administrador proporciona una interfaz segura para que un desarrollador o administrador del sistema elimine este usuario huérfano directamente, permitiendo al cliente reintentar el registro con el mismo correo.

## 2. Acceso y Seguridad

-   **Ruta:** Se accede a través de la ruta no documentada `#/admin-delete-tool`.
-   **Seguridad:** La herramienta no utiliza la sesión de la aplicación. En su lugar, requiere que el administrador ingrese manualmente la **URL del proyecto de Supabase** y la **`service_role_key`**. Esta clave otorga privilegios de superadministrador y debe manejarse con extremo cuidado. **Nunca debe ser expuesta en el código del frontend.**

## 3. Funcionalidad y Flujo de Uso

La interfaz guía al administrador a través de un proceso de 4 pasos para minimizar el riesgo de errores:

1.  **Paso 1: Ingresar Credenciales:** El administrador introduce la URL y la `service_role_key` de su proyecto de Supabase.
2.  **Paso 2: Diagnóstico (Opcional):** Un botón permite listar los primeros 10 usuarios del proyecto. Esto sirve para:
    -   Confirmar que las credenciales son correctas y la conexión es exitosa.
    -   Encontrar visualmente el usuario a eliminar y su ID sin necesidad de acceder al panel de Supabase.
3.  **Paso 3: Especificar Usuario:** El administrador pega el ID del usuario (UUID) que desea eliminar en un campo de texto. Puede copiarlo del diagnóstico o de otra fuente.
4.  **Paso 4: Verificar y Eliminar:**
    -   **Verificar Usuario:** Un botón permite obtener los detalles del usuario con el ID especificado, confirmando que se va a eliminar a la persona correcta antes de proceder.
    -   **Eliminar Permanentemente:** El botón principal que ejecuta la acción de borrado.

### Modo Avanzado (Eliminación Forzosa)

La herramienta incluye un "Modo Avanzado" que utiliza una función RPC personalizada (`delete_user_by_id_forcefully`) en lugar de la función estándar de Supabase.

-   **Propósito:** Se utiliza en casos donde la eliminación estándar falla debido a restricciones de clave foránea u otros problemas de integridad de datos.
-   **Requisito:** Requiere que la función SQL `delete_user_by_id_forcefully` haya sido creada previamente en el editor SQL de Supabase.
