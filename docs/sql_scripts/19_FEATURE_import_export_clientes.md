-- =============================================================================
-- CLIENTS IMPORT/EXPORT MODULE - DATABASE SETUP (V2 - Secure Client Code)
-- =============================================================================
-- Este script actualiza la lógica de backend para la importación masiva de clientes,
-- utilizando el nuevo sistema de código de cliente aleatorio y globalmente único.
--
-- **INSTRUCCIONES:**
-- Ejecuta este script completo en el Editor SQL de tu proyecto de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paso 1: Habilitar la extensión pgcrypto para generar UUIDs aleatorios
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Paso 2: Crear un tipo de dato para la importación
-- -----------------------------------------------------------------------------
DROP TYPE IF EXISTS public.client_import_row CASCADE;
CREATE TYPE public.client_import_row AS (
    nombre text,
    nit_ci text,
    telefono text,
    email text,
    direccion text
);


-- -----------------------------------------------------------------------------
-- Paso 3: Crear la función de importación masiva (ACTUALIZADA)
-- -----------------------------------------------------------------------------
-- Descripción:
-- - Actualiza clientes existentes basándose en el NIT/CI.
-- - Para clientes nuevos, genera un código de cliente aleatorio de 8 caracteres
--   y se asegura de que sea único antes de insertarlo.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION import_clients_in_bulk(p_clients client_import_row[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_empresa_id uuid := (SELECT u.empresa_id FROM public.usuarios u WHERE u.id = auth.uid());
    client_data client_import_row;
    existing_id uuid;
    v_new_client_code text;
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
                    email = client_data.email,
                    direccion = client_data.direccion
                WHERE id = existing_id;
                updated_count := updated_count + 1;
            ELSE
                -- Generar un código único aleatorio para el nuevo cliente
                LOOP
                    v_new_client_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
                    -- Verificar que el código no exista ya
                    IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE codigo_cliente = v_new_client_code) THEN
                        EXIT; -- Salir del bucle si el código es único
                    END IF;
                END LOOP;

                INSERT INTO public.clientes(empresa_id, nombre, nit_ci, telefono, email, direccion, codigo_cliente)
                VALUES (caller_empresa_id, client_data.nombre, client_data.nit_ci, client_data.telefono, client_data.email, client_data.direccion, v_new_client_code);
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
-- Fin del script.
-- =============================================================================
