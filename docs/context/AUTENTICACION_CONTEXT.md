# MÓDULO 01: AUTENTICACIÓN
## Flujo de Autenticación y Registro

Este documento detalla el funcionamiento del sistema de autenticación de ServiVENT, abarcando desde el inicio de sesión de un usuario existente hasta el registro completo de una nueva empresa.

## 1. Objetivo del Módulo

Proporcionar un flujo seguro y guiado para que los usuarios accedan a sus cuentas y para que nuevos clientes puedan registrar sus empresas en el sistema a través de un proceso de varios pasos.

## 2. Componentes y Páginas Clave

-   `LoginPage.tsx`: La puerta de entrada a la aplicación para usuarios registrados.
-   `RegistrationFlow.tsx`: Un componente multi-paso que guía a los nuevos usuarios a través del proceso de registro de la empresa, la cuenta de propietario y la sucursal principal.

## 3. Flujo de Inicio de Sesión (`LoginPage.tsx`)

1.  **Interfaz:** Presenta un formulario simple con campos para correo electrónico y contraseña.
2.  **Lógica:**
    -   Al enviar el formulario, se llama a la función `onLogin` (proporcionada por `App.tsx`).
    -   `onLogin` ejecuta `supabase.auth.signInWithPassword`.
    -   Si las credenciales son correctas, Supabase establece una sesión de usuario.
3.  **Orquestación por `App.tsx`:**
    -   El listener `onAuthStateChange` en `App.tsx` detecta el cambio de sesión.
    -   `App.tsx` procede a cargar el perfil del usuario con `get_user_profile_data` y lo redirige a su panel correspondiente (`/dashboard` o `/superadmin`).
    -   Los errores (ej. credenciales incorrectas) se manejan localmente en `LoginPage` y se muestran al usuario mediante `useToast`.

## 4. Flujo de Registro de Nueva Empresa (`RegistrationFlow.tsx`)

Este es un proceso guiado de varios pasos diseñado para recopilar toda la información necesaria de forma ordenada.

-   **Paso 1: Datos de la Empresa:** Se recopila el nombre y el NIT de la nueva empresa.
-   **Paso 2: Localización:** Se selecciona el país para configurar la moneda y la zona horaria por defecto.
-   **Paso 3: Cuenta de Propietario:** Se crean las credenciales para el usuario principal (rol 'Propietario').
-   **Paso 4: Sucursal Principal:** Se registran los datos de la primera sucursal.
-   **Paso 5: Elección de Plan:** El usuario selecciona uno de los planes de suscripción disponibles.

### Lógica de Backend del Registro

1.  **Validación en Frontend:** Cada paso valida los campos requeridos antes de permitir que el usuario avance.
2.  **Confirmación Final:** Antes de ejecutar la lógica de backend, un modal de confirmación (`ConfirmationModal`) resume la acción para el usuario.
3.  **Llamada a Supabase:** Al confirmar, se ejecuta una secuencia de llamadas críticas:
    a.  **Llamada a Edge Function `create-company-user`**: Al confirmar, se invoca una Edge Function de Supabase. Esta función es un endpoint seguro que orquesta toda la creación en el backend de forma transaccional:
        -   Crea la cuenta del usuario en el sistema de autenticación (`auth.users`).
        -   Crea la entrada en la tabla `empresas`, incluyendo los datos de **localización (timezone y moneda)**.
        -   Crea la entrada en la tabla `licencias` con un estado inicial de "Pendiente de Aprobación" y una prueba de 30 días.
        -   Crea la `sucursal` principal.
        -   Finalmente, crea el perfil en `public.usuarios`, vinculándolo con la empresa y sucursal correctas.
    b.  **Finalización en Frontend**: Después de que la Edge Function responde con éxito, el frontend muestra un mensaje de éxito y redirige al usuario. La sesión no se inicia automáticamente para asegurar que el primer inicio de sesión sea a través del flujo normal.

Este enfoque asegura que todo el proceso sea atómico y reduce la posibilidad de datos inconsistentes.