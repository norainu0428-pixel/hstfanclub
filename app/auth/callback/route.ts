import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  // OAuthエラー（Discord拒否等）
  if (error) {
    const message = errorDescription || error;
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(message)}`, request.url)
    );
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: Record<string, unknown>) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: Record<string, unknown>) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return NextResponse.redirect(
        new URL(`/?auth_error=${encodeURIComponent(exchangeError.message)}`, request.url)
      );
    }
  }

  return NextResponse.redirect(new URL('/', request.url));
}
