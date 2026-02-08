'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { name: 'ダッシュボード', path: '/admin', icon: '📊' },
    { name: 'ユーザー管理', path: '/admin/users', icon: '👥' },
    { name: 'ポイント管理', path: '/admin/points', icon: '💰' },
    { name: 'メンバー管理', path: '/admin/members', icon: '🎴' },
    { name: 'バトルログ', path: '/admin/battles', icon: '⚔️' },
    { name: 'システム設定', path: '/admin/settings', icon: '⚙️' },
    { name: 'お知らせ', path: '/admin/announcements', icon: '📢' },
    { name: 'HST配布', path: '/admin/distribute-hst', icon: '😊' }
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* サイドバー */}
      <div className="fixed left-0 top-0 h-full w-64 bg-gray-900 text-white">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-8">🛠️ 管理画面</h1>
          <nav className="space-y-2">
            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`w-full text-left px-4 py-3 rounded-lg transition ${
                  pathname === item.path
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                {item.name}
              </button>
            ))}
          </nav>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-800">
          <button
            onClick={() => router.push('/')}
            className="w-full px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
          >
            トップに戻る
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="ml-64 p-8">
        {children}
      </div>
    </div>
  );
}
