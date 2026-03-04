import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validation for Supabase credentials
const isUrlValid = supabaseUrl && supabaseUrl.startsWith('https://');
const isKeyValid = supabaseAnonKey && supabaseAnonKey.startsWith('eyJ'); // Supabase keys are JWTs
const hasValidCredentials = isUrlValid && isKeyValid;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Credentials missing. Auth will use dev bypass mode.');
} else if (!hasValidCredentials) {
    if (supabaseAnonKey?.startsWith('sb_publishable_')) {
        console.error('[Supabase] CRITICAL: VITE_SUPABASE_ANON_KEY appears to be a STRIPE key instead of a SUPABASE key.');
    } else {
        console.warn('[Supabase] Credentials appear malformed. Auth will use dev bypass mode.');
    }
}

// Only create client if we have valid credentials
export const supabase = hasValidCredentials 
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createClient('https://placeholder.supabase.co', 'placeholder-key');

// Export status for checks
export const supabaseStatus = {
    hasValidCredentials,
    url: hasValidCredentials ? supabaseUrl : null,
    isPlaceholder: !hasValidCredentials,
};

// Health check function
export async function checkSupabaseHealth(): Promise<boolean> {
    if (!hasValidCredentials) return false;
    
    try {
        const { error } = await supabase.from('providers').select('count', { count: 'exact', head: true });
        return !error;
    } catch {
        return false;
    }
}
