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
interface NewUserPayload {
  nombre_completo: string;
  correo: string;
  password?: string;
  rol: 'Administrador' | 'Empleado';
  sucursal_id: string;
}

// Escucha el evento 'fetch' que se dispara cuando se invoca la función
Deno.serve(async (req) => {
  // Maneja la solicitud pre-vuelo (preflight) de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Extraer el token de autorización del usuario que llama a la función
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }
    const jwt = authHeader.replace('Bearer ', '');

    // 2. Extraer los datos del nuevo usuario del cuerpo de la solicitud
    const payload: NewUserPayload = await req.json();
    const { nombre_completo, correo, password, rol, sucursal_id } = payload;
    
    if (!nombre_completo || !correo || !password || !rol || !sucursal_id) {
        return new Response(JSON.stringify({ error: 'Faltan campos obligatorios en la solicitud.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    // 3. Crear un cliente de Supabase CON LOS PERMISOS DEL USUARIO CHE LLAMA
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    );
    
    // 4. Obtener el perfil del usuario que llama para validar sus permisos de forma segura
    const { data: callerProfile, error: callerError } = await supabaseClient
      .rpc('get_caller_profile_safely')
      .single();

    if (callerError || !callerProfile) {
      console.error('Error al verificar el perfil del llamador:', callerError);
      throw new Error('No se pudo verificar al usuario que realiza la llamada. Asegúrate de haber ejecutado el último script SQL de "USER_MANAGEMENT_FIX.md" que define la función "get_caller_profile_safely".');
    }

    // 5. Comprobación de seguridad: solo Propietarios o Administradores pueden crear usuarios
    if (callerProfile.rol !== 'Propietario' && callerProfile.rol !== 'Administrador') {
      throw new Error('Acceso denegado: Se requiere rol de Propietario o Administrador.');
    }

    // 6. Crear un cliente de Supabase ADMIN con la service_role_key para realizar operaciones privilegiadas
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // --- NUEVO: Comprobación proactiva del límite de usuarios ---
    const { data: licenseData, error: licenseError } = await supabaseAdmin
      .from('licencias')
      .select('tipo_licencia')
      .eq('empresa_id', callerProfile.empresa_id)
      .single();

    if (licenseError) throw new Error(`No se pudo verificar la licencia de la empresa: ${licenseError.message}`);

    const { count: userCount, error: countError } = await supabaseAdmin
      .from('usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', callerProfile.empresa_id);
    
    if (countError) throw new Error(`No se pudo contar los usuarios existentes: ${countError.message}`);

    const planType = licenseData.tipo_licencia || '';
    let maxUsers = 1; // Default bajo por seguridad
    if (planType.includes('Emprendedor')) maxUsers = 3;
    else if (planType.includes('Profesional') || planType.includes('Prueba Gratuita')) maxUsers = 10;
    else if (planType.includes('Corporativo')) maxUsers = Infinity;
    
    if (userCount !== null && userCount >= maxUsers) {
      throw new Error('Límite de usuarios alcanzado para el plan actual.');
    }
    // --- FIN: Comprobación proactiva del límite de usuarios ---


    // 7. Crear el nuevo usuario en `auth.users` usando la API de administrador
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: correo,
      password: password,
      email_confirm: true, // El usuario se crea ya confirmado, no se envía correo
    });

    if (authError) {
        if (authError.message.includes('User already registered')) {
            throw new Error('Este correo electrónico ya está en uso.');
        }
        if (authError.message.includes('Password should be at least 6 characters')) {
            throw new Error('La contraseña debe tener al menos 6 caracteres.');
        }
        throw authError;
    }
    
    const newUserId = authData.user.id;

    // 8. **SOLUCIÓN:** En lugar de depender de un trigger, hacemos un INSERT directo
    // en la tabla `usuarios`. Este método es más robusto porque nos aseguramos de
    // proveer todos los campos obligatorios (como `empresa_id`) de inmediato.
    const { error: profileError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: newUserId,
        empresa_id: callerProfile.empresa_id,
        nombre_completo: nombre_completo,
        rol: rol,
        correo: correo,
        sucursal_id: sucursal_id,
      });

    if (profileError) {
      // Si la inserción del perfil falla, es crucial eliminar el usuario de `auth`
      // para evitar tener usuarios "huérfanos" sin perfil.
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      // Lanzamos un error detallado para que el frontend pueda mostrarlo.
      throw new Error(`Database error creating new user profile: ${profileError.message}`);
    }

    // 9. Devolver una respuesta exitosa con el ID del nuevo usuario
    return new Response(JSON.stringify({ userId: newUserId, message: 'Usuario creado con éxito' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    // Manejo de errores: devuelve un error 500 con el mensaje
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
