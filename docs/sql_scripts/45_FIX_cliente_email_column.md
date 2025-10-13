-- =============================================================================
-- DATABASE FIX SCRIPT: UNIFY `clientes` EMAIL COLUMN (V5 - ENHANCED VALIDATION)
-- =============================================================================
-- Este script es la solución definitiva y robusta para unificar la columna de
-- correo electrónico en la tabla `clientes`, y AÑADE una validación de formato
-- y proveedor de correo directamente en la base de datos para máxima integridad.
--
-- PROBLEMA RESUELTO:
-- 1. Errores de dependencia de políticas RLS y artefactos de hotfixes.
-- 2. La validación de formato de correo se realizaba solo en el frontend.
--
-- SOLUCIÓN:
-- 1. Limpia artefactos de hotfixes y políticas RLS antiguas.
-- 2. Migra los datos a una única columna `correo`.
-- 3. Reemplaza la función de validación con `validate_client_email`, que ahora
--    verifica formato, proveedores comunes (gmail, hotmail, etc.) y unicidad.
-- 4. Actualiza todas las funciones RPC para usar `correo`.
-- 5. Reinstala las políticas y triggers correctos.
--
-- INSTRUCCIONES:
-- Ejecuta este script completo en tu Editor SQL de Supabase.
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '--- INICIANDO SCRIPT DE CORRECCIÓN DEFINITIVA PARA LA TABLA `clientes` (V5) ---';

    -- Paso 1: Eliminar la política RLS conflictiva que impide la migración.
    RAISE NOTICE 'Paso 1/7: Eliminando la política RLS conflictiva en `clientes`...';
    DROP POLICY IF EXISTS "Allow authenticated client to view own profile" ON public.clientes;

    -- Paso 2: Limpiar artefactos de hotfixes anteriores (si existen).
    RAISE NOTICE 'Paso 2/7: Limpiando hotfixes anteriores...';
    DROP TRIGGER IF EXISTS before_cliente_insert_update_sync_email ON public.clientes;
    DROP FUNCTION IF EXISTS public.sync_cliente_email_to_correo();
    
    -- Paso 3: Realizar la migración de 'email' a 'correo' de forma segura.
    RAISE NOTICE 'Paso 3/7: Migrando columna de email...';
    ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS correo text;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='email') THEN
        UPDATE public.clientes SET correo = email WHERE correo IS NULL OR correo = '';
        RAISE NOTICE ' -> Datos de `email` copiados a `correo`.';
        ALTER TABLE public.clientes DROP COLUMN IF EXISTS email CASCADE;
        RAISE NOTICE ' -> Columna `email` eliminada con CASCADE.';
    ELSE
        RAISE NOTICE ' -> La columna `email` no existe, se asume que la migración ya se realizó.';
    END IF;

END;
$$;

DO $$ BEGIN RAISE NOTICE 'Paso 4/7: Actualizando funciones RPC para usar la columna `correo`...'; END; $$;

