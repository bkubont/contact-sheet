/* Cloud account settings.
 *
 * Leave these empty and the app runs on-device only (no sign-in).
 * To turn on accounts + sync, create a free project at https://supabase.com,
 * run supabase/schema.sql in its SQL editor, then paste the values from
 * Project Settings → API here. The "anon" key is meant to be public — access to
 * each person's contacts is enforced by the database's row-level security rules.
 */
window.APP_CONFIG = {
  supabaseUrl: '',      // e.g. 'https://abcdefghijkl.supabase.co'
  supabaseAnonKey: '',  // the long "anon public" key
};
