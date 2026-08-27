import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isLocalDevUrl = (url: string | undefined): boolean => {
    if (!url) return false;
    return url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost');
};

const isUrlValid = Boolean(
    supabaseUrl && (supabaseUrl.startsWith('https://') || isLocalDevUrl(supabaseUrl))
);

const isStripeKey = Boolean(
    supabaseAnonKey && /^(sk|pk|rk)_(live|test)_/.test(supabaseAnonKey)
);

const isKeyValid = Boolean(
    supabaseAnonKey &&
    !isStripeKey &&
    (supabaseAnonKey.startsWith('eyJ') || supabaseAnonKey.startsWith('sb_publishable_'))
);

const hasValidCredentials = isUrlValid && isKeyValid;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Credentials missing. Auth will use dev bypass mode.');
} else if (!hasValidCredentials) {
    if (isStripeKey) {
        console.error('[Supabase] CRITICAL: VITE_SUPABASE_ANON_KEY appears to be a Stripe key instead of a Supabase key.');
    } else {
        console.warn('[Supabase] Credentials appear malformed. Auth will use dev bypass mode.');
    }
}

export const supabase = hasValidCredentials
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createClient('https://placeholder.supabase.co', 'placeholder-key');

export const supabaseStatus = {
    hasValidCredentials,
    url: hasValidCredentials ? supabaseUrl : null,
    isPlaceholder: !hasValidCredentials,
};

export async function checkSupabaseHealth(): Promise<boolean> {
    if (!hasValidCredentials) return false;

    try {
        const { error } = await supabase.from('providers').select('count', { count: 'exact', head: true });
        return !error;
    } catch {
        return false;
    }
}
