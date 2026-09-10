import { createClient } from "@supabase/supabase-js";

export const supabaseConfig = {
  url: process.env.REACT_APP_SUPABASE_URL,
  anonKey: process.env.REACT_APP_SUPABASE_ANON_KEY,
  configured: Boolean(process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY),
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