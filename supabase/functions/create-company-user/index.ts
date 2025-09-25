import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// FIX: Add a declaration for the Deno global to resolve TypeScript errors
// in environments that don't have the Deno types loaded by default.
declare const Deno: any;

// SOLUCIÓN: Definir los headers de CORS directamente aquí para eliminar la dependencia de un archivo no existente.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


// Interfaz para tipar el cuerpo de la solicitud
// **MODIFIED:** Unify payload for both new company registration and adding a user
interface UserPayload {
  // Common user fields
  nombre_completo: string;
  correo: string;
  password?: string;
  rol: 'Propietario' | 'Administrador' | 'Empleado';

  // Fields for adding a user to an existing company
  sucursal_id?: string;

  // Fields for new company registration
  empresa_nombre?: string;
  empresa_nit?: string;
  empresa_direccion?: string;
  empresa_telefono?: string;
  sucursal_nombre?: string;
  sucursal_direccion?: string;
  sucursal_telefono?: string;
  plan_tipo?: string;
}

// Escucha el evento 'fetch' que se dispara cuando se invoca la función
Deno.serve(async (req) => {
  // Maneja la solicitud pre-vuelo (preflight) de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: UserPayload = await req.json();
    const {
        nombre_completo, correo, password, rol, sucursal_id,
        empresa_nombre, empresa_nit, empresa_direccion, empresa_telefono,
        sucursal_nombre, sucursal_direccion, sucursal_telefono, plan_tipo
    } = payload;
    
    if (!nombre_completo || !correo || !password || !rol) {
        return new Response(JSON.stringify({ error: 'Faltan campos de usuario obligatorios.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    // Crear un cliente de Supabase ADMIN con la service_role_key para realizar operaciones privilegiadas
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    let final_empresa_id: string;
    let final_sucursal_id: string;

    // --- LOGIC BRANCH: New Registration vs. Add User ---
    if (rol === 'Propietario') {
      // --- This is a new Company Registration ---
      if (!empresa_nombre || !empresa_nit || !sucursal_nombre || !plan_tipo) {
        throw new Error('Faltan campos obligatorios para el registro de una nueva empresa.');
      }
      
      const { data: existingCompany, error: nitError } = await supabaseAdmin
        .from('empresas').select('id').eq('nit', empresa_nit).single();
      if (nitError && nitError.code !== 'PGRST116') throw nitError;
      if (existingCompany) {
        throw new Error(`El NIT "${empresa_nit}" ya ha sido registrado por otra empresa.`);
      }

      const { data: empresaData, error: empresaError } = await supabaseAdmin
        .from('empresas').insert({ nombre: empresa_nombre, nit: empresa_nit, direccion: empresa_direccion, telefono: empresa_telefono }).select('id').single();
      if (empresaError) throw new Error(`Error al crear la empresa: ${empresaError.message}`);
      final_empresa_id = empresaData.id;

      const { data: sucursalData, error: sucursalError } = await supabaseAdmin
        .from('sucursales').insert({ empresa_id: final_empresa_id, nombre: sucursal_nombre, direccion: sucursal_direccion, telefono: sucursal_telefono }).select('id').single();
      if (sucursalError) throw new Error(`Error al crear la sucursal: ${sucursalError.message}`);
      final_sucursal_id = sucursalData.id;
      
      const fecha_fin = new Date();
      if (plan_tipo.includes('Prueba Gratuita')) fecha_fin.setDate(fecha_fin.getDate() + 30);
      else if (plan_tipo.includes('Mensual')) fecha_fin.setMonth(fecha_fin.getMonth() + 1);
      else if (plan_tipo.includes('Anual')) fecha_fin.setFullYear(fecha_fin.getFullYear() + 1);
      else if (plan_tipo.includes('Pago Único')) fecha_fin.setFullYear(fecha_fin.getFullYear() + 99);
      else fecha_fin.setDate(fecha_fin.getDate() + 30); // Default fallback

      const { error: licenciaError } = await supabaseAdmin.from('licencias').insert({
          empresa_id: final_empresa_id,
          tipo_licencia: plan_tipo,
          fecha_inicio: new Date().toISOString(),
          fecha_fin: fecha_fin.toISOString(),
          estado: 'Activa'
        });
       if (licenciaError) throw new Error(`Error al crear la licencia: ${licenciaError.message}`);

    } else {
      // --- This is for adding a user to an existing company (original logic) ---
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) throw new Error('Missing authorization header');
      const jwt = authHeader.replace('Bearer ', '');
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: `Bearer ${jwt}` } } }
      );
      
      const { data: callerProfile, error: callerError } = await supabaseClient.rpc('get_caller_profile_safely').single();
      if (callerError || !callerProfile) throw new Error('No se pudo verificar al usuario que realiza la llamada.');
      if (callerProfile.rol !== 'Propietario' && callerProfile.rol !== 'Administrador') throw new Error('Acceso denegado: Se requiere rol de Propietario o Administrador.');
      
      const { data: licenseData, error: licenseError } = await supabaseAdmin.from('licencias').select('tipo_licencia').eq('empresa_id', callerProfile.empresa_id).single();
      if (licenseError) throw new Error(`No se pudo verificar la licencia: ${licenseError.message}`);
      const { count: userCount, error: countError } = await supabaseAdmin.from('usuarios').select('*', { count: 'exact', head: true }).eq('empresa_id', callerProfile.empresa_id);
      if (countError) throw new Error(`No se pudo contar usuarios: ${countError.message}`);

      const planType = licenseData.tipo_licencia || '';
      let maxUsers = 1;
      if (planType.includes('Emprendedor')) maxUsers = 3;
      else if (planType.includes('Profesional') || planType.includes('Prueba Gratuita')) maxUsers = 10;
      else if (planType.includes('Corporativo')) maxUsers = Infinity;
      if (userCount !== null && userCount >= maxUsers) {
        throw new Error('Límite de usuarios alcanzado para el plan actual.');
      }
      
      final_empresa_id = callerProfile.empresa_id;
      final_sucursal_id = sucursal_id;
    }

    // --- UNIFIED LOGIC: Create auth user and profile ---
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: correo,
      password: password,
      email_confirm: true,
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
