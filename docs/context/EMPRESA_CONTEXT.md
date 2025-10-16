# MÓDULO 03: GESTIÓN DE EMPRESA
## Configuración y Licencia

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
    -   Presenta un formulario dividido en secciones a través de pestañas:
        1.  **Datos de la Empresa:** Permite al Propietario subir o cambiar el logo y editar el Nombre de la Empresa y el NIT.
        2.  **Listas de Precios:** Gestiona las diferentes políticas de precios. Esta pestaña solo es visible si el plan actual de la empresa tiene la característica `listasPrecios` activada.
        3.  **Terminal de Venta:** Configura el modo de operación de las cajas.
        4.  **Catálogo Web:** Si la empresa tiene el **Módulo de Catálogo Web** activado (independientemente de su plan), esta pestaña aparecerá, permitiendo al Propietario configurar la URL única (`slug`) para su catálogo público.
-   **Lógica de Backend:** La acción de guardar invoca la función RPC `update_company_info`, que actualiza la fila correspondiente en la tabla `empresas`.

### `LicenciaPage.tsx`

-   **Acceso:** Propietario y Administrador.
-   **Funcionalidad:**
    -   **KPIs:** Muestra tarjetas con el estado actual del plan: Estado de la Licencia, Días Restantes, Límite de Usuarios y Límite de Sucursales.
    -   **Pestañas (Tabs):**
        1.  **Mi Plan:** Muestra una comparación de los planes de mejora, destacando el plan actual del usuario.
        2.  **Historial de Pagos:** Muestra una lista (tabla/tarjetas) de todos los pagos registrados para la empresa.

## 3. Flujo de Datos

-   Toda la información mostrada en estas páginas (`companyInfo`) se obtiene de la llamada inicial a la función RPC `get_user_profile_data` cuando la aplicación carga.
-   Al guardar cambios en `ConfiguracionPage`, se invoca el callback `onCompanyInfoUpdate` para actualizar el estado global en `App.tsx` y que los cambios (ej. nuevo logo o nombre) se reflejen instantáneamente en toda la aplicación, como en el `DashboardLayout`.