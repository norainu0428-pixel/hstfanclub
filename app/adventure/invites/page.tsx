'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 冒険招待は廃止。パーティーモードの招待のみ利用可能。
 * このページにアクセスした場合は冒険ページへリダイレクト。
 */
export default function AdventureInvitesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/adventure');
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-slate-400">冒険にリダイレクト中...</p>
    </div>
  );
}
