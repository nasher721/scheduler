import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validation for Supabase credentials
const isUrlValid = supabaseUrl && supabaseUrl.startsWith('https://');
const isKeyValid = supabaseAnonKey && supabaseAnonKey.startsWith('eyJ'); // Supabase keys are JWTs

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase credentials missing. AUTH AND DATABASE WILL FAIL.');
} else if (!isUrlValid || !isKeyValid) {
    if (supabaseAnonKey.startsWith('sb_publishable_')) {
        console.error('CRITICAL: VITE_SUPABASE_ANON_KEY appears to be a STRIPE key instead of a SUPABASE key.');
    } else {
        console.error('Supabase credentials appear malformed. Check your .env.local or Vercel settings.');
    }
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key'
);
