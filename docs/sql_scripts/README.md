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
-   `09_FIX_CASCADE_DELETES.md`: **(OBSOLETO)** Reemplazado por el script 17.
-   `10_FEATURE_categorias.md`
-   `11_FEATURE_compras.md`
-   `12_SCHEMA_cleanup_empresa_contact_info.md`: Elimina columnas redundantes de la tabla de empresas.
-   `13_FIX_price_function_ambiguity.md`: Resuelve un error de ambigüedad al guardar precios de productos.
-   `14_FEATURE_clientes.md`
-   `15_FEATURE_ventas.md`
-   `16_FEATURE_compras_filtros_y_roles.md`
-   `17_FIX_FULL_CASCADE_DELETES.md`: **(IMPORTANTE)** Solución completa que asegura la integridad referencial para la eliminación de empresas.
-   `18_FIX_inventory_view_and_cost.md`: Corrige la función de vista de productos para incluir el costo y el stock mínimo, necesarios para el nuevo módulo de inventario.
-   `19_FEATURE_import_export_clientes.md`: Añade la función de importación masiva de clientes.
-   `20_FEATURE_inventarios_filtros.md`: Añade la función para obtener los datos de los filtros del inventario.

### 3. Scripts de Configuración de Tiempo Real y Seguridad

Estos scripts son fundamentales para el correcto funcionamiento de las notificaciones en tiempo real y la seguridad de los datos.

-   `21_FIX_realtime_rls_policies.md`: **(OBSOLETO)**
-   `22_FULL_RLS_RESET.md`: **(OBSOLETO)**
-   `23_FINAL_RLS_RESET.md`: **(OBSOLETO)**
-   `24_FINAL_RLS_RESET_FIXED.md`: **(OBSOLETO)**
-   `25_FINAL_RLS_RESET_V2.md`: **(OBSOLETO)**
-   `26_FINAL_REALTIME_PUBLICATION_FIX.md`: **(OBSOLETO)**
-   `27_FINAL_REALTIME_PUBLICATION_FIX_V2.md`: **(CRÍTICO)** Configura la `publication` de PostgreSQL para que la base de datos *envíe* las notificaciones.
-   `28_FINAL_RLS_RESET_V3.md`: **(OBSOLETO)** Reemplazado por la solución definitiva V4.
-   `29_FINAL_RLS_RESET_V4_JWT.md`: **(CRÍTICO Y DEFINITIVO)** Este script implementa la arquitectura JWT para resolver el error de recursión infinita en las políticas RLS, que es la causa raíz de que las notificaciones en tiempo real fallen. **Este es el script de RLS que debe usarse.**

---

### 4. ¡ACCIÓN OBLIGATORIA DESPUÉS DE LOS SCRIPTS!

Una vez ejecutados los scripts críticos (especialmente el `27` y el `29`), hay dos acciones manuales que son **fundamentales** para que las notificaciones en tiempo real funcionen.

1.  **Configuración en el Panel de Supabase:** Debes indicarle a la plataforma de Supabase qué tablas debe "escuchar" y retransmitir.
    ➡️ **[Guía de Habilitación de Replicación en Tiempo Real](../troubleshooting/04_REALTIME_FINAL_CHECK.md)**

2.  **Cierre de Sesión en la App:** Después de ejecutar el script `29_FINAL_RLS_RESET_V4_JWT.md`, **DEBES CERRAR SESIÓN Y VOLVER A INICIAR SESIÓN** en ServiVENT. Esto es obligatorio para que tu navegador obtenga el nuevo token (JWT) que contiene el `empresa_id` necesario para que las nuevas políticas de seguridad funcionen.

---

## Scripts de Corrección (Fixes)

Estos scripts están diseñados para solucionar problemas específicos o realizar migraciones de datos puntuales.

-   `FIX_remove_registration_trigger.md`: Elimina un trigger obsoleto del proceso de registro. **Recomendado ejecutar siempre**.
-   `FIX_assign_owners_to_branch.md`: Corrige perfiles de Propietarios que no están asignados a una sucursal.
-   `FIX_link_owner_to_company.md`: Repara la vinculación entre un usuario Propietario y su empresa.