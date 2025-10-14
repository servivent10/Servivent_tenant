# MÓDULO 01: AUTENTICACIÓN
## Flujo de Autenticación y Registro

Este documento detalla el funcionamiento del sistema de autenticación de ServiVENT, abarcando desde el inicio de sesión de un usuario existente hasta el registro completo de una nueva empresa.

## 1. Objetivo del Módulo

Proporcionar un flujo seguro y guiado para que los usuarios accedan a sus cuentas y para que nuevos clientes puedan registrar sus empresas en el sistema a través de un proceso de varios pasos.

## 2. Componentes y Páginas Clave

-   `LoginPage.tsx`: La puerta de entrada a la aplicación para usuarios registrados del sistema (tenants).
-   `RegistrationFlow.tsx`: Un componente multi-paso que guía a los nuevos usuarios a través del proceso de registro de la empresa, la cuenta de propietario y la sucursal principal.
-   `ClienteIdentificacionPage.tsx`: La página de acceso unificada para los clientes del catálogo web.

## 3. Flujo de Inicio de Sesión (`LoginPage.tsx`)

El inicio de sesión es un proceso orquestado centralmente por `App.tsx` para garantizar robustez y una única fuente de verdad.

1.  **Interfaz de Login:** El usuario introduce sus credenciales en `LoginPage.tsx` y envía el formulario.
2.  **Llamada de Autenticación:** Se invoca la función `handleLogin` en `App.tsx`, la cual **únicamente** ejecuta `supabase.auth.signInWithPassword`. Su único propósito es autenticar, no cargar datos.
3.  **Detección del Cambio de Sesión:** El listener global `onAuthStateChange` en `App.tsx` detecta la nueva sesión y actualiza el estado `session`.
4.  **Orquestación por `App.tsx` (El `useEffect` principal):** Este es el paso más crítico. Al detectar un cambio en `session`, se ejecuta la siguiente lógica:
    a.  Se invoca la función RPC `get_user_profile_data` para obtener el perfil completo del usuario del sistema.
    b.  **Caso de Éxito:** Si la función devuelve un perfil, se considera un inicio de sesión de tenant exitoso. `App.tsx` actualiza los estados `displayUser` y `companyInfo` y redirige al usuario al panel correspondiente (`/dashboard` o `/superadmin`).
    c.  **Caso de Fallo:** Si `get_user_profile_data` falla (ej. para un SuperAdmin con datos inconsistentes, o cualquier otro error), la lógica comprueba la ruta actual:
        -   Si el usuario **no** está en una ruta de catálogo (`/catalogo/...`), se determina que es un **inicio de sesión de tenant fallido**.
        -   Para prevenir un estado corrupto o un bucle de carga, `App.tsx` muestra una notificación de error clara ("Error al cargar el perfil...") y **fuerza el cierre de la sesión** (`supabase.auth.signOut()`), devolviendo al usuario de forma segura a la página de login.

## 4. Recuperación de Sesión (Recarga de Página)

La recuperación de sesión al recargar la página es fluida y sigue una lógica similar al inicio de sesión.

1.  **Carga Inicial de `App.tsx`:** El primer `useEffect` ejecuta `supabase.auth.getSession()`.
2.  **Restauración Rápida:** Esta función de Supabase recupera la sesión activa desde el `localStorage` del navegador de forma síncrona, si existe.
3.  **Activación del Orquestador:** La recuperación de la sesión actualiza el estado `session`, lo que activa el mismo `useEffect` principal descrito en el punto 4 del flujo de inicio de sesión.
4.  **Flujo Normal:** A partir de aquí, el proceso es idéntico: se llama a `get_user_profile_data`, se cargan los datos y el usuario ve su panel correspondiente sin necesidad de volver a iniciar sesión. Este flujo funciona tanto para usuarios del sistema como para clientes del catálogo.

## 5. Flujo de Registro de Nueva Empresa (`RegistrationFlow.tsx`)

Este es un proceso guiado de varios pasos diseñado para recopilar toda la información necesaria de forma ordenada.

-   **Paso 1: Datos de la Empresa:** Se recopila el nombre y el NIT de la nueva empresa.
-   **Paso 2: Localización:** Se selecciona el país para configurar la moneda y la zona horaria por defecto.
-   **Paso 3: Cuenta de Propietario:** Se crean las credenciales para el usuario principal (rol 'Propietario').
-   **Paso 4: Sucursal Principal:** Se registran los datos de la primera sucursal.
-   **Paso 5: Elección de Plan:** El usuario selecciona uno de los planes de suscripción disponibles.

### Lógica de Backend del Registro

Al confirmar el registro, se invoca la Edge Function de Supabase `create-company-user`, que orquesta toda la creación en el backend de forma transaccional, asegurando que todos los componentes (empresa, licencia, sucursal, usuario `auth` y perfil `public`) se creen correctamente.
