import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Declaración para el entorno de Deno
declare const Deno: any;

// Headers de CORS para permitir la invocación desde el frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Interfaz para el cuerpo de la solicitud
interface Payload {
  p_empresa_id: string;
  p_superadmin_password: string;
}

Deno.serve(async (req) => {
  // Manejo de la solicitud pre-vuelo (preflight) de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { p_empresa_id, p_superadmin_password }: Payload = await req.json();
    if (!p_empresa_id || !p_superadmin_password) {
      throw new Error("Faltan parámetros: se requieren p_empresa_id y p_superadmin_password.");
    }

    console.log(`[START] Proceso de eliminación en 2 etapas para la empresa: ${p_empresa_id}`);

    // --- 1. VERIFICACIÓN DE PERMISOS (LÓGICA DE SEGURIDAD) ---
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Missing authorization header");
    
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("No se pudo autenticar al usuario.");

    const { data: userProfile } = await supabaseAdmin.from('usuarios').select('rol').eq('id', user.id).single();
    if (userProfile?.rol !== 'SuperAdmin') throw new Error("Acceso denegado: Se requiere rol de SuperAdmin.");

    const { error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: user.email,
      password: p_superadmin_password,
    });
    if (signInError) throw new Error("Contraseña de SuperAdmin incorrecta. Operación cancelada.");
    console.log('[STEP 1/3] Verificación de SuperAdmin completada.');

    // --- 2. ETAPA 1: ROMPER EL CICLO DE RECURSIÓN (AHORA DENTRO DE LA EDGE FUNCTION) ---
    console.log('[STEP 2/3] Obteniendo la lista de usuarios para eliminar...');
    const { data: usersToDelete, error: userFetchError } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('empresa_id', p_empresa_id);

    if (userFetchError) {
      throw new Error(`Error al obtener la lista de usuarios: ${userFetchError.message}`);
    }

    console.log(`[STEP 2/3] Se encontraron ${usersToDelete.length} usuarios. Procediendo a eliminarlos...`);
    
    // Eliminar cada usuario usando el cliente de administrador
    for (const userToDelete of usersToDelete) {
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userToDelete.id);
      if (deleteUserError) {
        // Registrar el error pero continuar si es posible
        console.warn(`No se pudo eliminar al usuario ${userToDelete.id}: ${deleteUserError.message}`);
      }
    }
    console.log('[STEP 2/3] Preparación completada, usuarios eliminados de auth.users.');


    // --- 3. ETAPA 2: DEMOLICIÓN FINAL ---
    // Con los usuarios ya eliminados, el planificador ya no ve un ciclo y
    // la cascada puede proceder sin problemas para el resto de las tablas.
    console.log('[STEP 3/3] Ejecutando DELETE final en la tabla de empresas...');
    const { error: deleteError } = await supabaseAdmin
      .from('empresas')
      .delete()
      .eq('id', p_empresa_id);
      
    if (deleteError) {
        throw new Error(`Error en la etapa de eliminación final: ${deleteError.message}`);
    }
    console.log(`[SUCCESS] La empresa ${p_empresa_id} ha sido eliminada correctamente.`);
    
    // --- 4. RESPUESTA DE ÉXITO ---
    return new Response(JSON.stringify({ message: "ÉXITO: La empresa y todos sus datos asociados han sido eliminados." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[FATAL] Error en la Edge Function delete-company-forcefully:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});