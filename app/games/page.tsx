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
    <div className="min-h-screen p-8 bg-black text-white">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-orange-500">ゲームで遊ぶ</h1>
          <p className="text-gray-300">好きなゲームを選んでください</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game) => (
            <div
              key={game.id}
              className={`bg-gray-900 border border-orange-500/30 rounded-lg p-6 ${
                game.available 
                  ? 'cursor-pointer hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/20 transition-all' 
                  : 'opacity-50 cursor-not-allowed'
              }`}
              onClick={() => {
                if (game.available) {
                  router.push(`/games/${game.id}`);
                }
              }}
            >
              <div className="text-5xl mb-4">{game.icon}</div>
              <h2 className="text-xl font-bold mb-2 text-white">{game.title}</h2>
              <p className="text-gray-300 mb-3">{game.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">難易度: {game.difficulty}</span>
                {!game.available && (
                  <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded border border-gray-700">
                    準備中
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* パーティーモード */}
          <div
            className="bg-gradient-to-br from-amber-500 to-orange-600 border border-amber-400 rounded-lg p-6 cursor-pointer hover:shadow-lg hover:shadow-amber-500/30 transition-all text-white"
            onClick={() => router.push('/party')}
          >
            <div className="text-5xl mb-4">🎪</div>
            <h2 className="text-xl font-bold mb-2">パーティーモード</h2>
            <p className="text-white/90 mb-3">冒険とは別の専用ステージでパーティー編成を試そう！</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">10ステージ</span>
              <span className="text-xs bg-white/20 px-2 py-1 rounded">利用可能</span>
            </div>
          </div>

          {/* PvP対戦 */}
          <div
            className="bg-gradient-to-br from-purple-500 to-pink-600 border border-purple-400 rounded-lg p-6 cursor-pointer hover:shadow-lg hover:shadow-purple-500/30 transition-all text-white"
            onClick={() => router.push('/pvp/matchmaking')}
          >
            <div className="text-5xl mb-4">⚔️</div>
            <h2 className="text-xl font-bold mb-2">PvP対戦</h2>
            <p className="text-white/90 mb-3">フレンドや他プレイヤーと対戦しよう！</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">マッチング</span>
              <span className="text-xs bg-white/20 px-2 py-1 rounded">利用可能</span>
            </div>
          </div>

          {/* 装備 */}
          <div
            className="bg-gradient-to-br from-indigo-500 to-purple-600 border border-indigo-400 rounded-lg p-6 cursor-pointer hover:shadow-lg hover:shadow-indigo-500/30 transition-all text-white"
            onClick={() => router.push('/equipment')}
          >
            <div className="text-5xl mb-4">🛡️</div>
            <h2 className="text-xl font-bold mb-2">装備</h2>
            <p className="text-white/90 mb-3">装備・ガチャ・合成でメンバーを強化</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">装備ガチャ 1000pt</span>
              <span className="text-xs bg-white/20 px-2 py-1 rounded">利用可能</span>
            </div>
          </div>

          {/* ランキング */}
          <div
            className="bg-gradient-to-br from-yellow-500 to-orange-600 border border-yellow-400 rounded-lg p-6 cursor-pointer hover:shadow-lg hover:shadow-yellow-500/30 transition-all text-white"
            onClick={() => router.push('/ranking')}
          >
            <div className="text-5xl mb-4">🏆</div>
            <h2 className="text-xl font-bold mb-2">ランキング</h2>
            <p className="text-white/90 mb-3">PvPレーティング Top 100</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">順位を確認</span>
              <span className="text-xs bg-white/20 px-2 py-1 rounded">利用可能</span>
            </div>
          </div>

          {/* 通常ガチャカード（全ユーザー利用可能） */}
          <div
            className="bg-gradient-to-br from-orange-500 to-orange-600 border border-orange-400 rounded-lg p-6 cursor-pointer hover:shadow-lg hover:shadow-orange-500/30 transition-all text-white"
            onClick={() => router.push('/basic/gacha')}
          >
            <div className="text-5xl mb-4">🎲</div>
            <h2 className="text-xl font-bold mb-2">通常ガチャ</h2>
            <p className="text-white/90 mb-3">メンバーを引いてコレクションを増やそう！</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">単発: 30pt / 10連: 270pt</span>
              <span className="text-xs bg-white/20 px-2 py-1 rounded">利用可能</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push('/')}
          className="mt-8 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors border border-gray-700"
        >
          トップに戻る
        </button>
      </div>
    </div>
  );
}
