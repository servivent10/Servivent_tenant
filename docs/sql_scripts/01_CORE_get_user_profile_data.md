-- =============================================================================
-- DATABASE UPDATE SCRIPT (v5 - Sucursal ID Fix)
-- =============================================================================
-- Este script actualiza la función principal que carga los datos del perfil
-- de usuario para que devuelva también el ID de la sucursal, un dato crucial
-- que faltaba y causaba errores en módulos como el de Compras.
--
-- **INSTRUCCIONES:**
-- Por favor, ejecuta este script completo en el Editor SQL de tu proyecto de
-- Supabase para aplicar la corrección.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Eliminar la función antigua
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_profile_data();


-- -----------------------------------------------------------------------------
-- Paso 2: Crear la nueva función `get_user_profile_data` (v5)
-- -----------------------------------------------------------------------------
-- Descripción:
-- Se añade `sucursal_id` tanto a la definición de la tabla de retorno como a
-- la sentencia SELECT principal. Esto asegura que el ID de la sucursal del
-- usuario esté disponible en el frontend después de iniciar sesión.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_profile_data()
RETURNS table (
    empresa_id uuid,
    empresa_nombre text,
    empresa_logo text,
    empresa_nit text,
    empresa_direccion text,
    empresa_telefono text,
    plan_actual text,
    estado_licencia text,
    fecha_fin_licencia date,
    nombre_completo text,
    rol text,
    avatar text,
    sucursal_id uuid, -- **NUEVO CAMPO**
    sucursal_principal_nombre text,
    historial_pagos json
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH user_payments AS (
        SELECT
            p.empresa_id,
            json_agg(
                json_build_object(
                    'id', p.id,
                    'monto', p.monto,
                    'fecha_pago', p.fecha_pago,
                    'metodo_pago', p.metodo_pago,
                    'notas', p.notas
                ) ORDER BY p.fecha_pago DESC
            ) AS historial
        FROM
            pagos_licencia p
        WHERE
            p.empresa_id = (SELECT u.empresa_id FROM usuarios u WHERE u.id = auth.uid())
        GROUP BY
            p.empresa_id
    )
    SELECT
        u.empresa_id,
        e.nombre AS empresa_nombre,
        e.logo AS empresa_logo,
        e.nit AS empresa_nit,
        e.direccion AS empresa_direccion,
        e.telefono AS empresa_telefono,
        l.tipo_licencia AS plan_actual,
        l.estado AS estado_licencia,
        l.fecha_fin AS fecha_fin_licencia,
        u.nombre_completo,
        u.rol,
        u.avatar,
        u.sucursal_id, -- **SE AÑADE EL ID DE LA SUCURSAL**
        s.nombre AS sucursal_principal_nombre,
        up.historial AS historial_pagos
    FROM
        usuarios u
    LEFT JOIN
        empresas e ON u.empresa_id = e.id
    LEFT JOIN
        licencias l ON u.empresa_id = l.empresa_id
    LEFT JOIN
        sucursales s ON u.sucursal_id = s.id
    LEFT JOIN
        user_payments up ON u.empresa_id = up.empresa_id
    WHERE
        u.id = auth.uid();
END;
$$;


-- =============================================================================
-- Fin del script.
-- =============================================================================