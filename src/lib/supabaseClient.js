/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// -----------------------------------------------------------------------------
// IMPORTANTE: Reemplaza estos valores con la URL y la clave anónima de tu proyecto de Supabase.
// Puedes encontrarlos en la configuración de tu proyecto en Supabase, en la sección de API.
// -----------------------------------------------------------------------------
const supabaseUrl = 'https://fqqmbgqeikiaehzpdway.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcW1iZ3FlaWtpYWVoenBkd2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0MzMzNTAsImV4cCI6MjA3NDAwOTM1MH0.uWFOQ05Tpp6UCF1oAmt_fGv5jh1h1qJa3o9_stXfyFw';
// -----------------------------------------------------------------------------

if (supabaseUrl === 'YOUR_SUPABASE_URL' || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
    const warningStyle = 'color: red; font-size: 16px; font-weight: bold;';
    console.warn('%c¡Atención! El cliente de Supabase no está configurado.', warningStyle);
    console.warn("Por favor, añade la URL y la clave anónima de tu proyecto en el archivo 'src/lib/supabaseClient.js'.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});