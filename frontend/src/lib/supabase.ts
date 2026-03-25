
import { createClient } from '@supabase/supabase-js';

const readViteEnv = (): Record<string, string | undefined> => {
  try {
    return (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
  } catch {
    return {};
  }
};

const { VITE_SUPABASE_URL: supabaseUrl, VITE_SUPABASE_ANON_KEY: supabaseAnonKey } = readViteEnv();

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your .env file.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
