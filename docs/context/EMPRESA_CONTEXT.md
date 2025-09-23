# Contexto y Especificación: Módulo de Gestión de Empresa

Este documento define la funcionalidad de las secciones donde los usuarios administradores de una empresa (tenants) gestionan la configuración y la suscripción de su propia cuenta.

## 1. Objetivo del Módulo

Proporcionar a los Propietarios y Administradores un lugar centralizado para:
1.  Actualizar la información de su empresa (`ConfiguracionPage`).
2.  Gestionar su plan de suscripción y ver su historial de pagos (`LicenciaPage`).

## 2. Páginas Clave

### `ConfiguracionPage.tsx`

-   **Acceso:**
    -   **Propietario:** Puede ver y editar toda la información.
    -   **Administrador / Empleado:** Pueden ver la información pero los campos del formulario están deshabilitados (solo lectura).
-   **Funcionalidad:**
    -   Presenta un formulario dividido en dos secciones:
        1.  **Logo de la Empresa:** Permite al Propietario subir o cambiar el logo. La imagen se almacena en el bucket `logos` de Supabase Storage, dentro de una carpeta con el `empresa_id` para garantizar la seguridad de los datos.
        2.  **Información General:** Campos para editar el Nombre de la Empresa, NIT, Dirección y Teléfono.
-   **Lógica de Backend:** La acción de guardar invoca la función RPC `update_company_info`, que actualiza la fila correspondiente en la tabla `empresas`.

### `LicenciaPage.tsx`

-   **Acceso:** Propietario y Administrador.
-   **Funcionalidad:**
    -   **KPIs:** Muestra tarjetas con el estado actual del plan: Estado de la Licencia, Días Restantes, Límite de Usuarios y Límite de Sucursales.
    -   **Pestañas (Tabs):**
        1.  **Mi Plan:** Muestra una comparación de los planes de mejora (`UPGRADE_PLANS`), destacando el plan actual del usuario. (La funcionalidad de pago aún no está implementada).
        2.  **Historial de Pagos:** Muestra una lista (tabla/tarjetas) de todos los pagos registrados para la empresa, obtenidos del `companyInfo` que se carga al iniciar sesión.

## 3. Flujo de Datos

-   Toda la información mostrada en estas páginas (`companyInfo`) se obtiene de la llamada inicial a la función RPC `get_user_profile_data` cuando la aplicación carga.
-   Al guardar cambios en `ConfiguracionPage`, se invoca el callback `onCompanyInfoUpdate` para actualizar el estado global en `App.tsx` y que los cambios (ej. nuevo logo o nombre) se reflejen instantáneamente en toda la aplicación, como en el `DashboardLayout`.
