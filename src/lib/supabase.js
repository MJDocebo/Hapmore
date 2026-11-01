import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export const USERNAME_DOMAIN = import.meta.env.VITE_USERNAME_DOMAIN || 'hapmore.app';

/** Usernames map to Supabase Auth emails: "michael" -> "michael@hapmore.app". */
export function usernameToEmail(username) {
  const u = username.trim().toLowerCase();
  return u.includes('@') ? u : `${u}@${USERNAME_DOMAIN}`;
}

export function emailToUsername(email) {
  if (!email) return '';
  const suffix = `@${USERNAME_DOMAIN}`;
  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : email;
}
