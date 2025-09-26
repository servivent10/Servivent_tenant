# Guía de Solución de Problemas

Esta carpeta contiene documentos detallados sobre problemas técnicos específicos encontrados durante el desarrollo de ServiVENT, junto con sus causas y soluciones.

## Índice de Problemas

1.  **[Error: `stack depth limit exceeded` al iniciar sesión](./01_stack_depth_limit_exceeded.md)**
    -   **Síntoma:** La aplicación se congela en la pantalla de carga.
    -   **Causa:** Recursión infinita entre políticas RLS de Supabase.
    -   **Solución:** Uso de una función RPC `get_user_profile_data` con `SECURITY DEFINER`.

2.  **[Error: `stack depth limit exceeded` al eliminar una empresa](./02_company_deletion_stack_depth.md)**
    -   **Síntoma:** La operación de eliminación de una empresa falla desde el panel de SuperAdmin.
    -   **Causa:** Recursión infinita detectada por el planificador de la base de datos debido a las reglas `ON DELETE CASCADE`.
    -   **Solución:** Mover toda la lógica de eliminación a una única función maestra en SQL que controla el orden de las operaciones.

3.  **[Fallos en Cascada al Eliminar Entidades (Usuarios y Empresas)](./03_deletion_failures_and_solution.md)**
    -   **Síntoma:** Múltiples errores de permisos y de recursión al intentar eliminar usuarios o empresas.
    -   **Causa:** Una combinación de falta de permisos en funciones SQL y ciclos de dependencia en las reglas `ON DELETE CASCADE`.
    -   **Solución:** Arquitectura de "Demolición Controlada" orquestada desde Edge Functions para secuenciar las eliminaciones.