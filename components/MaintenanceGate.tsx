'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [isMaintenance, setIsMaintenance] = useState<boolean | null>(null);
  const [canBypass, setCanBypass] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        const { data: settings } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .maybeSingle();

        const enabled = settings?.value && typeof settings.value === 'object' && 'enabled' in settings.value
          ? Boolean((settings.value as { enabled?: boolean }).enabled)
          : false;

        setIsMaintenance(enabled);

        if (enabled) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            setCanBypass(false);
            setChecking(false);
            return;
          }
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .single();
          setCanBypass(profile?.role === 'owner' || profile?.role === 'staff');
        } else {
          setCanBypass(true);
        }
      } catch {
        setIsMaintenance(false);
        setCanBypass(true);
      } finally {
        setChecking(false);
      }
    }
    check();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-orange-500">読み込み中...</p>
      </div>
    );
  }

  if (isMaintenance && !canBypass) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-8">
        <div className="text-8xl mb-6">🔧</div>
        <h1 className="text-4xl font-bold mb-4">メンテナンス中</h1>
        <p className="text-gray-400 text-center max-w-md mb-8">
          只今メンテナンス中です。作業完了までしばらくお待ちください。
        </p>
        <p className="text-gray-500 text-sm">ご不便をおかけして申し訳ございません。</p>
      </div>
    );
  }

  return <>{children}</>;
}
