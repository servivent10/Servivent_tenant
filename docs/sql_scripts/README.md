# Historial de Scripts de Base de Datos (Changelog)

Esta carpeta contiene todos los scripts SQL para configurar y mantener la base de datos de ServiVENT. Este archivo `README.md` actúa como un **índice maestro** para llevar un control claro del propósito, estado y reversión de cada script.

### Definición de Estados

-   `[CRÍTICO]`: Scripts fundamentales para la arquitectura que deben estar aplicados.
-   `[ACTIVO]`: Scripts de funcionalidades vigentes.
-   `[OBSOLETO]`: Scripts reemplazados por una versión más nueva. No es necesario ejecutarlos.
-   `[REPARACIÓN]`: Scripts para corregir problemas de datos específicos en un entorno existente.

---

## Índice de Scripts

| Archivo | Módulo | Estado | Script de Reversión | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `01_CORE_...` | Core | `[CRÍTICO]` | N/A | Crea la función principal `get_user_profile_data` para el inicio de sesión. |
| `02_CORE_...` | Core | `[CRÍTICO]` | N/A | Configura las políticas de seguridad para el almacenamiento de archivos (logos, avatares). |
| `03_FEATURE_sucursales.md` | Sucursales y Usuarios | `[ACTIVO]` | Próximamente | Añade la lógica para la gestión de sucursales. |
| `04_FEATURE_user_management.md` | Sucursales y Usuarios | `[ACTIVO]` | Próximamente | Lógica para la gestión de usuarios (crear, editar). Mueve la eliminación a una Edge Function. |
| `05_FEATURE_company_logo.md` | Configuración | `[OBSOLETO]` | N/A | Reemplazado por una función `update_company_info` más completa en scripts posteriores. |
| `06_FEATURE_superadmin.md` | SuperAdmin | `[ACTIVO]` | Próximamente | Lógica principal para el panel de SuperAdmin (listar y cambiar estado de empresas). |
| `07_FEATURE_company_details.md` | SuperAdmin | `[ACTIVO]` | Próximamente | Añade la lógica para la vista de detalle de una empresa y gestión de pagos. |
| `08_FEATURE_productos.md` | Productos | `[ACTIVO]` | Próximamente | Lógica para la gestión de productos, inventarios y precios (con margen de ganancia). |
| `09_FIX_CASCADE_DELETES.md` | Core | `[OBSOLETO]` | N/A | Reemplazado por el script `17` más completo. |
| `10_FEATURE_categorias.md` | Productos | `[ACTIVO]` | Próximamente | Añade la lógica para la gestión de categorías de productos. |
| `11_FEATURE_compras.md` | Compras | `[ACTIVO]` | Próximamente | Implementa el módulo de registro de compras a proveedores. |
| `12_SCHEMA_cleanup_...` | Core | `[ACTIVO]` | Próximamente | Elimina columnas redundantes de la tabla `empresas`. |
| `13_FIX_price_function_...` | Productos | `[ACTIVO]` | Próximamente | Corrige un error de ambigüedad de función al guardar precios de productos. |
| `14_FEATURE_clientes.md` | Clientes | `[ACTIVO]` | Próximamente | Implementa el módulo de gestión de clientes. |
| `15_FEATURE_ventas.md` | Ventas | `[ACTIVO]` | Próximamente | Implementa el módulo de registro de ventas y gestión de cuentas por cobrar. |
| `16_FEATURE_compras_filtros_...` | Compras | `[ACTIVO]` | Próximamente | Añade filtros avanzados y seguridad por rol al módulo de compras. |
| `17_FIX_FULL_CASCADE_DELETES.md` | Core | `[CRÍTICO]` | N/A | Solución completa que asegura la integridad referencial para la eliminación de empresas. |
| `18_FIX_inventory_view_and_cost.md`| Inventarios | `[ACTIVO]` | Próximamente | Corrige y enriquece la función de vista de productos para el módulo de inventario. |
| `19_FEATURE_import_export_...` | Clientes | `[ACTIVO]` | Próximamente | Añade la función de importación masiva de clientes. |
| `20_FEATURE_inventarios_filtros.md`| Inventarios | `[ACTIVO]` | Próximamente | Añade la función para obtener los datos de los filtros del inventario. |
| `21_FEATURE_inventarios_realtime_...`| Core (Realtime) | `[OBSOLETO]` | N/A | Limpia la implementación de realtime antigua basada en `pg_notify`. |
| `22_FEATURE_dashboard.md` | Dashboard | `[ACTIVO]` | Próximamente | Implementa la función `get_dashboard_data` con soporte para zona horaria. |
| `23_FEATURE_gastos.md` | Gastos | `[ACTIVO]` | Próximamente | Implementa el módulo de gastos. |
| `24` a `28` | Core (Realtime) | `[OBSOLETO]` | N/A | Reemplazados por la solución definitiva en el script `29`. |
| `29_FINAL_RLS_RESET_V4_JWT.md`| Core (Realtime) | `[CRÍTICO]` | N/A | **Solución Definitiva:** Resuelve el error de recursión infinita en RLS usando la arquitectura JWT. |
| `30_FEATURE_gastos_filtros.md`| Gastos | `[ACTIVO]` | Próximamente | Añade funciones para los filtros del módulo de gastos. |
| `31_FEATURE_compras_distribucion.md`| Compras | `[ACTIVO]` | Próximamente | Actualiza el módulo de compras para permitir la distribución de inventario. |
| `32_FEATURE_traspasos.md` | Traspasos | `[ACTIVO]` | Próximamente | Implementa el módulo de traspasos de inventario. |
| `33_FEATURE_notifications.md` | Core (Realtime) | `[ACTIVO]` | Próximamente | Implementa el sistema de notificaciones inteligentes. |
| `34_FEATURE_cajas.md` | Ventas (POS) | `[ACTIVO]` | Próximamente | Implementa el módulo de apertura y cierre de caja. |
| `35_FEATURE_cajas_modos.md` | Ventas (POS) | `[ACTIVO]` | Próximamente | Implementa la lógica para modos de caja (por sucursal o por usuario). |
| `36_FIX_cajas_modos_security.md` | Ventas (POS) | `[ACTIVO]` | Próximamente | Añade seguridad que impide cambiar el modo de caja si hay sesiones abiertas. |
| `37_FEATURE_historial_cajas.md` | Ventas (POS) | `[ACTIVO]` | Próximamente | Implementa la lógica para la nueva página de historial de arqueos de caja. |
| `38_FEATURE_realtime_updates_cajas.md`| Ventas (POS) | `[ACTIVO]` | Próximamente | Habilita las actualizaciones en tiempo real para el estado de las cajas. |
| `39_FEATURE_auditoria.md` | Auditoría | `[ACTIVO]` | Próximamente | Implementa el sistema de auditoría completa ("caja negra"). |
| `40_FEATURE_historial_inventario.md`| Inventarios | `[ACTIVO]` | Próximamente | Implementa la lógica para la nueva página de historial de movimientos de inventario. |
| `41_FEATURE_catalogo_web.md` | Catálogo Web | `[ACTIVO]` | Próximamente | Implementa la lógica para el nuevo Catálogo Web Público. |
| `42_FIX_update_prices_signature.md`| Productos | `[ACTIVO]` | Próximamente | Resuelve un error de "función no encontrada" al guardar precios de productos. |
| `43_FIX_clientes_trigger_error.md`| Clientes | `[OBSOLETO]` | N/A | Reemplazado por el script `45`. |
| `44_HOTFIX_cliente_correo_field.md`| Clientes | `[OBSOLETO]` | N/A | Reemplazado por el script `45`. |
| `45_FIX_cliente_email_column.md`| Clientes | `[ACTIVO]` | Próximamente | Solución definitiva al problema de la doble columna de correo en `clientes`. |
| `46_FEATURE_CUSTOMER_PORTAL.md` | Catálogo Web | `[ACTIVO]` | Próximamente | Implementa la lógica para el portal de clientes y el inicio de sesión sin contraseña. |
| `47_FIX_catalog_sucursales.md` | Catálogo Web | `[ACTIVO]` | Próximamente | Añade la lista de sucursales a los datos públicos del catálogo. |
| `48_FEATURE_CUSTOMER_PORTAL_EMAIL_PASSWORD.md`| Catálogo Web | `[ACTIVO]` | Próximamente | Implementa el inicio de sesión con email/contraseña para clientes. |
| `49_FEATURE_CUSTOMER_ORDER_DETAILS.md`| Catálogo Web | `[ACTIVO]` | Próximamente | Implementa la vista de detalle de pedidos para clientes. |
| `50_FEATURE_web_client_indicator.md`| Clientes / Catálogo Web | `[ACTIVO]` | Próximamente | Añade un indicador para clientes con cuenta web y elimina el `codigo_cliente`. |
| `51_FEATURE_CUSTOMER_PHONE_LINKING.md`| Catálogo Web | `[ACTIVO]` | Próximamente | Implementa la vinculación de cuentas por teléfono en el registro. |
| `52_FIX_phone_linking_notification.md`| Catálogo Web | `[ACTIVO]` | Próximamente | Corrige la falta de notificación al vincular una cuenta por teléfono. |
| `53_FEATURE_customer_addresses.md`| Catálogo Web | `[ACTIVO]` | Próximamente | Implementa el módulo completo de gestión de direcciones de cliente con mapas. |
| `FIX_remove_registration_trigger.md`| Core | `[REPARACIÓN]` | N/A | Elimina un trigger obsoleto del proceso de registro. Recomendado ejecutar siempre en proyectos nuevos. |
| `FIX_assign_owners_to_branch.md`| Sucursales y Usuarios | `[REPARACIÓN]` | N/A | Corrige perfiles de Propietarios que no están asignados a una sucursal. |
| `FIX_link_owner_to_company.md`| Core | `[REPARACIÓN]` | N/A | Repara la vinculación entre un usuario Propietario y su empresa en casos de registro fallidos. |