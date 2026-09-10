import { createClient } from "@supabase/supabase-js";

export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  configured: Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
};

export const supabase = supabaseConfig.configured ? createClient(supabaseConfig.url, supabaseConfig.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
}) : null;

export const supabaseSetupMessage = "Add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY to activate Supabase Auth, RLS, Storage and Realtime.";