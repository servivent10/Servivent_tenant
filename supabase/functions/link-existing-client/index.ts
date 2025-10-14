import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Payload {
  email: string;
  password: string;
  slug: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, password, slug }: Payload = await req.json();
    if (!email || !password || !slug) {
      throw new Error("Se requieren el correo, la contraseña y el slug de la empresa.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Find the company by slug
    const { data: company, error: companyError } = await supabaseAdmin
      .from('empresas')
      .select('id')
      .eq('slug', slug)
      .single();

    if (companyError || !company) {
      throw new Error('No se encontró una empresa con esa URL.');
    }

    // 2. Find the client record in that company, including name and phone for notification
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clientes')
      .select('id, auth_user_id, nombre, telefono')
      .eq('correo', email)
      .eq('empresa_id', company.id)
      .single();

    if (clientError || !client) {
      throw new Error('No se encontró un cliente con este correo en nuestros registros.');
    }
    
    // 3. Check if the client already has a web account
    if (client.auth_user_id) {
        throw new Error('Este cliente ya tiene una cuenta web asociada.');
    }

    // 4. Create the new auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
        if (authError.message.includes('User already registered')) {
            throw new Error('Este correo ya está en uso por otra cuenta. Contacta a soporte.');
        }
        if (authError.message.includes('Password should be at least 6 characters')) {
            throw new Error('La contraseña debe tener al menos 6 caracteres.');
        }
        throw authError;
    }
    const newUserId = authData.user.id;

    // 5. Link the new auth user to the existing client record
    const { error: updateError } = await supabaseAdmin
      .from('clientes')
      .update({ auth_user_id: newUserId })
      .eq('id', client.id);

    if (updateError) {
      // If linking fails, delete the created auth user to allow retry
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(`Error al vincular la cuenta: ${updateError.message}`);
    }

    // 6. Generate a notification for the company
    const notificationMessage = `El cliente existente "<b>${client.nombre}</b> (${client.telefono || 'sin teléfono'})", activó su cuenta en el catálogo web.`;

    const { error: notificationError } = await supabaseAdmin
      .from('notificaciones')
      .insert({
        empresa_id: company.id,
        usuario_generador_id: null,
        usuario_generador_nombre: 'Catálogo Web',
        mensaje: notificationMessage,
        tipo_evento: 'NUEVO_CLIENTE',
        entidad_id: client.id,
        sucursales_destino_ids: null // Global notification for the company
      });

    if (notificationError) {
      // If notification fails, just log it. The main operation (linking) was successful.
      console.error('Failed to create notification for client link:', notificationError.message);
    }

    return new Response(JSON.stringify({ message: 'Cuenta web activada con éxito.' }), {
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