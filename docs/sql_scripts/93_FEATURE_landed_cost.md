-- =============================================================================
-- LANDED COST (COSTO DE ADQUISICIÓN TOTAL) - DATABASE SETUP (V3 - Contable Fix)
-- =============================================================================
-- Este script implementa la infraestructura de backend completa para la nueva
-- funcionalidad de "Costo de Adquisición Total".
--
-- VERSIÓN 3: Corrige un error contable crítico en el recálculo del CAPP. La
-- lógica anterior diluía el costo en lugar de promediarlo correctamente. La
-- nueva lógica "revierte" el impacto de la compra original y luego "reaplica"
-- el valor real de los nuevos productos con sus costos adicionales, garantizando
-- un Costo Promedio Ponderado matemáticamente preciso.
--
-- QUÉ HACE:
-- 1.  Crea la tabla `gastos_compra` para almacenar gastos adicionales.
-- 2.  Añade columnas de control (`costos_aplicados`, `costo_unitario_real`) a las
--     tablas `compras` y `compra_items`.
-- 3.  Crea funciones RPC de apoyo (`add_gasto_compra`, `delete_gasto_compra`).
-- 4.  Crea la función RPC principal `aplicar_costos_adicionales_a_compra` que
--     contiene toda la lógica de prorrateo y recálculo del CAPP (CORREGIDA).
-- 5.  Actualiza `get_purchase_details` para devolver los nuevos datos.
--
-- INSTRUCCIONES:
-- Ejecuta este script completo en tu Editor SQL de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Crear la tabla `gastos_compra`
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gastos_compra (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    compra_id uuid NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
    concepto text NOT NULL,
    monto numeric(10, 2) NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.gastos_compra ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for own company" ON public.gastos_compra;
CREATE POLICY "Enable all for own company" ON public.gastos_compra
FOR ALL USING (empresa_id = public.get_empresa_id_from_jwt());

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gastos_compra;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Table "gastos_compra" is already in the publication.';
END;
$$;


-- -----------------------------------------------------------------------------
-- Paso 2: Alterar tablas existentes para soportar el flujo
-- -----------------------------------------------------------------------------
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS costos_aplicados boolean DEFAULT false;
ALTER TABLE public.compra_items ADD COLUMN IF NOT EXISTS costo_unitario_real numeric(10, 2);


-- -----------------------------------------------------------------------------
-- Paso 3: Crear funciones RPC de apoyo para la UI
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION add_gasto_compra(p_compra_id uuid, p_concepto text, p_monto numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.gastos_compra(empresa_id, compra_id, concepto, monto)
    VALUES (public.get_empresa_id_from_jwt(), p_compra_id, p_concepto, p_monto);
END;
$$;

CREATE OR REPLACE FUNCTION delete_gasto_compra(p_gasto_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.gastos_compra
    WHERE id = p_gasto_id AND empresa_id = public.get_empresa_id_from_jwt();
END;
$$;


-- -----------------------------------------------------------------------------
-- Paso 4: Crear la función RPC principal `aplicar_costos_adicionales_a_compra` (CORREGIDA)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION aplicar_costos_adicionales_a_compra(
    p_compra_id uuid,
    p_metodo_prorrateo text -- 'VALOR' o 'CANTIDAD'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    v_compra record;
    total_gastos_adicionales numeric;
    base_de_prorrateo numeric;
    factor_prorrateo numeric;
    item_rec record;
    costo_adicional_por_item numeric;
    costo_adicional_unitario numeric;
    nuevo_costo_unitario_real numeric;
    
    -- Variables para el recálculo del CAPP
    capp_actual numeric;
    stock_total_actual numeric;
    costo_original_en_bob numeric;
    nuevo_costo_unitario_real_bob numeric;
    stock_anterior_a_la_compra numeric;
    valor_inventario_actual numeric;
    valor_de_esta_compra_original numeric;
    valor_inventario_anterior numeric;
    valor_real_de_esta_compra numeric;
    nuevo_capp numeric;
BEGIN
    -- 1. Validaciones
    SELECT * INTO v_compra FROM public.compras WHERE id = p_compra_id AND empresa_id = caller_empresa_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Compra no encontrada o no pertenece a tu empresa.'; END IF;
    IF v_compra.costos_aplicados THEN RAISE EXCEPTION 'Los costos para esta compra ya han sido aplicados.'; END IF;

    -- 2. Cálculo de totales y factor
    SELECT COALESCE(SUM(monto), 0) INTO total_gastos_adicionales FROM public.gastos_compra WHERE compra_id = p_compra_id;
    IF total_gastos_adicionales <= 0 THEN RAISE EXCEPTION 'No hay gastos adicionales que aplicar.'; END IF;

    IF p_metodo_prorrateo = 'VALOR' THEN
        SELECT SUM(cantidad * costo_unitario) INTO base_de_prorrateo FROM public.compra_items WHERE compra_id = p_compra_id;
    ELSIF p_metodo_prorrateo = 'CANTIDAD' THEN
        SELECT SUM(cantidad) INTO base_de_prorrateo FROM public.compra_items WHERE compra_id = p_compra_id;
    ELSE
        RAISE EXCEPTION 'Método de prorrateo no válido.';
    END IF;

    IF base_de_prorrateo = 0 THEN RAISE EXCEPTION 'La base de prorrateo no puede ser cero.'; END IF;
    factor_prorrateo := total_gastos_adicionales / base_de_prorrateo;

    -- 3. Iterar sobre los ítems de la compra
    FOR item_rec IN SELECT * FROM public.compra_items WHERE compra_id = p_compra_id
    LOOP
        -- 4. Calcular y aplicar el costo prorrateado
        IF p_metodo_prorrateo = 'VALOR' THEN
            costo_adicional_por_item := (item_rec.cantidad * item_rec.costo_unitario) * factor_prorrateo;
        ELSE -- CANTIDAD
            costo_adicional_por_item := item_rec.cantidad * factor_prorrateo;
        END IF;

        costo_adicional_unitario := costo_adicional_por_item / item_rec.cantidad;
        nuevo_costo_unitario_real := item_rec.costo_unitario + costo_adicional_unitario;

        UPDATE public.compra_items SET costo_unitario_real = nuevo_costo_unitario_real WHERE id = item_rec.id;

        -- 5. Recalcular el CAPP del producto con la metodología contable correcta
        SELECT p.precio_compra, (SELECT COALESCE(SUM(i.cantidad), 0) FROM public.inventarios i WHERE i.producto_id = item_rec.producto_id)
        INTO capp_actual, stock_total_actual
        FROM public.productos p WHERE p.id = item_rec.producto_id;

        capp_actual := COALESCE(capp_actual, 0);
        stock_total_actual := COALESCE(stock_total_actual, 0);

        -- Convertir los costos de esta compra a la moneda base (BOB) para el cálculo
        costo_original_en_bob := item_rec.costo_unitario;
        nuevo_costo_unitario_real_bob := nuevo_costo_unitario_real;
        IF v_compra.moneda != 'BOB' AND v_compra.tasa_cambio IS NOT NULL AND v_compra.tasa_cambio > 0 THEN
            costo_original_en_bob := item_rec.costo_unitario * v_compra.tasa_cambio;
            nuevo_costo_unitario_real_bob := nuevo_costo_unitario_real * v_compra.tasa_cambio;
        END IF;

        -- a. "Revertir" el impacto de la compra original para obtener el estado anterior
        stock_anterior_a_la_compra := stock_total_actual - item_rec.cantidad;
        valor_inventario_actual := stock_total_actual * capp_actual;
        valor_de_esta_compra_original := item_rec.cantidad * costo_original_en_bob;
        valor_inventario_anterior := valor_inventario_actual - valor_de_esta_compra_original;
        
        -- b. Calcular el valor REAL de los items de esta compra (con costos adicionales)
        valor_real_de_esta_compra := item_rec.cantidad * nuevo_costo_unitario_real_bob;

        -- c. Calcular el nuevo CAPP
        IF stock_total_actual > 0 THEN
            nuevo_capp := (valor_inventario_anterior + valor_real_de_esta_compra) / stock_total_actual;
        ELSE
            nuevo_capp := nuevo_costo_unitario_real_bob; -- Si no había stock, el nuevo CAPP es el costo real.
        END IF;
        
        -- Actualizar el CAPP en la tabla de productos. El trigger `on_product_cost_change` se encargará de actualizar los precios de venta.
        UPDATE public.productos SET precio_compra = nuevo_capp WHERE id = item_rec.producto_id;
    END LOOP;

    -- 6. Marcar la compra como procesada y notificar
    UPDATE public.compras SET costos_aplicados = true WHERE id = p_compra_id;

    PERFORM notificar_cambio(
        'APLICACION_COSTOS_COMPRA',
        'Se aplicaron costos adicionales a la compra <b>' || v_compra.folio || '</b>, actualizando el valor del inventario.',
        p_compra_id
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- Paso 5: Actualizar `get_purchase_details` para devolver los nuevos datos
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_purchase_details(uuid);
CREATE OR REPLACE FUNCTION get_purchase_details(p_compra_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    purchase_details jsonb;
    items_list json;
    payments_list json;
    gastos_list json;
BEGIN
    SELECT to_jsonb(c) || jsonb_build_object(
        'proveedor_nombre', p.nombre,
        'usuario_nombre', u.nombre_completo
    )
    INTO purchase_details
    FROM public.compras c
    JOIN public.proveedores p ON c.proveedor_id = p.id
    LEFT JOIN public.usuarios u ON c.usuario_id = u.id
    WHERE c.id = p_compra_id AND c.empresa_id = public.get_empresa_id_from_jwt();

    IF NOT FOUND THEN RAISE EXCEPTION 'Compra no encontrada o no pertenece a tu empresa.'; END IF;

    SELECT json_agg(i) INTO items_list FROM (
        SELECT ci.*, p.nombre as producto_nombre
        FROM public.compra_items ci
        JOIN public.productos p ON ci.producto_id = p.id
        WHERE ci.compra_id = p_compra_id
    ) i;

    SELECT json_agg(p) INTO payments_list FROM (
        SELECT * FROM public.pagos_compras
        WHERE compra_id = p_compra_id ORDER BY fecha_pago
    ) p;

    SELECT json_agg(g) INTO gastos_list FROM (
        SELECT * FROM public.gastos_compra
        WHERE compra_id = p_compra_id ORDER BY created_at
    ) g;

    RETURN purchase_details || jsonb_build_object(
        'items', COALESCE(items_list, '[]'::json),
        'pagos', COALESCE(payments_list, '[]'::json),
        'gastos_adicionales', COALESCE(gastos_list, '[]'::json)
    );
END;
$$;


-- =============================================================================
-- Fin del script.
-- =============================================================================