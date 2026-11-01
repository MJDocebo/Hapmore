#!/usr/bin/env node
// Create a str(notes) login (there is no public sign-up).
//
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/create-user.mjs <username> <password>
//
// The service-role key bypasses RLS — keep it on your machine, never put it in Vercel or VITE_* variables.
import { createClient } from '@supabase/supabase-js';

const [username, password] = process.argv.slice(2);
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const domain = process.env.VITE_USERNAME_DOMAIN || 'hapmore.app';

if (!username || !password || !url || !serviceKey) {
  console.error('Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/create-user.mjs <username> <password>');
  process.exit(1);
}
if (!/^[a-z0-9._-]{2,40}$/i.test(username)) {
  console.error('Username may contain letters, numbers, dots, dashes and underscores (2–40 chars).');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Use a password of at least 8 characters.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `${username.toLowerCase()}@${domain}`;
const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username } });
if (error) {
  console.error(`Failed: ${error.message}`);
  process.exit(1);
}
console.log(`Created ${username} (${email}) → ${data.user.id}`);
