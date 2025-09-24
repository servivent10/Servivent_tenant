# Contexto y Especificación: Sistema de Componentes y UI

Este documento describe la filosofía y los componentes reutilizables que conforman el sistema de diseño de ServiVENT, garantizando una experiencia de usuario coherente y profesional en toda la aplicación.

## 1. Filosofía de Diseño

-   **Consistencia:** Utilizar un conjunto definido de componentes para todas las vistas, asegurando que elementos como botones, modales y formularios se vean y se comporten de la misma manera.
-   **Retroalimentación Clara:** Proveer siempre al usuario con indicaciones visuales sobre el estado de la aplicación, utilizando indicadores de carga (`ProgressBar`, `Spinner`) y notificaciones (`Toast`).
-   **Diseño Responsivo:** Todas las vistas deben ser funcionales y estéticamente agradables en escritorio, tablet y móvil. La estrategia principal es usar tablas y botones estándar en escritorio, y transformarlos en tarjetas y botones flotantes (FAB) en pantallas más pequeñas.
-   **Estilos:** El sistema se basa exclusivamente en **Tailwind CSS** para un desarrollo rápido y mantenible.

## 2. Sistema de Retroalimentación (Hooks y Componentes)

El núcleo de la experiencia de usuario se basa en dos hooks personalizados que gestionan el estado global de la UI:

-   **`useLoading` y `ProgressBar`:**
    -   El hook `useLoading` expone las funciones `startLoading()` y `stopLoading()`.
    -   Cualquier componente puede llamar a estas funciones antes y después de una operación asíncrona (ej. una llamada a la API de Supabase).
    -   El componente `ProgressBar.tsx`, ubicado en el `DashboardLayout`, escucha el estado `isLoading` y muestra una barra de progreso animada en la parte superior de la pantalla, proporcionando una retroalimentación no intrusiva pero clara de que la aplicación está trabajando.

-   **`useToast` y `ToastContainer`:**
    -   El hook `useToast` expone la función `addToast({ message, type, duration })`.
    -   Permite a cualquier componente mostrar notificaciones flotantes (toasts) para informar al usuario sobre el resultado de una acción (éxito, error, advertencia, información).
    -   El `ToastContainer.tsx` se encarga de renderizar y animar las notificaciones en la esquina de la pantalla.

## 3. Componentes Reutilizables Clave

-   **`DashboardLayout.tsx`:** Es el componente de diseño principal que envuelve casi todas las páginas de la aplicación. Se encarga de renderizar:
    -   La barra de navegación lateral (sidebar), generando los enlaces dinámicamente según el rol del usuario.
    -   La cabecera (header) con las migas de pan (breadcrumbs) y el menú de perfil.
    -   El `ProgressBar` para la retroalimentación de carga.

-   **`ConfirmationModal.tsx`:** Un modal altamente reutilizable para cualquier acción que requiera confirmación del usuario (ej. eliminar un registro, cerrar sesión). Es personalizable en título, contenido, texto de los botones y variante de color (primario o peligro).

-   **Modales de Formulario (Ej: `UserFormModal.tsx`, `ProductFormModal.tsx`):**
    -   Siguen el patrón de usar el `ConfirmationModal` como base para su estructura y comportamiento.
    -   Contienen la lógica del formulario, validación y la llamada a la API de Supabase para guardar los datos.

-   **`KPI_Card.tsx`:** Una tarjeta de visualización de datos para mostrar indicadores clave de rendimiento (Key Performance Indicators) en los dashboards.

-   **`Tabs.tsx`:** Un componente simple para crear navegación por pestañas dentro de una página.

-   **`FloatingActionButton.tsx` (FAB):** Un botón flotante, siguiendo las directrices de Material Design, que se utiliza en vistas móviles para acciones principales como "Añadir", mejorando la ergonomía en pantallas táctiles.
