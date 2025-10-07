# MÓDULO 00: CORE
## Pantalla de Carga (LoadingPage)

Este documento describe la arquitectura, diseño y funcionalidad del componente `LoadingPage.tsx`, una pieza fundamental para la experiencia de usuario en ServiVENT.

## 1. Objetivo del Componente

El propósito principal de `LoadingPage` es proporcionar **retroalimentación visual clara y profesional** al usuario durante cualquier operación asíncrona que bloquee la interacción. Su objetivo es gestionar las expectativas del usuario, informarle sobre el progreso y evitar la percepción de que la aplicación se ha "colgado".

-   **Ubicación del Archivo:** `src/components/LoadingPage.tsx`

## 2. Diseño y Experiencia de Usuario (UI/UX)

El diseño se centra en ser informativo pero no intrusivo, utilizando técnicas modernas de UI para crear una experiencia pulida.

-   **Diseño de Superposición (Overlay):** En lugar de reemplazar la página actual, el `LoadingPage` se renderiza como una superposición modal (`fixed inset-0 z-50`). Esto crea una transición más suave, ya que el usuario aún puede percibir la interfaz subyacente.
-   **Efecto "Glassmorphism" (Cristal Esmerilado):** Se utiliza un doble nivel de desenfoque para lograr un efecto visualmente atractivo:
    1.  Un fondo semitransparente con un desenfoque ligero (`bg-secondary-dark/50 backdrop-blur-md`) cubre toda la pantalla.
    2.  La tarjeta central tiene un fondo más oscuro y un desenfoque más intenso (`bg-black/20 backdrop-blur-lg`), creando la apariencia de un panel de cristal esmerilado sobre el fondo.
-   **Animaciones Sutiles:**
    -   La tarjeta aparece con una animación suave de desvanecimiento hacia abajo (`animate-fade-in-down`).
    -   El logo `ServiVENT` tiene un efecto de pulso en su color de acento y un brillo sutil que lo recorre, dando una sensación de actividad.
    -   Los pasos de carga aparecen de forma secuencial, no todos a la vez.

## 3. Funcionalidad Clave

### a. Pasos de Progreso Dinámicos (`steps` prop)

El componente es altamente reutilizable gracias a su prop `steps`.

-   **Estructura:** Acepta un array de objetos, donde cada objeto representa un paso del proceso y tiene la forma:
    ```typescript
    {
      key: string;      // Identificador único
      label: string;    // Texto que ve el usuario (ej. "Cargando Perfil...")
      status: 'pending' | 'loading' | 'success' | 'error';
    }
    ```
-   **Renderizado Dinámico:**
    -   El componente solo muestra los pasos cuyo estado **no** es `'pending'`.
    -   A medida que el proceso avanza en el componente padre (ej. `App.tsx`), el estado de cada paso se actualiza, y la UI reacciona en tiempo real.
    -   Cada paso muestra un indicador de estado visual: un `Spinner` para `'loading'`, un ícono de éxito para `'success'` y un ícono de error para `'error'`.

### b. Mecanismo de Seguridad (Failsafe)

Para evitar que el usuario quede bloqueado indefinidamente por un error inesperado, el componente incluye un mecanismo de seguridad.

-   **Funcionamiento:** Se activa un temporizador de 10 segundos cuando el `LoadingPage` aparece.
-   **Botón de Escape:** Si la operación no ha terminado después de 10 segundos, aparece un botón ("¿Tarda más de lo esperado? Haz clic aquí.").
-   **Acción:** Al hacer clic, se invoca la función `onForceLogout` (pasada como prop), que generalmente resetea el estado de la aplicación y devuelve al usuario a la página de inicio de sesión.

## 4. Escenarios de Uso en la Aplicación

El `LoadingPage` se utiliza en tres contextos principales, todos orquestados desde `App.tsx`:

1.  **Carga Inicial de Datos (`loading` state):**
    -   **Activación:** Se muestra cuando un usuario tiene una sesión válida pero la aplicación aún no ha cargado su perfil y los datos de la empresa (`displayUser` es nulo).
    -   **Pasos Típicos:** "Cargando Perfil de Usuario", "Verificando Información de la Empresa", etc.

2.  **Cierre de Sesión (`isLoggingOut` state):**
    -   **Activación:** Se muestra cuando el usuario confirma el cierre de sesión, antes de que Supabase complete la operación.
    -   **Pasos Típicos:** "Cerrando sesión en el servidor", "Limpiando datos de la aplicación".
    -   **Propósito:** Transforma el cierre de sesión de un evento abrupto a un proceso guiado y seguro.

3.  **Flujo de Registro (`RegistrationFlow.tsx`):**
    -   **Activación:** Se muestra después de que el nuevo usuario completa el formulario y confirma el registro, mientras la Edge Function de Supabase crea la empresa, la licencia, la sucursal y el usuario en la base de datos.
    -   **Pasos Típicos:** "Creando cuenta, empresa y sucursal...", "Finalizando y preparando todo".
