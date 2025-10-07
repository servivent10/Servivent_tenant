# MÓDULO 02: SUPERADMIN
## Panel de SuperAdmin

Este documento define la funcionalidad del panel de SuperAdmin, diseñado para la gestión global de todas las empresas (tenants) en ServiVENT.

## 1. Objetivo del Módulo

Proporcionar al administrador de ServiVENT una interfaz centralizada para supervisar y gestionar todas las empresas clientes, sus licencias, pagos y usuarios propietarios.

## 2. Páginas y Flujo de Usuario

1.  **`SuperAdminPage.tsx` (Vista de Lista):**
    -   Es la página de inicio para el SuperAdmin.
    -   Muestra una lista completa de todas las empresas registradas.
    -   La lista es responsiva (tabla en escritorio, tarjetas en móvil).
    -   Presenta información clave de cada empresa: Nombre, NIT, propietario, plan actual y estado de la licencia.
    -   Permite realizar acciones rápidas como **Suspender**, **Reactivar** y **Eliminar** una empresa a través de modales de confirmación.
    -   Al hacer clic en una empresa, se navega a la página de detalles.

2.  **`CompanyDetailsPage.tsx` (Vista de Detalle):**
    -   Ofrece una vista de 360 grados de una empresa específica.
    -   Muestra **KPIs** clave: total de usuarios, total de sucursales, estado de la licencia y días restantes.
    -   Utiliza un sistema de **pestañas** para organizar la información:
        1.  **Usuarios:** Lista todos los usuarios de la empresa, con la opción de **resetear la contraseña** del Propietario.
        2.  **Sucursales:** Lista todas las sucursales registradas por la empresa.
        3.  **Pagos de Licencia:** Muestra un historial de todos los pagos registrados. Permite **añadir un nuevo pago**, lo que también actualiza el plan y la fecha de vencimiento de la licencia de la empresa.

## 3. Lógica de Backend y Funciones Clave

Este módulo depende exclusivamente de funciones RPC de PostgreSQL con `SECURITY DEFINER` para poder acceder y modificar datos de todas las empresas, ignorando las políticas de RLS de los tenants.

-   **`get_all_companies()`:** Obtiene la lista de empresas para `SuperAdminPage`.
-   **`update_company_status_as_superadmin()`:** Cambia el estado de una licencia (Activa/Suspendida).
-   **`delete_company_forcefully` (Edge Function):** Orquesta la eliminación segura de una empresa y todos sus datos asociados (usuarios en `auth` y `public`, sucursales, licencia, etc.), evitando errores de recursión.
-   **`get_company_details()`:** Obtiene el JSON completo con toda la información para `CompanyDetailsPage` (KPIs, listas de usuarios, sucursales y pagos).
-   **`add_license_payment()`:** Registra un pago y actualiza la licencia de una empresa.
-   **`reset_owner_password_as_superadmin()`:** Establece una nueva contraseña para un usuario, encriptándola correctamente.
