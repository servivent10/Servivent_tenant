-- =============================================================================
-- CLIENTS MODULE ENHANCEMENT: WEB INDICATOR & CODE REMOVAL (V1)
-- =============================================================================
-- This script enhances the clients module with two key changes:
-- 1. Adds `auth_user_id` to the main client query, allowing the frontend to
--    identify clients who have created a web account.
-- 2. Completely removes the `codigo_cliente` field from the database schema
--    and all related functions, as it is no longer in use.
--
-- INSTRUCTIONS:
-- Execute this script completely in your Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Remove `codigo_cliente` from the `clientes` table
-- -----------------------------------------------------------------------------
-- This will also drop the unique constraint associated with it.
ALTER TABLE public.clientes DROP COLUMN IF EXISTS codigo_cliente CASCADE;


-- -----------------------------------------------------------------------------
-- Step 2: Update `get_company_clients` RPC to return web account status
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_company_clients();
CREATE OR REPLACE FUNCTION get_company_clients()
RETURNS TABLE (
    id uuid,
    nombre text,
    nit_ci text,
    telefono text,
    correo text,
    direccion text,
    avatar_url text,
    saldo_pendiente numeric,
    auth_user_id uuid -- ADDED
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id, c.nombre, c.nit_ci, c.telefono, c.correo, c.direccion, c.avatar_url, c.saldo_pendiente, c.auth_user_id
    FROM
        public.clientes c
    WHERE
        c.empresa_id = public.get_empresa_id_from_jwt()
    ORDER BY
        c.created_at DESC;
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 3: Update `upsert_client` RPC to remove `codigo_cliente` logic
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.upsert_client(uuid, text, text, text, text, text, text);
CREATE OR REPLACE FUNCTION upsert_client(
    p_id uuid, p_nombre text, p_nit_ci text, p_telefono text, p_correo text,
    p_direccion text, p_avatar_url text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    v_cliente_id uuid;
BEGIN
    IF p_id IS NULL THEN
        INSERT INTO public.clientes(empresa_id, nombre, nit_ci, telefono, correo, direccion, avatar_url)
        VALUES (caller_empresa_id, p_nombre, p_nit_ci, p_telefono, p_correo, p_direccion, p_avatar_url)
        RETURNING id INTO v_cliente_id;
    ELSE
        UPDATE public.clientes SET nombre = p_nombre, nit_ci = p_nit_ci, telefono = p_telefono, correo = p_correo, direccion = p_direccion, avatar_url = p_avatar_url
        WHERE id = p_id AND empresa_id = caller_empresa_id;
        v_cliente_id := p_id;
    END IF;
    RETURN json_build_object('id', v_cliente_id);
END;
$$;


-- -----------------------------------------------------------------------------
-- Step 4: Update types and RPC for bulk import
-- -----------------------------------------------------------------------------
-- Note: The `client_import_row` type does not need to be changed as the `email` column
-- was already migrated to `correo`. We only need to update the function logic.

DROP FUNCTION IF EXISTS public.import_clients_in_bulk(client_import_row[]);
CREATE OR REPLACE FUNCTION import_clients_in_bulk(p_clients client_import_row[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := public.get_empresa_id_from_jwt();
    client_data client_import_row;
    existing_id uuid;
    created_count integer := 0;
    updated_count integer := 0;
    error_count integer := 0;
    error_messages text[] := ARRAY[]::text[];
    row_index integer := 1;
BEGIN
    IF caller_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado.';
    END IF;

    FOREACH client_data IN ARRAY p_clients
    LOOP
        BEGIN
            IF client_data.nombre IS NULL OR TRIM(client_data.nombre) = '' THEN
                RAISE EXCEPTION 'El campo "nombre" es obligatorio.';
            END IF;
            IF client_data.telefono IS NULL OR TRIM(client_data.telefono) = '' THEN
                RAISE EXCEPTION 'El campo "telefono" es obligatorio.';
            END IF;

            existing_id := NULL;
            IF client_data.nit_ci IS NOT NULL AND TRIM(client_data.nit_ci) <> '' THEN
                SELECT id INTO existing_id FROM public.clientes WHERE nit_ci = client_data.nit_ci AND empresa_id = caller_empresa_id;
            END IF;
            
            IF existing_id IS NOT NULL THEN
                UPDATE public.clientes SET
                    nombre = client_data.nombre,
                    telefono = client_data.telefono,
                    correo = client_data.correo,
                    direccion = client_data.direccion
                WHERE id = existing_id;
                updated_count := updated_count + 1;
            ELSE
                INSERT INTO public.clientes(empresa_id, nombre, nit_ci, telefono, correo, direccion)
                VALUES (caller_empresa_id, client_data.nombre, client_data.nit_ci, client_data.telefono, client_data.correo, client_data.direccion);
                created_count := created_count + 1;
            END IF;

        EXCEPTION
            WHEN OTHERS THEN
                error_count := error_count + 1;
                error_messages := array_append(error_messages, 'Fila ' || row_index || ': ' || SQLERRM);
        END;
        row_index := row_index + 1;
    END LOOP;

    RETURN json_build_object(
        'created', created_count,
        'updated', updated_count,
        'errors', error_count,
        'error_messages', error_messages
    );
END;
$$;


-- =============================================================================
-- End of script.
-- =============================================================================