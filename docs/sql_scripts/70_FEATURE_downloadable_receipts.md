-- =============================================================================
-- SUPERADMIN & TENANT FEATURE: DOWNLOADABLE RECEIPTS WITH DISCOUNTS (V2 - Modules)
-- =============================================================================
-- This script implements the backend logic for generating downloadable license
-- payment receipts that include a breakdown for any applied discounts and
-- any add-on modules included in the payment.
--
-- WHAT IT DOES:
-- 1. Alters the `pagos_licencia` table to store plan price, discount, and a JSONB
--    array of included modules.
-- 2. Updates the `add_license_payment` function to accept and save this new data.
-- 3. Updates the `get_my_payment_receipt_details` function for tenants to fetch
--    the data needed to render a detailed receipt.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Alter the `pagos_licencia` table to include discount and module details
-- -----------------------------------------------------------------------------
ALTER TABLE public.pagos_licencia ADD COLUMN IF NOT EXISTS concepto TEXT;
ALTER TABLE public.pagos_licencia ADD COLUMN IF NOT EXISTS precio_plan NUMERIC(10, 2);
ALTER TABLE public.pagos_licencia ADD COLUMN IF NOT EXISTS descuento NUMERIC(10, 2);
ALTER TABLE public.pagos_licencia ADD COLUMN IF NOT EXISTS modulos_incluidos jsonb; -- **NEW**

-- -----------------------------------------------------------------------------
-- Step 2: Update the `add_license_payment` function
-- -----------------------------------------------------------------------------
-- This adds new parameters for plan price, discount, and activated modules.
DROP FUNCTION IF EXISTS public.add_license_payment(uuid, numeric, text, text, text, date, numeric, numeric);
CREATE OR REPLACE FUNCTION add_license_payment(
    p_empresa_id uuid,
    p_monto numeric,
    p_metodo_pago text,
    p_notas text,
    p_plan_tipo text,
    p_nueva_fecha_fin date,
    p_precio_plan numeric,
    p_descuento numeric,
    p_modulos_activados jsonb DEFAULT '[]'::jsonb -- **NEW**
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

    -- Insert payment record with new fields
    INSERT INTO public.pagos_licencia(empresa_id, licencia_id, monto, fecha_pago, metodo_pago, notas, concepto, precio_plan, descuento, modulos_incluidos)
    VALUES (p_empresa_id, v_licencia_id, p_monto, NOW(), p_metodo_pago, p_notas, p_plan_tipo, p_precio_plan, p_descuento, p_modulos_activados);

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
-- Step 3: Update the `get_my_payment_receipt_details` function for tenants
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_payment_receipt_details(p_pago_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid := public.get_empresa_id_from_jwt();
    receipt_data jsonb;
    company_data jsonb;
BEGIN
    -- Get payment details, ensuring it belongs to the caller's company
    SELECT to_jsonb(pl) INTO receipt_data
    FROM public.pagos_licencia pl
    WHERE pl.id = p_pago_id AND pl.empresa_id = v_empresa_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Recibo no encontrado o no tienes permiso para verlo.';
    END IF;

    -- Get company details
    SELECT to_jsonb(e_info) INTO company_data
    FROM (
        SELECT 
            e.nombre, 
            e.nit,
            e.moneda,
            (SELECT u.nombre_completo FROM public.usuarios u WHERE u.empresa_id = e.id AND u.rol = 'Propietario' LIMIT 1) as propietario_nombre
        FROM public.empresas e
        WHERE e.id = v_empresa_id
    ) e_info;

    RETURN jsonb_build_object(
        'receipt', receipt_data,
        'company', company_data
    );
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================