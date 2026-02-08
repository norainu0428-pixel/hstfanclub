'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';

interface BattleLog {
  id: string;
  user_id: string;
  stage: number;
  result: string;
  turns_taken: number;
  experience_gained: number;
  points_earned: number;
  created_at: string;
  user_name?: string;
}

export default function BattlesLog() {
  const [battles, setBattles] = useState<BattleLog[]>([]);
  const [stats, setStats] = useState({
    totalBattles: 0,
    victories: 0,
    defeats: 0,
    winRate: 0
  });
  const [filterStage, setFilterStage] = useState<number | 'all'>('all');
  const [filterResult, setFilterResult] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAdminAndLoadBattles();
  }, []);

  async function checkAdminAndLoadBattles() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'owner') {
      router.push('/');
      return;
    }

    setIsAdmin(true);
    await loadBattles();
    setLoading(false);
  }

  async function loadBattles() {
    let query = supabase
      .from('battle_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    const { data } = await query;

    if (data) {
      // ユーザー名を取得
      const userIds = [...new Set(data.map(b => b.user_id))];
      const { data: usersData } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const userMap = new Map(usersData?.map(u => [u.user_id, u.display_name]));

      const battlesWithNames = data.map(battle => ({
        ...battle,
        user_name: userMap.get(battle.user_id) || '不明'
      }));

      setBattles(battlesWithNames);

      // 統計計算
      const victories = data.filter(b => b.result === 'victory').length;
      const defeats = data.filter(b => b.result === 'defeat').length;
      const total = data.length;

      setStats({
        totalBattles: total,
        victories,
        defeats,
        winRate: total > 0 ? Math.round((victories / total) * 100) : 0
      });
    }
  }

  const filteredBattles = battles.filter(battle => {
    if (filterStage !== 'all' && battle.stage !== filterStage) return false;
    if (filterResult !== 'all' && battle.result !== filterResult) return false;
    return true;
  });

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-12">読み込み中...</div>
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <AdminLayout>
      <div>
        <h1 className="text-3xl font-bold mb-8">バトルログ</h1>

        {/* 統計 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="text-gray-900 mb-1">総バトル数</div>
            <div className="text-3xl font-bold">{stats.totalBattles}</div>
          </div>
          <div className="bg-green-50 rounded-xl p-6 shadow-lg">
            <div className="text-green-600 mb-1">勝利</div>
            <div className="text-3xl font-bold text-green-600">{stats.victories}</div>
          </div>
          <div className="bg-red-50 rounded-xl p-6 shadow-lg">
            <div className="text-red-600 mb-1">敗北</div>
            <div className="text-3xl font-bold text-red-600">{stats.defeats}</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-6 shadow-lg">
            <div className="text-blue-600 mb-1">勝率</div>
            <div className="text-3xl font-bold text-blue-600">{stats.winRate}%</div>
          </div>
        </div>

        {/* フィルター */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-2">ステージ</label>
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="all">すべて</option>
                {[1, 2, 3, 4, 5].map(stage => (
                  <option key={stage} value={stage}>ステージ {stage}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">結果</label>
              <select
                value={filterResult}
                onChange={(e) => setFilterResult(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="all">すべて</option>
                <option value="victory">勝利のみ</option>
                <option value="defeat">敗北のみ</option>
              </select>
            </div>
          </div>
        </div>

        {/* バトルログテーブル */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">日時</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">ユーザー</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">ステージ</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">結果</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">ターン数</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">経験値</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">ポイント</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBattles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-900">
                      バトルログがありません
                    </td>
                  </tr>
                ) : (
                  filteredBattles.map(battle => (
                    <tr key={battle.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(battle.created_at).toLocaleString('ja-JP')}
                      </td>
                      <td className="px-6 py-4 font-medium">{battle.user_name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-bold">
                          ステージ {battle.stage}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          battle.result === 'victory'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {battle.result === 'victory' ? '勝利' : '敗北'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-900">{battle.turns_taken}</td>
                      <td className="px-6 py-4 text-blue-600 font-bold">+{battle.experience_gained}</td>
                      <td className="px-6 py-4 text-green-600 font-bold">+{battle.points_earned}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
