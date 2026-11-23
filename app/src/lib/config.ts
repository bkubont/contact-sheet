/** Cloud account settings. Leave empty → on-device only (no sign-in). */

export const APP_CONFIG = {
  // Paste from Supabase → Project Settings → API after running supabase/schema.sql
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '',
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '',
};

export const syncConfigured = !!(APP_CONFIG.supabaseUrl && APP_CONFIG.supabaseAnonKey);
