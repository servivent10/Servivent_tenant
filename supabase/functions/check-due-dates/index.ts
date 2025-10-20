// Import createClient
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// FIX: Add Deno type declaration for Supabase Edge Functions
declare const Deno: any;

// Define CORS headers to allow invocation from Supabase dashboard or other services
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the service role key to bypass RLS.
    // This is crucial for a system-wide cron job that needs to access all companies' data.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      // Auth is not strictly necessary for service role but good practice
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    console.log("Cron job triggered: Executing RPC function 'check_and_notify_due_dates'...");

    // Call the PostgreSQL function that contains the main business logic
    const { error } = await supabaseAdmin.rpc('check_and_notify_due_dates')

    if (error) {
      throw error
    }
    
    console.log("Successfully executed 'check_and_notify_due_dates'.");

    return new Response(JSON.stringify({ message: "Proceso de notificación de vencimientos completado exitosamente." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error executing due date check cron job:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
