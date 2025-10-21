-- =============================================================================
-- REVERT SCRIPT FOR: PROFORMA INTELLIGENT LOGISTICS FLOW (V1)
-- =============================================================================
-- This script reverts all changes made by `85_FEATURE_proforma_intelligent_logistics.md`.
-- =============================================================================

-- Step 1: Drop the new function `get_solicitud_traspaso_details`
DROP FUNCTION IF EXISTS public.get_solicitud_traspaso_details(uuid);

-- Step 2: Revert `solicitar_traspaso_desde_proforma` to its previous version
DROP FUNCTION IF EXISTS public.solicitar_traspaso_desde_proforma(uuid, uuid, jsonb);
CREATE OR REPLACE FUNCTION solicitar_traspaso_desde_proforma(
    p_proforma_id uuid,
    p_producto_id uuid,
    p_sucursal_origen_id uuid,
    p_cantidad_solicitada numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    caller_sucursal_id uuid := (SELECT u.sucursal_id FROM public.usuarios u WHERE u.id = auth.uid());
    v_proforma_folio text;
    v_producto_nombre text;
    v_origen_nombre text;
    v_destino_nombre text;
    v_mensaje text;
BEGIN
    SELECT folio INTO v_proforma_folio FROM public.proformas WHERE id = p_proforma_id;
    SELECT nombre INTO v_producto_nombre FROM public.productos WHERE id = p_producto_id;
    SELECT nombre INTO v_origen_nombre FROM public.sucursales WHERE id = p_sucursal_origen_id;
    SELECT nombre INTO v_destino_nombre FROM public.sucursales WHERE id = caller_sucursal_id;

    v_mensaje := format(
        '<b>%s</b> solicita traspaso de <b>%s x %s</b> para la proforma <b>%s</b>.',
        v_destino_nombre,
        p_cantidad_solicitada,
        v_producto_nombre,
        v_proforma_folio
    );
    
    PERFORM notificar_cambio(
        'SOLICITUD_TRASPASO',
        v_mensaje,
        p_proforma_id,
        ARRAY[p_sucursal_origen_id] -- Notify ONLY the origin branch
    );
END;
$$;

-- Step 3: Revert `notificar_cambio` to use SECURITY DEFINER
DROP FUNCTION IF EXISTS public.notificar_cambio(text, text, uuid, uuid[]);
CREATE OR REPLACE FUNCTION public.notificar_cambio(
    p_tipo_evento text,
    p_mensaje text,
    p_entidad_id uuid,
    p_sucursal_ids uuid[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Reverting to DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid; v_usuario_id uuid; v_usuario_nombre text;
BEGIN
    v_usuario_id := auth.uid();
    v_empresa_id := public.get_empresa_id_from_jwt();
    v_usuario_nombre := (auth.jwt() -> 'app_metadata' ->> 'nombre_completo')::text;

    IF v_usuario_nombre IS NULL AND v_usuario_id IS NOT NULL THEN
        SELECT nombre_completo INTO v_usuario_nombre FROM public.usuarios WHERE id = v_usuario_id;
    END IF;
    IF v_usuario_nombre IS NULL THEN v_usuario_nombre := 'Sistema'; END IF;

    IF v_empresa_id IS NOT NULL THEN
        INSERT INTO public.notificaciones (empresa_id, usuario_generador_id, usuario_generador_nombre, mensaje, tipo_evento, entidad_id, sucursales_destino_ids)
        VALUES (v_empresa_id, v_usuario_id, v_usuario_nombre, p_mensaje, p_tipo_evento, p_entidad_id, p_sucursal_ids);
    END IF;
END;
$$;

-- Step 4: Drop the `solicitudes_traspaso` table
DROP TABLE IF EXISTS public.solicitudes_traspaso;

-- =============================================================================
-- End of revert script.
-- =============================================================================