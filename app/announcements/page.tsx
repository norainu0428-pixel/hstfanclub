'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Announcement {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export default function AnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        router.replace('/');
        return;
      }
      await load();
      setLoading(false);
    })();
  }, [router]);

  async function load() {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setList((data as Announcement[]) || []);
  }

  return (
    <div className="min-h-screen p-8 bg-black text-white">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-orange-500">📢 お知らせ</h1>
          <Link
            href="/"
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 border border-gray-700"
          >
            トップへ戻る
          </Link>
        </div>

        {loading ? (
          <p className="text-orange-500">読み込み中...</p>
        ) : list.length === 0 ? (
          <div className="border border-orange-500/30 bg-gray-900 p-6 rounded-lg">
            <p className="text-gray-400">お知らせはまだありません。</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {list.map((a) => (
              <li
                key={a.id}
                className="border border-orange-500/30 bg-gray-900 p-5 rounded-lg shadow-lg shadow-orange-500/10"
              >
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold text-orange-500">{a.title}</h2>
                  {a.is_pinned && (
                    <span className="text-xs bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded">固定</span>
                  )}
                </div>
                <p className="text-gray-300 whitespace-pre-wrap">{a.body}</p>
                <p className="text-sm text-gray-500 mt-3">
                  {new Date(a.created_at).toLocaleString('ja-JP')}
                  {a.updated_at !== a.created_at && (
                    <span>（更新: {new Date(a.updated_at).toLocaleString('ja-JP')}）</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
