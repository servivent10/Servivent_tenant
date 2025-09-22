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
3.  **Enrutamiento:** Implementa un sistema de enrutamiento basado en el hash de la URL (`window.location.hash`), renderizando la página correspondiente al rol del usuario y la ruta actual.
4.  **Actualización de Estado en Vivo:** Pasa funciones de callback (`onProfileUpdate`) a los componentes hijos para permitirles actualizar el estado global del usuario (ej. cambiar el nombre o avatar) y que se refleje en toda la UI sin recargar.

### Flujo de Datos Centralizado (Backend)

Una decisión de arquitectura clave fue centralizar la lógica de acceso a datos complejos en **funciones RPC de PostgreSQL** que se ejecutan con `SECURITY DEFINER`.

-   **Propósito:** Este enfoque resuelve problemas de políticas RLS complejas, mejora el rendimiento al consolidar múltiples consultas en una sola llamada y centraliza la lógica de negocio en la base de datos.
-   **Funciones Clave:** `get_user_profile_data`, `get_all_companies`, `get_company_details`, `get_company_sucursales`, `get_sucursal_details`, `create_company_user`, `update_company_user`, `delete_company_user`, `create_sucursal`, `update_sucursal`, `delete_sucursal`.
-   **Seguridad:** Cada función contiene una comprobación interna para asegurar que solo el rol de usuario apropiado (ej. `SuperAdmin`, `Propietario`) pueda ejecutarla.

## 3. Flujos de Usuario Implementados

#### a. Flujo de SuperAdmin

-   **Páginas:** `SuperAdminPage.tsx`, `CompanyDetailsPage.tsx`.
-   **Funcionalidad:** Gestión completa de empresas, licencias, pagos y usuarios propietarios desde un panel centralizado.

#### b. Flujo de Gestión de Licencia (Tenant)

-   **Página:** `LicenciaPage.tsx`.
-   **Funcionalidad:** Permite al Propietario/Administrador ver el estado de su plan, los límites de uso y el historial de pagos.

#### c. Flujo de Gestión de Sucursales y Usuarios (Tenant) - ¡NUEVO!

-   **Páginas:** `SucursalesListPage.tsx`, `SucursalDetailPage.tsx`.
-   **Lógica de Acceso:**
    -   El **Propietario** accede a `SucursalesListPage` donde ve una lista de todas sus sucursales.
    -   El **Administrador** y **Empleado** acceden a `SucursalesListPage` pero son **redirigidos automáticamente** al detalle de su propia sucursal (`SucursalDetailPage`).
-   **Funcionalidad en `SucursalDetailPage`:**
    1.  La página muestra KPIs específicos de la sucursal seleccionada.
    2.  Utiliza un sistema de pestañas para separar la gestión de "Detalles" de la sucursal y la "Gestión de Usuarios".
    3.  La pestaña **"Gestión de Usuarios"** reemplaza la antigua página de Usuarios, mostrando una lista de los miembros del equipo **asignados a esa sucursal específica**.
    4.  Permite añadir, editar y eliminar usuarios dentro del contexto de la sucursal, haciendo la gestión más intuitiva.

#### d. Flujo de "Mi Perfil"

-   **Componente:** `ProfileModal.tsx`, accesible desde `DashboardLayout.tsx`.
-   **Funcionalidad:**
    1.  Cualquier usuario autenticado puede hacer clic en su nombre para abrir el modal "Mi Perfil".
    2.  Dentro del modal, puede editar su nombre completo y **subir una nueva foto de perfil** a Supabase Storage.
    3.  Al guardar, se llama a la función RPC `update_my_profile` para persistir los cambios.
    4.  Gracias al callback `onProfileUpdate`, los cambios se reflejan instantáneamente en toda la aplicación.

## 4. Componentes y Sistemas Clave

-   **`DashboardLayout.tsx`:** El esqueleto principal para todas las vistas. Ahora genera los enlaces del menú dinámicamente según el rol del usuario.
-   **`Avatar.tsx`:** Componente reutilizable que muestra la imagen de un usuario o genera un avatar con sus iniciales.
-   **`ProfileModal.tsx`:** Modal para que los usuarios editen su propia información de perfil.
-   **`UserFormModal.tsx`:** Modal para que los administradores y propietarios creen o editen los perfiles de otros usuarios de la empresa.
-   **`SucursalFormModal.tsx` (Nuevo):** Modal para crear y editar la información de las sucursales.
-   **`KPI_Card.tsx`:** Componente de UI reutilizable para mostrar indicadores clave.
-   **Sistema de Carga y Notificaciones:** Los ganchos `useLoading` y `useToast` proporcionan retroalimentación visual al usuario durante las operaciones asíncronas.

## 5. Páginas Implementadas

-   **Globales:**
    -   `/login`, `/registro`, `/admin-delete-tool`
-   **SuperAdmin:**
    -   `/superadmin`, `/superadmin/empresa/:id`
-   **Tenant (Propietario/Administrador/Empleado):**
    -   `/dashboard`: `DashboardPage.tsx`
    -   `/licencia`: `LicenciaPage.tsx`
    -   `/sucursales`: `SucursalesListPage.tsx` - **¡Nueva!**
    -   `/sucursales/:id`: `SucursalDetailPage.tsx` - **¡Nueva!**
    -   Otras páginas (`/inventarios`, etc.): Marcadores de posición.