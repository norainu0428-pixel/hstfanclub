import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) {
    console.warn('[Supabase] NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください（Vercel: Settings → Environment Variables）');
  }
  return createBrowserClient(url || 'https://placeholder.supabase.co', key || 'placeholder-key');
}
