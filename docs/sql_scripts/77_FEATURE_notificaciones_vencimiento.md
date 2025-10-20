-- =============================================================================
-- PROACTIVE DUE DATE NOTIFICATIONS - DATABASE SETUP (V1)
-- =============================================================================
-- This script implements Phase 3 of the due date management feature: a proactive
-- notification system that runs daily to alert users about upcoming and overdue
-- credit sales.
--
-- WHAT IT DOES:
-- 1. Creates `notificar_cambio_system`: A new helper function that allows
--    system processes (like cron jobs) to generate notifications for a specific
--    company without needing an authenticated user context.
-- 2. Creates `check_and_notify_due_dates`: The main logic function designed to
--    be run daily. It iterates through all companies and creates notifications
--    for sales that are due soon or have just become overdue.
--
-- INSTRUCTIONS:
-- 1. Execute this script completely in your Supabase SQL Editor.
-- 2. Create a Supabase Scheduled Edge Function (Cron Job) to run daily and have
--    it execute the following RPC call: `await supabase.rpc('check_and_notify_due_dates')`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create a system-level notification helper function
-- -----------------------------------------------------------------------------
-- This function is a variant of `notificar_cambio` that can be called by a
-- SECURITY DEFINER function (like a cron job) because it doesn't rely on JWT auth.
CREATE OR REPLACE FUNCTION notificar_cambio_system(
    p_empresa_id uuid,
    p_tipo_evento text,
    p_mensaje text,
    p_entidad_id uuid,
    p_sucursal_ids uuid[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Essential for being called from a cron job
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.notificaciones (
        empresa_id,
        usuario_generador_id,
        usuario_generador_nombre,
        mensaje,
        tipo_evento,
        entidad_id,
        sucursales_destino_ids
    ) VALUES (
        p_empresa_id,
        NULL, -- System generated, no specific user
        'Sistema ServiVENT',
        p_mensaje,
        p_tipo_evento,
        p_entidad_id,
        p_sucursal_ids -- NULL will be a global notification for the company
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 2: Create the main function to check and notify about due dates
-- -----------------------------------------------------------------------------
-- This function should be scheduled to run once daily.
CREATE OR REPLACE FUNCTION check_and_notify_due_dates()
RETURNS void
LANGUAGE plpgsql
-- IMPORTANT: This function does NOT need to be SECURITY DEFINER itself,
-- as it calls the definer function `notificar_cambio_system`.
-- However, it is often better to make it DEFINER as well for consistency
-- when it's called from a cron job context.
SECURITY DEFINER
AS $$
DECLARE
    empresa_rec RECORD;
    venta_rec RECORD;
    v_mensaje TEXT;
BEGIN
    -- Loop through all active companies
    FOR empresa_rec IN SELECT id, timezone FROM public.empresas
    LOOP
        -- Find sales due in the next 3 days for this company
        FOR venta_rec IN
            SELECT 
                v.id, 
                v.folio, 
                c.nombre as cliente_nombre, 
                (v.fecha_vencimiento - (now() AT TIME ZONE empresa_rec.timezone)::date) as dias_restantes
            FROM public.ventas v
            LEFT JOIN public.clientes c ON v.cliente_id = c.id
            WHERE v.empresa_id = empresa_rec.id
              AND v.tipo_venta = 'Crédito'
              AND v.estado_pago IN ('Pendiente', 'Abono Parcial')
              AND v.fecha_vencimiento BETWEEN (now() AT TIME ZONE empresa_rec.timezone)::date AND (now() AT TIME ZONE empresa_rec.timezone)::date + interval '3 days'
        LOOP
            v_mensaje := format('La venta <b>%s</b> al cliente ''%s'' está próxima a vencer (en %s día%s).',
                                venta_rec.folio,
                                COALESCE(venta_rec.cliente_nombre, 'Consumidor Final'),
                                venta_rec.dias_restantes,
                                CASE WHEN venta_rec.dias_restantes = 1 THEN '' ELSE 's' END);
            
            PERFORM notificar_cambio_system(
                empresa_rec.id,
                'VENTA_PROXIMA_A_VENCER',
                v_mensaje,
                venta_rec.id,
                NULL -- Global notification for the company
            );
        END LOOP;

        -- Find sales that became overdue yesterday
        FOR venta_rec IN
            SELECT v.id, v.folio, c.nombre as cliente_nombre
            FROM public.ventas v
            LEFT JOIN public.clientes c ON v.cliente_id = c.id
            WHERE v.empresa_id = empresa_rec.id
              AND v.tipo_venta = 'Crédito'
              AND v.estado_pago IN ('Pendiente', 'Abono Parcial')
              AND v.fecha_vencimiento = (now() AT TIME ZONE empresa_rec.timezone)::date - interval '1 day'
        LOOP
            v_mensaje := format('La venta <b>%s</b> al cliente ''%s'' ha vencido.',
                                venta_rec.folio,
                                COALESCE(venta_rec.cliente_nombre, 'Consumidor Final'));

            PERFORM notificar_cambio_system(
                empresa_rec.id,
                'VENTA_VENCIDA',
                v_mensaje,
                venta_rec.id,
                NULL -- Global notification for the company
            );
        END LOOP;
    END LOOP;
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================