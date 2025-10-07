# MÓDULO 04: GESTIÓN DE PERSONAL
## Sucursales y Usuarios

Este documento define la arquitectura y funcionalidad de la gestión de sucursales y usuarios, que ahora están integrados en un único flujo coherente. Este nuevo diseño reemplaza la antigua página `/usuarios`.

## 1. Objetivo del Módulo

Centralizar y simplificar la administración de las ubicaciones físicas (sucursales) y el personal de la empresa, respetando una jerarquía de permisos clara.

## 2. Lógica de Acceso y Flujo de Usuario

El punto de entrada es la ruta `#/sucursales`, pero la vista que se muestra depende del rol del usuario:

-   **Propietario:**
    1.  Aterriza en `SucursalesListPage.tsx`.
    2.  Ve una **lista de todas las sucursales** de su empresa, mostradas como tarjetas con KPIs (Nº de usuarios, desglose por rol).
    3.  Puede **crear, editar y eliminar** sucursales.
    4.  Al hacer clic en una sucursal, navega a su página de detalle (`SucursalDetailPage.tsx`).

-   **Administrador / Empleado:**
    1.  Son **redirigidos automáticamente** desde `#/sucursales` a la página de detalle de su propia sucursal (`#/sucursales/:id`).
    2.  Esto les da una vista enfocada en su propio equipo y ubicación.

## 3. Páginas Clave

### `SucursalesListPage.tsx` (Solo Propietarios)

-   **KPIs Globales:** Muestra el total de sucursales y empleados de toda la empresa.
-   **Lista de Sucursales:** Presenta tarjetas interactivas para cada sucursal.
-   **Acciones:**
    -   **Añadir Sucursal:** Abre el modal `SucursalFormModal`. La creación está limitada por el plan de la empresa.
    -   **Botón Flotante (FAB):** Para añadir sucursales en vista móvil.

### `SucursalDetailPage.tsx` (Todos los Roles)

Es el centro de operaciones para una sucursal específica.

-   **Pestañas (Tabs):**
    1.  **Gestión de Usuarios (Vista por defecto):**
        -   Muestra KPIs de uso de usuarios del plan vs. total de la empresa.
        -   **Propietario/Admin:** Ven una lista completa del equipo de la sucursal y pueden **añadir, editar y eliminar** usuarios a través de `UserFormModal`. La creación está limitada por el plan.
        -   **Empleado:** Ve únicamente su propia tarjeta de perfil, con un botón para editarlo.
    2.  **Detalles (Solo Propietario/Admin):**
        -   Un formulario para editar la información de la sucursal (nombre, dirección, etc.).

## 4. Lógica de Backend

-   **Funciones RPC:** `get_company_sucursales`, `get_sucursal_details`, `create_sucursal`, `update_sucursal`, `delete_sucursal`, `update_company_user`.
-   **Edge Function `create-company-user`:** Se utiliza para crear nuevos usuarios. Esta función es vital porque primero valida los permisos del usuario que realiza la acción y los límites del plan de la empresa **antes** de crear la cuenta en `auth.users` y el perfil en `public.usuarios`. Esto evita usuarios "huérfanos" y violaciones de los límites del plan.
-   **Edge Function `delete-company-user`:** Se utiliza para eliminar usuarios, asegurando los permisos correctos para interactuar con el esquema `auth` de Supabase.
