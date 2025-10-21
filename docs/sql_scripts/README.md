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
| `54_FIX_audit_trigger_fkey.md`| Auditoría | `[ACTIVO]` | Próximamente | Elimina la FK en `historial_cambios.usuario_id` para permitir auditoría de no-tenants. |
| `55_FIX_notifications_fkey.md`| Core (Realtime) | `[ACTIVO]` | Próximamente | Elimina la FK en `notificaciones.usuario_generador_id` para permitir notificaciones de no-tenants. |
| `56_FIX_web_order_sucursal_constraint.md`| Catálogo Web | `[ACTIVO]` | `56_REVERT_...` | Elimina la constraint `NOT NULL` en `ventas.sucursal_id` para permitir pedidos web de envío a domicilio. |
| `57_FIX_traspasos_cascade_delete.md`| Traspasos | `[CRÍTICO]` | `57_REVERT_...` | Corrige la restricción de clave foránea en `traspaso_items` para permitir la eliminación en cascada de productos. |
| `58_FEATURE_user_email_validation.md`| Sucursales y Usuarios | `[ACTIVO]` | `58_REVERT_...` | Añade la función para la validación de correo de usuario en tiempo real. |
| `DATA_INTEGRITY_FIX.md`| Core | `[REPARACIÓN]` | N/A | Script maestro que unifica y corrige los problemas de datos más comunes. |
| `FIX_remove_registration_trigger.md`| Core | `[OBSOLETO]` | N/A | Reemplazado por `DATA_INTEGRITY_FIX.md`. |
| `FIX_assign_owners_to_branch.md`| Sucursales y Usuarios | `[OBSOLETO]` | N/A | Reemplazado por `DATA_INTEGRITY_FIX.md`. |
| `FIX_link_owner_to_company.md`| Core | `[OBSOLETO]` | N/A | Reemplazado por `DATA_INTEGRITY_FIX.md`. |
| `58_FEATURE_dynamic_plans.md` | SuperAdmin / Planes | `[ACTIVO]` | `58_REVERT_dynamic_plans.md` | Implementa el sistema de gestión de planes dinámicos desde la base de datos. |
| `59_FEATURE_dynamic_plans_enforcement.md` | Core / Planes | `[OBSOLETO]` | Próximamente | Reemplazado por el script 68. |
| `60_FEATURE_dynamic_plans_save.md` | SuperAdmin / Planes | `[ACTIVO]` | `60_REVERT_dynamic_plans_save.md` | Añade la función para guardar la configuración completa de un plan. |
| `61_FEATURE_superadmin_edit_payment.md` | SuperAdmin | `[ACTIVO]` | `62_REVERT_superadmin_edit_payment.md` | Añade funciones para editar pagos y licencias, corrigiendo un error. |
| `63_FEATURE_addon_modules.md` | Planes / Módulos | `[OBSOLETO]` | `64_REVERT_addon_modules.md` | Reemplazado por el script 68. |
| `65_FEATURE_manage_modules.md` | SuperAdmin / Módulos | `[ACTIVO]` | `66_REVERT_manage_modules.md` | Añade funciones RPC para que el SuperAdmin pueda gestionar los módulos. |
| `68_FEATURE_dynamic_plans_enforcement_V2.md`| Core / Planes | `[ACTIVO]` | `68_REVERT_...` | **Solución Definitiva:** Unifica la obtención de permisos de planes y módulos. |
| `69_FEATURE_tenant_module_view.md`| Licencia / Módulos | `[ACTIVO]` | `69_REVERT_...` | Permite a los tenants ver el estado de los módulos adicionales. |
| `70_FEATURE_downloadable_receipts.md`| SuperAdmin / Licencia |`[ACTIVO]` | `70_REVERT_...` | Implementa la lógica para recibos de pago con desglose de descuentos. |
| `71_FIX_plan_limit_enforcement.md`| Core / Planes | `[ACTIVO]` | `71_REVERT_...` | Corrige la validación de límites de usuarios y sucursales según el plan. |
| `72_FEATURE_sucursal_maps.md`| Sucursales / Catálogo Web |`[ACTIVO]` | `72_REVERT_...` | Implementa la gestión de ubicaciones con mapas para las sucursales. |
| `73_FEATURE_stock_minimo_y_costo_inicial.md`| Inventarios / Productos |`[ACTIVO]` | Próximamente | Implementa la lógica para el stock mínimo y el costo inicial. |
| `74_FEATURE_initial_product_setup.md`| Inventarios / Productos |`[ACTIVO]` | Próximamente | Implementa la lógica para la Configuración Inicial de Productos. |
| `75_FEATURE_pagos_multiples.md`| Ventas (POS) |`[ACTIVO]` | Próximamente | Implementa el sistema de pagos múltiples en el checkout. |
| `76_FEATURE_gestion_vencimientos.md`| Ventas (Dashboard) |`[ACTIVO]` | Próximamente | Implementa el sistema de gestión y visualización de vencimientos. |
| `77_FEATURE_notificaciones_vencimiento.md`| Ventas / Notificaciones |`[ACTIVO]` | Próximamente | Implementa las notificaciones proactivas para ventas vencidas. |
| `78_HOTFIX_get_sale_details.md`| Ventas (Detalle) |`[ACTIVO]` | Próximamente | Corrige un error de sintaxis en la función `get_sale_details`. |
| `79_FIX_pos_stock_minimo.md`| Ventas (POS) |`[ACTIVO]` | Próximamente | Añade el `stock_minimo` a los datos del POS para una correcta visualización. |
| `80_HOTFIX_pos_data_structure.md`| Ventas (POS) |`[ACTIVO]` | `80_REVERT_...` | Corrige un error crítico en el POS eliminando la redundancia de datos de clientes. |
| `81_FEATURE_proformas.md`| Ventas (Proformas) |`[ACTIVO]` | `81_REVERT_...` | Implementa el módulo de Proformas (Cotizaciones). |
| `82_FEATURE_proformas_filtros.md`| Ventas (Proformas) |`[ACTIVO]` | Próximamente | Añade los filtros avanzados al historial de proformas. |
| `83_FIX_proforma_details_data.md`| Ventas (Proformas) |`[ACTIVO]` | Próximamente | Añade datos de cliente y sucursal a la vista de detalle de la proforma. |
| `84_FEATURE_proforma_stock_check_v2.md`| Ventas (Proformas) |`[ACTIVO]` | `84_REVERT_...` | Mejora la verificación de stock para mostrar disponibilidad en otras sucursales y permitir solicitudes de traspaso. |
| `85_FEATURE_proforma_intelligent_logistics.md`| Ventas (Proformas) |`[ACTIVO]` | `85_REVERT_...` | Implementa el flujo de logística inteligente para solicitudes de traspaso. |