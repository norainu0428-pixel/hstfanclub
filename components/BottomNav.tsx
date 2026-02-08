'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', icon: '🏠', label: 'ホーム' },
  { href: '/adventure', icon: '🗺️', label: '冒険' },
  { href: '/party', icon: '🎭', label: 'パーティ' },
  { href: '/games', icon: '🎮', label: 'ゲーム' },
  { href: '/missions', icon: '📋', label: 'その他' },
];

const HIDE_PATHS = ['/auth', '/admin', '/adventure/battle', '/pvp/battle', '/pvp/matchmaking'];

export default function BottomNav() {
  const pathname = usePathname();
  const hide = HIDE_PATHS.some(p => pathname?.startsWith(p));
  if (hide) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-md border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex justify-around items-center h-16">
        {ITEMS.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-2 min-w-0 transition ${
                isActive ? 'text-orange-500' : 'text-gray-400 hover:text-white'
              }`}
            >
              <span className="text-2xl mb-1">{item.icon}</span>
              <span className="text-xs font-medium truncate max-w-full px-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
