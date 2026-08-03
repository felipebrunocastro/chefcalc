import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Configured via .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
export const supabase = createClient(url || 'http://localhost', anonKey || 'anon', {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const isSupabaseConfigured = Boolean(url && anonKey);
