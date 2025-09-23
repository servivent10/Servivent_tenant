# Contexto de Arquitectura General: ServiVENT

Este documento es la guía maestra que describe la arquitectura, los flujos de datos y los componentes clave de la aplicación ServiVENT.

## 1. Stack Tecnológico

-   **Frontend:** [Preact](https://preactjs.com/) con [htm](https://github.com/developit/htm) (alternativa a JSX que no requiere transpilación).
-   **Backend (BaaS):** [Supabase](https://supabase.com/) para autenticación, base de datos (PostgreSQL), Storage, funciones RPC y Edge Functions.
-   **Estilos:** [Tailwind CSS](https://tailwindcss.com/) para un diseño rápido y basado en utilidades.

## 2. Arquitectura General

La aplicación está estructurada como una **Single Page Application (SPA)**. El punto de entrada es `index.tsx`, que renderiza el componente principal `App.tsx`.

### `App.tsx`: El Orquestador Central

Este componente es el corazón de la aplicación y gestiona:

1.  **Estado de Autenticación:** Mantiene el estado del `session`, `displayUser` y `companyInfo`. Utiliza `onAuthStateChange` para reaccionar a inicios y cierres de sesión.
2.  **Carga de Datos Inicial:** Al detectar una sesión válida, invoca la función RPC `get_user_profile_data` para obtener de forma segura y eficiente toda la información necesaria para arrancar la sesión del usuario.
3.  **Enrutamiento:** Implementa un sistema de enrutamiento basado en el hash de la URL (`window.location.hash`), renderizando la página correspondiente al rol del usuario y la ruta actual.
4.  **Actualización de Estado en Vivo:** Pasa funciones de callback (`onProfileUpdate`, `onCompanyInfoUpdate`) a los componentes hijos para permitirles actualizar el estado global y que se refleje en toda la UI sin recargar.

### Lógica de Backend Centralizada

La arquitectura del backend se basa en dos pilares principales dentro de Supabase:

#### a. Funciones RPC de PostgreSQL

Se utilizan funciones con `SECURITY DEFINER` para consolidar lógica de negocio compleja, mejorar el rendimiento y evitar problemas de recursividad con las políticas de RLS.
-   **Propósito:** Este enfoque resuelve problemas de RLS, mejora el rendimiento al reducir múltiples consultas en una sola llamada y centraliza la lógica de negocio en la base de datos.
-   **Funciones Clave:** `get_user_profile_data`, `get_all_companies`, `get_company_details`, `get_company_sucursales`, `update_my_profile`, etc.

#### b. Supabase Edge Functions

Para operaciones que requieren lógica más compleja o que combinan pasos de autenticación y base de datos, se utilizan Edge Functions.
-   **`create-company-user`:** Esta función es crucial para crear nuevos usuarios, ya que valida los permisos del llamador y los límites del plan de la empresa antes de interactuar con `auth.users` y `public.usuarios`, reemplazando la antigua lógica de triggers de base de datos que era propensa a errores.

## 3. Componentes y Sistemas Clave Reutilizables

-   **`DashboardLayout.tsx`:** El esqueleto principal para todas las vistas, generando menús dinámicos según el rol.
-   **`ConfirmationModal.tsx`:** Modal genérico para acciones de confirmación (ej. eliminar, cerrar sesión).
-   **`KPI_Card.tsx`:** Tarjeta de UI para mostrar indicadores clave de rendimiento.
-   **`Tabs.tsx`:** Componente de navegación por pestañas.
-   **`Avatar.tsx`:** Muestra la imagen de un usuario o un avatar con iniciales.
-   **`FloatingActionButton.tsx`:** Botón flotante para acciones principales en vistas móviles.
-   **Sistema de Carga y Notificaciones:** Los ganchos `useLoading` y `useToast` proporcionan retroalimentación visual consistente en toda la aplicación.
