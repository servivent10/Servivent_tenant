# Scripts de Base de Datos

Esta carpeta contiene todos los scripts SQL necesarios para configurar, mantener y reparar la base de datos de ServiVENT en Supabase.

## Orden de Ejecución para un Nuevo Proyecto

Para una instalación desde cero, se recomienda ejecutar los scripts en el siguiente orden numérico.

### 1. Scripts Core (Estructura Fundamental)

Estos scripts establecen las funciones y políticas de seguridad más importantes.

-   `00_DATABASE_SCHEMA.md`: **(Referencia)** No es un script ejecutable, sino una guía de la estructura de tablas.
-   `01_CORE_get_user_profile_data.md`: Crea la función principal para la carga de datos del usuario al iniciar sesión.
-   `02_CORE_storage_rls_policies.md`: Configura las políticas de seguridad para la subida de archivos (avatares y logos).

### 2. Scripts de Funcionalidades (Features)

Estos scripts añaden la lógica de backend para los diferentes módulos de la aplicación.

-   `03_FEATURE_sucursales.md`
-   `04_FEATURE_user_management.md`
-   `05_FEATURE_company_logo.md`
-   `06_FEATURE_superadmin.md`
-   `07_FEATURE_company_details.md`
-   `08_FEATURE_productos.md`

## Scripts de Corrección (Fixes)

Estos scripts están diseñados para solucionar problemas específicos o realizar migraciones de datos puntuales. **No siempre necesitan ser ejecutados en un proyecto nuevo**, pero son cruciales para mantener la integridad de los datos en instancias existentes.

-   `FIX_remove_registration_trigger.md`: Elimina un trigger obsoleto del proceso de registro. **Recomendado ejecutar siempre**.
-   `FIX_assign_owners_to_branch.md`: Corrige perfiles de Propietarios que no están asignados a una sucursal.
-   `FIX_link_owner_to_company.md`: Repara la vinculación entre un usuario Propietario y su empresa.