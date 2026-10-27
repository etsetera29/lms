import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
// Local bootstrap tool. Keep all variables private and never commit .env.local.
if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g,'');
  }
}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
const password=process.env.ADMIN_PASSWORD;
if (!url||!secret||!password) throw Error('Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD in .env.local');
if (password.length < 8) throw Error('Admin password must be at least 8 characters');
const api=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
const email='admin@fcpc-lms.local';
const {data, error}=await api.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Course Administrator'}});
if (error) throw Error(`Admin creation failed (possibly an existing account): ${error.message}. Resolve this first; do not promote an untrusted account.`);
const {error:roleError}=await api.from('profiles').update({role:'admin',full_name:'Course Administrator'}).eq('id',data.user.id);
if (roleError) { await api.auth.admin.deleteUser(data.user.id); throw Error(`Admin role setup failed: ${roleError.message}`); }
console.log('Admin account created. Sign in with username admin and your ADMIN_PASSWORD.');
