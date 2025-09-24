# Contexto y Especificación: Flujo de Autenticación y Registro

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

Este es un proceso de 4 pasos diseñado para recopilar toda la información necesaria de forma ordenada.

-   **Paso 1: Datos de la Empresa:** Se recopila el nombre, NIT, dirección y teléfono de la nueva empresa.
-   **Paso 2: Cuenta de Propietario:** Se crean las credenciales para el usuario principal (rol 'Propietario'), incluyendo nombre, correo y contraseña.
-   **Paso 3: Sucursal Principal:** Se registran los datos de la primera sucursal, que por defecto se llama "Sucursal Principal".
-   **Paso 4: Elección de Plan:** El usuario selecciona uno de los planes de suscripción disponibles, incluyendo la prueba gratuita.

### Lógica de Backend del Registro

1.  **Validación en Frontend:** Cada paso valida los campos requeridos antes de permitir que el usuario avance.
2.  **Confirmación Final:** Antes de ejecutar la lógica de backend, un modal de confirmación (`ConfirmationModal`) resume la acción para el usuario.
3.  **Llamada a Supabase:** Al confirmar, se ejecuta una secuencia de llamadas críticas:
    a.  `supabase.auth.signUp`: Se crea la cuenta del usuario en el sistema de autenticación de Supabase (`auth.users`).
    b.  `supabase.rpc('finish_registration', ...)`: Se llama a una función de base de datos que realiza el resto del trabajo de forma transaccional:
        -   Crea la entrada en la tabla `empresas`.
        -   Crea la entrada en la tabla `licencias` basada en el plan seleccionado.
        -   Crea la entrada en la tabla `sucursales`.
        -   **Crucialmente**, crea el perfil en la tabla `public.usuarios` y lo vincula con el `empresa_id` y `sucursal_id` correctos.
    c.  `supabase.auth.signOut`: Inmediatamente después del registro exitoso, se cierra la sesión del nuevo usuario. Esto es intencional para forzarlo a pasar por el flujo de inicio de sesión normal, asegurando que `App.tsx` cargue su perfil completo y lo redirija correctamente.

Este enfoque asegura que todo el proceso sea atómico y reduce la posibilidad de datos inconsistentes.
