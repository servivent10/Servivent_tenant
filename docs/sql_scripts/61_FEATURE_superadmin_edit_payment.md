-- =============================================================================
-- SUPERADMIN FEATURE: EDIT PAYMENT AND LICENSE DATE (V2 - Plan ID Fix)
-- =============================================================================
-- Este script actualiza la lógica para editar un pago y licencia, asegurando
-- que el `plan_id` también se actualice correctamente si el tipo de licencia cambia.
--
-- INSTRUCCIONES:
-- Ejecuta este script completo en tu Editor SQL de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Función 1: Actualizar solo la fecha de vencimiento de la licencia (sin cambios)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_license_end_date_as_superadmin(
    p_empresa_id uuid,
    p_new_end_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Security check: Ensure the caller is a SuperAdmin
    IF NOT EXISTS (
        SELECT 1
        FROM public.usuarios
        WHERE id = auth.uid() AND rol = 'SuperAdmin'
    ) THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de SuperAdmin.';
    END IF;

    -- Update license expiration date
    UPDATE public.licencias
    SET fecha_fin = p_new_end_date
    WHERE empresa_id = p_empresa_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- Función 2: Actualizar un pago y la licencia (CORREGIDA)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_payment_and_license_as_superadmin(
    p_empresa_id uuid,
    p_fecha_pago timestamptz,
    p_metodo_pago text,
    p_monto numeric,
    p_notas text,
    p_nueva_fecha_fin date,
    p_pago_id uuid,
    p_plan_tipo text -- **NUEVO PARÁMETRO**
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan_name_from_type text;
    v_plan_id_to_set uuid;
BEGIN
    -- Security check
    IF NOT EXISTS (
        SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'SuperAdmin'
    ) THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de SuperAdmin.';
    END IF;

    -- **NUEVA LÓGICA: Buscar el plan_id correcto si el tipo de plan cambia**
    v_plan_name_from_type := (regexp_match(p_plan_tipo, '^\w+'))[1];
    IF v_plan_name_from_type = 'Básico' THEN
        v_plan_name_from_type := 'Emprendedor';
    END IF;

    SELECT id INTO v_plan_id_to_set FROM public.planes WHERE nombre = v_plan_name_from_type;
    IF v_plan_id_to_set IS NULL THEN
        RAISE EXCEPTION 'El tipo de plan "%" no es válido.', p_plan_tipo;
    END IF;

    -- Update the payment record
    UPDATE public.pagos_licencia
    SET
        monto = p_monto,
        metodo_pago = p_metodo_pago,
        notas = p_notas,
        fecha_pago = p_fecha_pago
    WHERE id = p_pago_id;

    -- Update the license record, including the plan_id
    UPDATE public.licencias
    SET
        fecha_fin = p_nueva_fecha_fin,
        tipo_licencia = p_plan_tipo,
        plan_id = v_plan_id_to_set -- **AQUÍ ESTÁ LA CORRECCIÓN**
    WHERE empresa_id = p_empresa_id;

END;
$$;

-- =============================================================================
-- End of script.
-- =============================================================================