-- get_company_clients
DROP FUNCTION IF EXISTS public.get_company_clients();
CREATE OR REPLACE FUNCTION get_company_clients()
RETURNS TABLE (
    id uuid, nombre text, nit_ci text, telefono text, correo text,
    direccion text, avatar_url text, saldo_pendiente numeric, codigo_cliente text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT c.id, c.nombre, c.nit_ci, c.telefono, c.correo, c.direccion, c.avatar_url, c.saldo_pendiente, c.codigo_cliente
    FROM public.clientes c
    WHERE c.empresa_id = public.get_empresa_id_from_jwt() ORDER BY c.created_at DESC;
END;
$$;

-- upsert_client
DROP FUNCTION IF EXISTS public.upsert_client(uuid, text, text, text, text, text, text);
CREATE OR REPLACE FUNCTION upsert_client(
    p_id uuid, p_nombre text, p_nit_ci text, p_telefono text, p_correo text,
    p_direccion text, p_avatar_url text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    v_cliente_id uuid; v_new_client_code text;
BEGIN
    IF p_id IS NULL THEN
        LOOP
            v_new_client_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
            BEGIN
                INSERT INTO public.clientes(empresa_id, nombre, nit_ci, telefono, correo, direccion, avatar_url, codigo_cliente)
                VALUES (caller_empresa_id, p_nombre, p_nit_ci, p_telefono, p_correo, p_direccion, p_avatar_url, v_new_client_code)
                RETURNING id INTO v_cliente_id;
                EXIT;
            EXCEPTION WHEN unique_violation THEN
                RAISE NOTICE 'Colisión de código de cliente detectada. Reintentando...';
            END;
        END LOOP;
    ELSE
        UPDATE public.clientes SET nombre = p_nombre, nit_ci = p_nit_ci, telefono = p_telefono, correo = p_correo, direccion = p_direccion, avatar_url = p_avatar_url
        WHERE id = p_id AND empresa_id = caller_empresa_id;
        v_cliente_id := p_id;
    END IF;
    RETURN json_build_object('id', v_cliente_id);
END;
$$;

DO $$ BEGIN RAISE NOTICE 'Paso 5/7: Creando función de validación de correo robusta...'; END; $$;
    
-- **NUEVA FUNCIÓN MEJORADA**: validate_client_email
DROP FUNCTION IF EXISTS public.check_client_email_exists(text, uuid);
DROP FUNCTION IF EXISTS public.validate_client_email(text, uuid);
CREATE OR REPLACE FUNCTION public.validate_client_email(p_correo text, p_cliente_id_to_exclude uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id uuid := public.get_empresa_id_from_jwt();
BEGIN
    -- Si el correo es nulo o vacío, es válido (es opcional)
    IF p_correo IS NULL OR TRIM(p_correo) = '' THEN
        RETURN '{"valid": true}'::json;
    END IF;

    -- Validar formato y proveedor de correo con una expresión regular
    -- Acepta dominios comunes como gmail, hotmail, outlook, yahoo, icloud.
    IF NOT (p_correo ~* '^[a-zA-Z0-9._%+-]+@(gmail|hotmail|outlook|yahoo|icloud)\.(com|es|net|org)$') THEN
        RETURN json_build_object('valid', false, 'reason', 'format');
    END IF;

    -- Validar unicidad si el formato es correcto
    IF EXISTS (
        SELECT 1 FROM public.clientes c
        WHERE c.empresa_id = v_empresa_id
          AND c.correo = p_correo
          AND (p_cliente_id_to_exclude IS NULL OR c.id != p_cliente_id_to_exclude)
    ) THEN
        RETURN json_build_object('valid', false, 'reason', 'exists');
    END IF;

    -- Si pasa todas las validaciones
    RETURN '{"valid": true}'::json;
END;
$$;
    
DO $$
BEGIN
    -- Paso 6: Reinstalar la política RLS correcta para `clientes`.
    RAISE NOTICE 'Paso 6/7: Reinstalando política RLS correcta para `clientes`...';
    DROP POLICY IF EXISTS "Enable all for own company" ON public.clientes;
    CREATE POLICY "Enable all for own company" ON public.clientes
    FOR ALL USING (empresa_id = public.get_empresa_id_from_jwt());
    
    -- Paso 7: Actualizar el trigger de auditoría (preventivo).
    RAISE NOTICE 'Paso 7/7: Refrescando trigger de auditoría para `clientes`...';
    DROP TRIGGER IF EXISTS on_clientes_change ON public.clientes;
    CREATE TRIGGER on_clientes_change
    AFTER INSERT OR UPDATE OR DELETE ON public.clientes
    FOR EACH ROW EXECUTE FUNCTION public.registrar_cambio();
    
    RAISE NOTICE '--- SCRIPT DE CORRECCIÓN COMPLETADO EXITOSAMENTE ---';
END;
$$;