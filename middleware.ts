import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // メンテナンスページ・認証コールバック・静的ファイルはスキップ
  if (pathname === '/maintenance' || pathname.startsWith('/auth/')) {
    return NextResponse.next({ request: { headers: request.headers } });
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // セッションを更新
  const { data: { user } } = await supabase.auth.getUser();

  // メンテナンスモードチェック
  const { data: maintenance, error: maintenanceError } = await supabase
    .from('maintenance_mode')
    .select('enabled')
    .eq('id', 1)
    .single();

  if (!maintenanceError && maintenance?.enabled) {
      // オーナー・スタッフはアクセス許可
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (profile?.role === 'owner' || profile?.role === 'staff') {
          return response;
        }
      }
      return NextResponse.redirect(new URL('/maintenance', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
