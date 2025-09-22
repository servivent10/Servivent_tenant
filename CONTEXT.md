# Contexto y Arquitectura de ServiVENT

Este documento es una guía viva que describe la arquitectura, los flujos y los componentes clave de la aplicación ServiVENT a medida que se desarrolla. Su propósito es servir como referencia técnica para el equipo de desarrollo.

## 1. Stack Tecnológico

-   **Frontend:** [Preact](https://preactjs.com/) con [htm](https://github.com/developit/htm) (alternativa a JSX que no requiere transpilación).
-   **Backend (BaaS):** [Supabase](https://supabase.com/) para autenticación, base de datos (PostgreSQL), Storage y funciones RPC.
-   **Estilos:** [Tailwind CSS](https://tailwindcss.com/) para un diseño rápido y basado en utilidades.

## 2. Arquitectura General

La aplicación está estructurada como una **Single Page Application (SPA)**. El punto de entrada es `index.tsx`, que renderiza el componente principal `App.tsx`.

### `App.tsx`: El Orquestador Central

Este componente es el corazón de la aplicación y gestiona:

1.  **Estado de Autenticación:** Mantiene el estado del `session`, `displayUser` y `companyInfo`. Utiliza `onAuthStateChange` para reaccionar a inicios y cierres de sesión.
2.  **Carga de Datos Inicial:** Al detectar una sesión válida, invoca la función RPC `get_user_profile_data` para obtener de forma segura y eficiente toda la información necesaria para arrancar la sesión del usuario.
3.  **Enrutamiento:** Implementa un sistema de enrutamiento simple basado en el hash de la URL (`window.location.hash`), renderizando la página correspondiente al rol del usuario y la ruta actual.
4.  **Actualización de Estado en Vivo:** Pasa funciones de callback (`onProfileUpdate`) a los componentes hijos para permitirles actualizar el estado global del usuario (ej. cambiar el nombre o avatar) y que se refleje en toda la UI sin recargar.

### Flujo de Datos Centralizado (Backend)

Una decisión de arquitectura clave fue centralizar la lógica de acceso a datos complejos en **funciones RPC de PostgreSQL** que se ejecutan con `SECURITY DEFINER`.

-   **Propósito:** Este enfoque resuelve problemas de políticas RLS complejas, mejora el rendimiento al consolidar múltiples consultas en una sola llamada y centraliza la lógica de negocio en la base de datos.
-   **Funciones Clave:** `get_user_profile_data`, `get_all_companies`, `get_company_details`, `get_company_users`.
-   **Seguridad:** Cada función contiene una comprobación interna para asegurar que solo el rol de usuario apropiado (ej. `SuperAdmin`, `Propietario`) pueda ejecutarla.

## 3. Flujos de Usuario Implementados

#### a. Flujo de SuperAdmin

-   **Páginas:** `SuperAdminPage.tsx`, `CompanyDetailsPage.tsx`.
-   **Funcionalidad:** Gestión completa de empresas, licencias, pagos y usuarios propietarios desde un panel centralizado.

#### b. Flujo de Gestión de Licencia (Tenant)

-   **Página:** `LicenciaPage.tsx`.
-   **Funcionalidad:** Permite al Propietario/Administrador ver el estado de su plan, los límites de uso y el historial de pagos.

#### c. Flujo de Gestión de Usuarios (Tenant) - ¡NUEVO!

-   **Página:** `UsuariosPage.tsx`.
-   **Acceso y Permisos:**
    -   El **Propietario** puede ver y gestionar a todos los usuarios de todas las sucursales de la empresa.
    -   El **Administrador** solo puede ver y gestionar a los usuarios de su propia sucursal.
-   **Funcionalidad:**
    1.  La página muestra **KPIs** del número total de usuarios y un desglose por rol.
    2.  Llama a la función RPC `get_company_users` para obtener la lista de usuarios y sucursales según los permisos del rol que la llama.
    3.  Presenta una **lista de usuarios responsiva** (tabla en escritorio, tarjetas en móvil) con avatares, nombres, roles y sucursales.
    4.  Permite añadir, editar y eliminar usuarios a través de modales (funcionalidad de backend pendiente).

#### d. Flujo de "Mi Perfil" - ¡NUEVO!

-   **Componente:** `ProfileModal.tsx`, accesible desde `DashboardLayout.tsx`.
-   **Funcionalidad:**
    1.  Cualquier usuario autenticado puede hacer clic en su nombre en la barra lateral para abrir el modal de "Mi Perfil".
    2.  Dentro del modal, puede editar su nombre completo y **subir una nueva foto de perfil**.
    3.  La subida de la imagen se gestiona a través de **Supabase Storage** en un bucket llamado `avatars`.
    4.  Al guardar, se llama a la función RPC `update_my_profile` para persistir los cambios.
    5.  Gracias al callback `onProfileUpdate`, los cambios se reflejan instantáneamente en el `DashboardLayout`.

## 4. Componentes y Sistemas Clave

-   **`DashboardLayout.tsx`:** El esqueleto principal para todas las vistas. Ahora integra el modal de `ProfileModal` y utiliza el nuevo componente `Avatar`.
-   **`Avatar.tsx` (Nuevo):** Componente reutilizable que muestra la imagen de un usuario si existe una URL, o genera un avatar con sus iniciales y un color de fondo dinámico si no la hay.
-   **`ProfileModal.tsx` (Nuevo):** Modal para que los usuarios editen su propia información de perfil y suban su avatar.
-   **`UserFormModal.tsx` (Nuevo):** Modal para que los administradores y propietarios creen o editen los perfiles de otros usuarios de la empresa.
-   **`KPI_Card.tsx`:** Componente de UI reutilizable para mostrar indicadores clave. Ahora se usa también en `UsuariosPage`.
-   **Sistema de Carga y Notificaciones:** Los ganchos `useLoading` y `useToast` se utilizan en todas las páginas nuevas para proporcionar retroalimentación visual al usuario durante las operaciones asíncronas.

## 5. Páginas Implementadas

-   **Globales:**
    -   `/login`, `/registro`, `/admin-delete-tool`
-   **SuperAdmin:**
    -   `/superadmin`, `/superadmin/empresa/:id`
-   **Tenant (Propietario/Administrador):**
    -   `/dashboard`: `DashboardPage.tsx`
    -   `/licencia`: `LicenciaPage.tsx`
    -   `/usuarios`: `UsuariosPage.tsx` - **¡Ahora completamente funcional!**
    -   Otras páginas (`/inventarios`, etc.): Marcadores de posición.
