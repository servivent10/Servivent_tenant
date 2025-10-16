import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


interface UserPayload {
  nombre_completo: string;
  correo: string;
  password?: string;
  rol: 'Propietario' | 'Administrador' | 'Empleado';
  sucursal_id?: string;
  // --- Registration-specific fields ---
  empresa_nombre?: string;
  empresa_nit?: string;
  sucursal_nombre?: string;
  sucursal_direccion?: string;
  sucursal_telefono?: string;
  plan_tipo?: string; // This is now a descriptive string like "Profesional (Mensual)"
  timezone?: string;
  moneda?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: UserPayload = await req.json();
    const {
        nombre_completo, correo, password, rol, sucursal_id,
        empresa_nombre, empresa_nit,
        sucursal_nombre, sucursal_direccion, sucursal_telefono, plan_tipo,
        timezone, moneda
    } = payload;
    
    if (!nombre_completo || !correo || !password || !rol) {
        return new Response(JSON.stringify({ error: 'Faltan campos de usuario obligatorios.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    let final_empresa_id: string;
    let final_sucursal_id: string;

    if (rol === 'Propietario') {
      // --- REGISTRATION FLOW FOR A NEW COMPANY ---
      if (!empresa_nombre || !empresa_nit || !sucursal_nombre || !plan_tipo || !timezone || !moneda) {
        throw new Error('Faltan campos obligatorios para el registro de una nueva empresa.');
      }
      
      const { data: existingCompany, error: nitError } = await supabaseAdmin
        .from('empresas').select('id').eq('nit', empresa_nit).single();
      if (nitError && nitError.code !== 'PGRST116') throw nitError;
      if (existingCompany) {
        throw new Error(`El NIT "${empresa_nit}" ya ha sido registrado por otra empresa.`);
      }

      // Find the plan ID from the descriptive name
      const planNameMatch = plan_tipo.match(/^([a-zA-Z\s]+)/);
      const planName = planNameMatch ? planNameMatch[1].trim() : null;
      if (!planName) throw new Error('No se pudo determinar el plan desde el tipo de licencia.');

      const { data: planData, error: planError } = await supabaseAdmin
        .from('planes').select('id').eq('nombre', planName).single();
      if (planError || !planData) throw new Error(`El plan "${planName}" no es válido.`);


      const { data: empresaData, error: empresaError } = await supabaseAdmin
        .from('empresas').insert({ 
            nombre: empresa_nombre, 
            nit: empresa_nit,
            timezone: timezone,
            moneda: moneda
        }).select('id').single();
      if (empresaError) throw new Error(`Error al crear la empresa: ${empresaError.message}`);
      final_empresa_id = empresaData.id;

      const { data: sucursalData, error: sucursalError } = await supabaseAdmin
        .from('sucursales').insert({ empresa_id: final_empresa_id, nombre: sucursal_nombre, direccion: sucursal_direccion, telefono: sucursal_telefono }).select('id').single();
      if (sucursalError) throw new Error(`Error al crear la sucursal: ${sucursalError.message}`);
      final_sucursal_id = sucursalData.id;
      
      const fecha_fin = new Date();
      fecha_fin.setDate(fecha_fin.getDate() + 30); // 30-day trial

      const { error: licenciaError } = await supabaseAdmin.from('licencias').insert({
          empresa_id: final_empresa_id,
          plan_id: planData.id,
          tipo_licencia: plan_tipo,
          fecha_inicio: new Date().toISOString(),
          fecha_fin: fecha_fin.toISOString(),
          estado: 'Pendiente de Aprobación'
        });
       if (licenciaError) throw new Error(`Error al crear la licencia: ${licenciaError.message}`);

    } else {
      // --- CREATING A NEW USER FOR AN EXISTING COMPANY ---
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) throw new Error('Missing authorization header');
      const jwt = authHeader.replace('Bearer ', '');
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: `Bearer ${jwt}` } } }
      );
      
      // get_caller_profile_safely now returns planLimits
      const { data: callerProfile, error: callerError } = await supabaseClient.rpc('get_caller_profile_safely').single();
      if (callerError || !callerProfile) throw new Error('No se pudo verificar al usuario que realiza la llamada.');
      if (callerProfile.rol !== 'Propietario' && callerProfile.rol !== 'Administrador') throw new Error('Acceso denegado: Se requiere rol de Propietario o Administrador.');
      
      // **ENFORCEMENT LOGIC**
      const { count: userCount, error: countError } = await supabaseAdmin
        .from('usuarios')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', callerProfile.empresa_id);

      if (countError) throw new Error(`No se pudo contar usuarios: ${countError.message}`);
      
      const maxUsers = callerProfile.planLimits?.maxUsers ?? 1;

      if (userCount !== null && userCount >= maxUsers) {
        throw new Error('Límite de usuarios alcanzado para el plan actual.');
      }
      
      final_empresa_id = callerProfile.empresa_id;
      final_sucursal_id = sucursal_id;
    }

    // --- COMMON USER CREATION LOGIC ---
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: correo,
      password: password,
      email_confirm: true,
      app_metadata: {
        nombre_completo: nombre_completo, // Store name in app_metadata for notifications
        empresa_id: final_empresa_id
      }
    });
    if (authError) {
        if (authError.message.includes('User already registered')) throw new Error('Este correo electrónico ya está en uso.');
        if (authError.message.includes('Password should be at least 6 characters')) throw new Error('La contraseña debe tener al menos 6 caracteres.');
        throw authError;
    }
    const newUserId = authData.user.id;

    const { error: profileError } = await supabaseAdmin.from('usuarios').insert({
        id: newUserId,
        empresa_id: final_empresa_id,
        nombre_completo: nombre_completo,
        rol: rol,
        correo: correo,
        sucursal_id: final_sucursal_id,
      });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(`Error de base de datos al crear el perfil: ${profileError.message}`);
    }

    return new Response(JSON.stringify({ userId: newUserId, message: 'Usuario creado con éxito' }), {
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