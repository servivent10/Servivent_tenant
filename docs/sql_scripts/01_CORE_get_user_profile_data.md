-- =============================================================================
-- DATABASE UPDATE SCRIPT
-- =============================================================================
-- Este script actualiza la función principal que carga los datos del perfil
-- de usuario para que incluya todos los detalles de la empresa y el historial
-- de pagos.
--
-- **INSTRUCCIONES:**
-- Por favor, ejecuta este script completo en el Editor SQL de tu proyecto de
-- Supabase para aplicar la corrección.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Eliminar la función antigua
-- -----------------------------------------------------------------------------
-- Es necesario eliminar la función existente antes de crear la nueva versión,
-- ya que vamos a cambiar la estructura de lo que devuelve.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_profile_data();


-- -----------------------------------------------------------------------------
-- Paso 2: Crear la nueva función `get_user_profile_data` (v3)
-- -----------------------------------------------------------------------------
-- Descripción:
-- Esta es la nueva versión de la función. Ahora devuelve todos los campos de
-- la tabla `empresas` para evitar llamadas adicionales desde el frontend.
-- También sigue incluyendo el historial de pagos.
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
    sucursal_principal_nombre text,
    historial_pagos json
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    -- Utilizamos un Common Table Expression (CTE) para pre-calcular el historial de pagos
    WITH user_payments AS (
        -- Agrega todos los pagos de la empresa del usuario actual en un único array JSON
        SELECT
            p.empresa_id,
            json_agg(
                json_build_object(
                    'id', p.id,
                    'monto', p.monto,
                    'fecha_pago', p.fecha_pago,
                    'metodo_pago', p.metodo_pago,
                    'notas', p.notas
                ) ORDER BY p.fecha_pago DESC -- Ordena los pagos del más reciente al más antiguo
            ) AS historial
        FROM
            pagos_licencia p
        WHERE
            -- Filtra los pagos para que coincidan con el empresa_id del usuario que ha iniciado sesión
            p.empresa_id = (SELECT u.empresa_id FROM usuarios u WHERE u.id = auth.uid())
        GROUP BY
            p.empresa_id
    )
    -- Consulta principal que une toda la información
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
        s.nombre AS sucursal_principal_nombre,
        up.historial AS historial_pagos -- Unimos el historial de pagos pre-calculado
    FROM
        usuarios u
    LEFT JOIN
        empresas e ON u.empresa_id = e.id
    LEFT JOIN
        licencias l ON u.empresa_id = l.empresa_id
    LEFT JOIN
        -- Asumimos que la primera sucursal es la principal (ajustar si hay otra lógica)
        sucursales s ON u.empresa_id = s.empresa_id
    LEFT JOIN
        -- Hacemos un LEFT JOIN para que si no hay pagos, no falle la consulta
        user_payments up ON u.empresa_id = up.empresa_id
    WHERE
        u.id = auth.uid()
    LIMIT 1;
END;
$$;


-- =============================================================================
-- Fin del script.
-- =============================================================================