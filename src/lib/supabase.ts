import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let singleton: SupabaseClient | null = null;
export const configReady = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export const ADMIN_LOGIN_EMAIL = 'admin@fcpc-lms.local';
export function db() {
  if (!singleton) {
    if (!configReady) throw new Error('Configure Supabase environment variables first.');
    singleton = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
  return singleton;
}
export const ago = (date?: string | null) => date ? new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric'}) : 'No deadline';
export const isNew = (date?: string | null) => !!date && Date.now() - new Date(date).getTime() < 7*86400000;
export const prettyError = (e: any) => e?.message || 'Something went wrong.';
export const slugFromName = (name:string) => name.toLowerCase().replace(/[^a-z0-9]/g, '_');
export const percent = (earned:number, total:number) => total ? Math.round(100*earned/total) : null;
export function fileSuffix(f:File) { return f.name.split('.').pop()?.toLowerCase() || ''; }
export function makePath(prefix:string, file:File) { return `${prefix}/${crypto.randomUUID()}.${fileSuffix(file)}`; }
export const lessonAllowed = ['pdf','pptx'];
export const submissionAllowed = ['pdf','docx','pptx','txt','png','jpg','jpeg','zip'];
export function ensureFile(file:File, allowed:string[]) {
  if (!file || file.size <= 0) throw new Error('Select a non-empty file.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Each file must be 15 MB or smaller to preserve free storage.');
  if (!allowed.includes(fileSuffix(file))) throw new Error(`Supported file types: ${allowed.join(', ')}`);
}
