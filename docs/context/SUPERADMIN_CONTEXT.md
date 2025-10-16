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
        4.  **Módulos:** Permite activar o desactivar Módulos Adicionales (Add-ons) para la empresa, como el "Catálogo Web".

3.  **`ModulosPage.tsx` (Gestión de Módulos):**
    -   Una nueva página que permite al SuperAdmin crear y editar los Módulos Adicionales que se pueden ofrecer a las empresas.
    -   Incluye un formulario para definir el nombre, código interno, descripción y precio de cada módulo.

## 3. Lógica de Backend y Funciones Clave

Este módulo depende exclusivamente de funciones RPC de PostgreSQL con `SECURITY DEFINER` para poder acceder y modificar datos de todas las empresas, ignorando las políticas de RLS de los tenants.

-   **`get_all_companies()`:** Obtiene la lista de empresas para `SuperAdminPage`.
-   **`update_company_status_as_superadmin()`:** Cambia el estado de una licencia (Activa/Suspendida).
-   **`delete_company_forcefully` (Edge Function):** Orquesta la eliminación segura de una empresa y todos sus datos asociados (usuarios en `auth` y `public`, sucursales, licencia, etc.), evitando errores de recursión.
-   **`get_company_details()`:** Obtiene el JSON completo con toda la información para `CompanyDetailsPage` (KPIs, listas de usuarios, sucursales y pagos).
-   **`add_license_payment()`:** Registra un pago y actualiza la licencia de una empresa.
-   **`reset_owner_password_as_superadmin()`:** Establece una nueva contraseña para un usuario, encriptándola correctamente.
-   **`update_license_end_date_as_superadmin()`:** Permite al SuperAdmin editar directamente la fecha de vencimiento de una licencia.
-   **`update_payment_and_license_as_superadmin()`:** Edita un registro de pago y la fecha de vencimiento de la licencia simultáneamente.
-   **`get_company_modules_status()`:** Obtiene la lista de módulos disponibles y su estado (activo/inactivo) para una empresa.
-   **`toggle_company_module()`:** Activa o desactiva un módulo para una empresa.
-   **`get_all_modulos_management()`:** Obtiene la lista completa de módulos para su gestión en `ModulosPage`.
-   **`upsert_modulo()`:** Crea o actualiza un módulo en el sistema.