-- =============================================================================
-- REVERT SCRIPT FOR: DOWNLOADABLE RECEIPTS WITH DISCOUNTS (V1)
-- =============================================================================
-- This script reverts the changes made by `70_FEATURE_downloadable_receipts.md`.
-- It drops the new function, reverts the `add_license_payment` function, and
-- removes the new columns from the `pagos_licencia` table.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Drop the new function `get_my_payment_receipt_details`
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_my_payment_receipt_details(uuid);


-- -----------------------------------------------------------------------------
-- Step 2: Revert the `add_license_payment` function to its previous version
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.add_license_payment(uuid, numeric, text, text, text, date, numeric, numeric);
CREATE OR REPLACE FUNCTION add_license_payment(
    p_empresa_id uuid,
    p_monto numeric,
    p_metodo_pago text,
    p_notas text,
    p_plan_tipo text,
    p_nueva_fecha_fin date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_licencia_id uuid;
    v_plan_name_from_type text;
    v_plan_id_to_set uuid;
BEGIN
    -- Security check
    IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'SuperAdmin') THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de SuperAdmin.';
    END IF;

    SELECT id INTO v_licencia_id FROM public.licencias WHERE empresa_id = p_empresa_id;
    IF v_licencia_id IS NULL THEN RAISE EXCEPTION 'No se encontró una licencia para la empresa especificada.'; END IF;
    IF p_nueva_fecha_fin IS NULL THEN RAISE EXCEPTION 'La nueva fecha de fin no puede ser nula.'; END IF;

    -- Look up plan_id
    v_plan_name_from_type := (regexp_match(p_plan_tipo, '^\w+'))[1];
    IF v_plan_name_from_type = 'Básico' THEN v_plan_name_from_type := 'Emprendedor'; END IF;
    SELECT id INTO v_plan_id_to_set FROM public.planes WHERE nombre = v_plan_name_from_type;
    IF v_plan_id_to_set IS NULL THEN RAISE EXCEPTION 'El tipo de plan "%" no es válido.', p_plan_tipo; END IF;

    -- Insert payment record (old version)
    INSERT INTO public.pagos_licencia(empresa_id, licencia_id, monto, fecha_pago, metodo_pago, notas)
    VALUES (p_empresa_id, v_licencia_id, p_monto, NOW(), p_metodo_pago, p_notas);

    -- Update license
    UPDATE public.licencias
    SET
        tipo_licencia = p_plan_tipo,
        fecha_fin = p_nueva_fecha_fin,
        plan_id = v_plan_id_to_set,
        estado = 'Activa'
    WHERE id = v_licencia_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 3: Remove the columns from the `pagos_licencia` table
-- -----------------------------------------------------------------------------
ALTER TABLE public.pagos_licencia DROP COLUMN IF EXISTS concepto;
ALTER TABLE public.pagos_licencia DROP COLUMN IF EXISTS precio_plan;
ALTER TABLE public.pagos_licencia DROP COLUMN IF EXISTS descuento;


-- =============================================================================
-- End of revert script.
-- =============================================================================