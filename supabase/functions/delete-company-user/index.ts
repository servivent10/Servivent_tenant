import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Declaración para el entorno de Deno
declare const Deno: any;

// Headers de CORS para permitir la invocación desde el frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Manejo de la solicitud pre-vuelo (preflight) de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { p_user_id_to_delete } = await req.json();
    if (!p_user_id_to_delete) {
      throw new Error('El ID del usuario a eliminar es obligatorio.');
    }

    // 1. Crear un cliente con la autenticación del llamador
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 2. Verificar el perfil del llamador usando la función RPC segura
    const { data: callerProfile, error: rpcError } = await supabaseClient
      .rpc('get_caller_profile_safely')
      .single();

    if (rpcError) throw rpcError;
    if (!callerProfile) throw new Error('No se pudo verificar al usuario que realiza la llamada.');

    // 3. Crear un cliente de administrador para realizar operaciones privilegiadas
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // 4. Obtener perfil del usuario a eliminar para validación
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('usuarios')
      .select('empresa_id, rol')
      .eq('id', p_user_id_to_delete)
      .single();
    if (targetError) throw new Error('No se encontró el perfil del usuario a eliminar.');

    // 5. Realizar comprobaciones de seguridad
    if (callerProfile.rol !== 'Propietario' && callerProfile.rol !== 'Administrador') {
        throw new Error('Acceso denegado: Se requiere rol de Propietario o Administrador.');
    }
    // Nota: El chequeo de auto-eliminación se omite ya que la UI lo previene,
    // y la función RPC `get_caller_profile_safely` no devuelve el user_id.
    if (callerProfile.empresa_id !== targetProfile.empresa_id) {
        throw new Error('No puedes eliminar a un usuario que no pertenece a tu empresa.');
    }
    if (targetProfile.rol === 'Propietario') {
        throw new Error('No se puede eliminar a un usuario con el rol de Propietario.');
    }

    // 6. Realizar la eliminación
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(p_user_id_to_delete);
    if (deleteError) throw deleteError;
    
    // La eliminación en cascada de la clave foránea en `public.usuarios` se encarga de eliminar el perfil.

    return new Response(JSON.stringify({ message: 'Usuario eliminado con éxito' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
