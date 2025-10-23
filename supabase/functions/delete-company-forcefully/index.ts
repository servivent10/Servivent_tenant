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

    console.log(`[START] Proceso de eliminación en 4 etapas para la empresa: ${p_empresa_id}`);

    // --- ETAPA 1: VERIFICACIÓN DE PERMISOS ---
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
    console.log('[ETAPA 1/4] Verificación de SuperAdmin completada.');

    // --- ETAPA 2: OBTENER Y ELIMINAR TODOS LOS USUARIOS DE AUTH (EMPLEADOS Y CLIENTES) ---
    console.log('[ETAPA 2/4] Obteniendo la lista de todos los usuarios (empleados y clientes) para eliminar...');
    
    const { data: tenantUsers, error: tenantUserError } = await supabaseAdmin
      .from('usuarios').select('id').eq('empresa_id', p_empresa_id);
    if (tenantUserError) throw new Error(`Error al obtener empleados: ${tenantUserError.message}`);

    const { data: customerUsers, error: customerUserError } = await supabaseAdmin
      .from('clientes').select('auth_user_id').eq('empresa_id', p_empresa_id).not('auth_user_id', 'is', null);
    if (customerUserError) throw new Error(`Error al obtener clientes: ${customerUserError.message}`);

    const tenantUserIds = tenantUsers.map(u => u.id);
    const customerUserIds = customerUsers.map(c => c.auth_user_id);
    const allUserIdsToDelete = [...new Set([...tenantUserIds, ...customerUserIds])];

    console.log(`[ETAPA 2/4] Se encontraron ${allUserIdsToDelete.length} usuarios en total. Procediendo a eliminarlos de auth.users...`);
    
    for (const userIdToDelete of allUserIdsToDelete) {
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);
      if (deleteUserError && !deleteUserError.message.includes('User not found')) {
        console.warn(`No se pudo eliminar al usuario ${userIdToDelete} de auth: ${deleteUserError.message}`);
      }
    }
    console.log('[ETAPA 2/4] Usuarios eliminados de auth.users.');

    // --- ETAPA 3: LIMPIAR TABLAS NO CASCADABLES (historial_cambios) ---
    console.log('[ETAPA 3/4] Limpiando registros de auditoría no enlazados por cascada...');
    const { error: auditError } = await supabaseAdmin
        .from('historial_cambios')
        .delete()
        .eq('empresa_id', p_empresa_id);

    if (auditError) {
        // No detener el proceso, solo advertir.
        console.warn(`Advertencia: No se pudieron limpiar los registros de auditoría: ${auditError.message}`);
    } else {
        console.log('[ETAPA 3/4] Registros de auditoría eliminados.');
    }

    // --- ETAPA 4: DEMOLICIÓN FINAL ---
    console.log('[ETAPA 4/4] Ejecutando DELETE final en la tabla de empresas...');
    const { error: deleteError } = await supabaseAdmin
      .from('empresas')
      .delete()
      .eq('id', p_empresa_id);
      
    if (deleteError) {
        throw new Error(`Error en la etapa de eliminación final: ${deleteError.message}`);
    }
    console.log(`[SUCCESS] La empresa ${p_empresa_id} ha sido eliminada correctamente.`);
    
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
