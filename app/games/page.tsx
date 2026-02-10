'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function GamesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('membership_tier')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setProfile(data);
    }
  }

  const games = [
    {
      id: 'timing',
      title: 'タイミングゲーム',
      description: '動く的をクリック！',
      icon: '🎯',
      difficulty: '⭐⭐☆',
      available: false, // 未実装
    },
    {
      id: 'memory',
      title: '記憶ゲーム',
      description: '光る順番を覚えて再現！',
      icon: '🧠',
      difficulty: '⭐⭐⭐',
      available: false, // 未実装
    },
  ];

  return (
    <div className="min-h-screen px-4 py-6 bg-black text-white">
      <div className="max-w-lg mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-orange-500">ゲームで遊ぶ</h1>
          <p className="text-gray-400 text-sm mt-1">好きなゲームを選んでください</p>
        </header>

        <div className="grid grid-cols-2 gap-3">
          {games.map((game) => (
            <div
              key={game.id}
              className={`rounded-2xl p-4 border border-white/10 bg-white/5 backdrop-blur-sm ${
                game.available 
                  ? 'cursor-pointer active:scale-[0.98] transition' 
                  : 'opacity-50 cursor-not-allowed'
              }`}
              onClick={() => {
                if (game.available) {
                  router.push(`/games/${game.id}`);
                }
              }}
            >
              <div className="text-3xl mb-2">{game.icon}</div>
              <h2 className="font-bold text-white text-sm">{game.title}</h2>
              <p className="text-gray-400 text-xs mt-1 line-clamp-2">{game.description}</p>
              {!game.available && (
                <span className="text-xs text-gray-900 mt-2 block">準備中</span>
              )}
            </div>
          ))}

          {/* パーティーモード */}
          <div
            className="rounded-2xl p-4 bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold text-left shadow-lg active:scale-[0.98] transition cursor-pointer"
            onClick={() => router.push('/party')}
          >
            <span className="text-3xl block mb-1">🎪</span>
            <span className="text-sm">パーティー</span>
          </div>

          {/* PvP対戦 */}
          <div
            className="rounded-2xl p-4 bg-gradient-to-br from-purple-500 to-pink-600 text-white font-bold text-left shadow-lg active:scale-[0.98] transition cursor-pointer"
            onClick={() => router.push('/pvp/matchmaking')}
          >
            <span className="text-3xl block mb-1">⚔️</span>
            <span className="text-sm">PvP</span>
          </div>

          {/* 装備機能はバグ多発のため廃止 */}

          {/* ランキング */}
          <div
            className="rounded-2xl p-4 bg-gradient-to-br from-yellow-500 to-amber-600 text-white font-bold text-left shadow-lg active:scale-[0.98] transition cursor-pointer"
            onClick={() => router.push('/ranking')}
          >
            <span className="text-3xl block mb-1">🏆</span>
            <span className="text-sm">ランキング</span>
          </div>

          {/* 通常ガチャ */}
          <div
            className="rounded-2xl p-4 bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold text-left shadow-lg active:scale-[0.98] transition cursor-pointer"
            onClick={() => router.push('/basic/gacha')}
          >
            <span className="text-3xl block mb-1">🎲</span>
            <span className="text-sm">ガチャ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
