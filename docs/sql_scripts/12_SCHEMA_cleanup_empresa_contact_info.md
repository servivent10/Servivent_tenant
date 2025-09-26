-- =============================================================================
-- SCHEMA CLEANUP SCRIPT: Remove Redundant Company Contact Info (v3 - Corrected)
-- =============================================================================
-- Este script alinea el esquema de la base de datos con la nueva lógica de la
-- aplicación, donde la dirección y el teléfono son atributos de una sucursal,
-- no de la empresa en general.
--
-- **INSTRUCCIONES:**
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase para
-- eliminar las columnas redundantes y actualizar las funciones que las usan.
-- Es seguro ejecutarlo varias veces.
-- =============================================================================

DO $$
BEGIN

-- -----------------------------------------------------------------------------
-- Paso 1: Eliminar las columnas `direccion` y `telefono` de la tabla `empresas`
-- -----------------------------------------------------------------------------
ALTER TABLE public.empresas
DROP COLUMN IF EXISTS direccion,
DROP COLUMN IF EXISTS telefono;

RAISE NOTICE 'Paso 1/3: Columnas "direccion" y "telefono" eliminadas de la tabla "empresas".';

-- -----------------------------------------------------------------------------
-- Paso 2: Actualizar la función `get_user_profile_data`
-- -----------------------------------------------------------------------------
-- **CORRECCIÓN:** Se añade DROP FUNCTION para evitar el error de cambio de tipo de retorno.
-- Se eliminan `empresa_direccion` y `empresa_telefono` de la definición.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_profile_data();

CREATE OR REPLACE FUNCTION get_user_profile_data()
RETURNS table (
    empresa_id uuid,
    empresa_nombre text,
    empresa_logo text,
    empresa_nit text,
    plan_actual text,
    estado_licencia text,
    fecha_fin_licencia date,
    nombre_completo text,
    rol text,
    avatar text,
    sucursal_id uuid,
    sucursal_principal_nombre text,
    historial_pagos json
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
        l.tipo_licencia AS plan_actual,
        l.estado AS estado_licencia,
        l.fecha_fin AS fecha_fin_licencia,
        u.nombre_completo,
        u.rol,
        u.avatar,
        u.sucursal_id,
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
$function$;

RAISE NOTICE 'Paso 2/3: Función "get_user_profile_data" actualizada.';

-- -----------------------------------------------------------------------------
-- Paso 3: Actualizar la función `update_company_info`
-- -----------------------------------------------------------------------------
-- **CORRECCIÓN:** Se añade DROP FUNCTION con la firma antigua para poder recrearla.
-- Se eliminan los parámetros `p_direccion` y `p_telefono`.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_company_info(text, text, text, text, text);

CREATE OR REPLACE FUNCTION update_company_info(
    p_nombre text,
    p_nit text,
    p_logo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    caller_empresa_id uuid;
    caller_rol text;
BEGIN
    -- 1. Validar permisos del que llama (solo Propietario)
    SELECT empresa_id, rol INTO caller_empresa_id, caller_rol
    FROM public.usuarios WHERE id = auth.uid();

    IF caller_rol != 'Propietario' THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de Propietario.';
    END IF;

    -- 2. Actualizar la tabla de empresas
    UPDATE public.empresas
    SET
        nombre = p_nombre,
        nit = p_nit,
        logo = p_logo
    WHERE id = caller_empresa_id;
END;
$function$;

RAISE NOTICE 'Paso 3/3: Función "update_company_info" actualizada.';

END $$;
-- =============================================================================
-- Fin del script de limpieza.
-- =============================================================================