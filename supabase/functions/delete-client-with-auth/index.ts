import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { clientId } = await req.json();
    if (!clientId) {
      throw new Error('El ID del cliente es obligatorio.');
    }

    // Auth check for the user performing the action
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Falta el encabezado de autorización.');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller } } = await supabaseClient.auth.getUser();
    if (!caller) throw new Error('No se pudo verificar al usuario que realiza la acción.');

    // Admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get client to be deleted
    const { data: clientToDelete, error: fetchError } = await supabaseAdmin
      .from('clientes')
      .select('id, auth_user_id, empresa_id')
      .eq('id', clientId)
      .single();

    if (fetchError) throw new Error(`No se encontró al cliente: ${fetchError.message}`);

    // Security check: ensure deleter belongs to the same company
    const { data: callerProfile, error: profileError } = await supabaseAdmin
        .from('usuarios')
        .select('empresa_id')
        .eq('id', caller.id)
        .single();

    if(profileError || !callerProfile) throw new Error('No se pudo encontrar el perfil del usuario.');

    if(callerProfile.empresa_id !== clientToDelete.empresa_id) {
        throw new Error('No tienes permiso para eliminar a este cliente.');
    }

    // Delete the associated auth user if it exists
    if (clientToDelete.auth_user_id) {
      const { error: deleteAuthUserError } = await supabaseAdmin.auth.admin.deleteUser(clientToDelete.auth_user_id);
      if (deleteAuthUserError && deleteAuthUserError.message !== 'User not found') {
        // Log other errors but proceed, as the main goal is to delete the client record
        console.warn(`Could not delete auth user ${clientToDelete.auth_user_id}: ${deleteAuthUserError.message}`);
      }
    }

    // Delete the client record from public.clientes
    const { error: deleteClientError } = await supabaseAdmin
      .from('clientes')
      .delete()
      .eq('id', clientId);

    if (deleteClientError) throw deleteClientError;

    return new Response(JSON.stringify({ message: 'Cliente eliminado correctamente.' }), {
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