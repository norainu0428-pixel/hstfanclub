'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import StatsCard from '@/components/admin/StatsCard';
import { AdminStats } from '@/types/admin';

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    freeUsers: 0,
    basicUsers: 0,
    premiumUsers: 0,
    totalPoints: 0,
    totalBattles: 0,
    activeUsers: 0
  });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAdminAndLoadStats();
  }, []);

  async function checkAdminAndLoadStats() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/');
      return;
    }

    // 管理者チェック（ownerのみ）
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
    await loadStats();
    setLoading(false);
  }

  async function loadStats() {
    // 総ユーザー数
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // 会員ランク別（roleベースで判定）
    const { count: memberUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'member');

    const { count: premiumUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'premium');

    // 総ポイント数
    const { data: pointsData } = await supabase
      .from('profiles')
      .select('points');
    const totalPoints = pointsData?.reduce((sum, p) => sum + (p.points || 0), 0) || 0;

    // 総バトル数
    const { count: totalBattles } = await supabase
      .from('battle_logs')
      .select('*', { count: 'exact', head: true });

    // アクティブユーザー（7日以内に更新）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: activeUsersData } = await supabase
      .from('profiles')
      .select('user_id')
      .gte('created_at', sevenDaysAgo.toISOString());

    setStats({
      totalUsers: totalUsers || 0,
      freeUsers: memberUsers || 0,
      basicUsers: 0, // 基本会員は現在未使用
      premiumUsers: premiumUsers || 0,
      totalPoints,
      totalBattles: totalBattles || 0,
      activeUsers: activeUsersData?.length || 0
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">読み込み中...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <AdminLayout>
      <div>
        <h1 className="text-3xl font-bold mb-8">ダッシュボード</h1>

        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="総ユーザー数"
            value={stats.totalUsers}
            icon="👥"
            color="blue"
          />
          <StatsCard
            title="プレミアム会員"
            value={stats.premiumUsers}
            icon="💎"
            color="purple"
          />
          <StatsCard
            title="総ポイント発行数"
            value={stats.totalPoints.toLocaleString()}
            icon="💰"
            color="green"
          />
          <StatsCard
            title="アクティブユーザー"
            value={stats.activeUsers}
            icon="🔥"
            color="orange"
          />
        </div>

        {/* 会員ランク別 */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-8">
          <h2 className="text-xl font-bold mb-4">会員ランク別人数</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-100 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-gray-900">{stats.freeUsers}</div>
              <div className="text-gray-900 mt-1">メンバー</div>
            </div>
            <div className="bg-purple-100 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-purple-600">{stats.premiumUsers}</div>
              <div className="text-purple-500 mt-1">プレミアム会員</div>
            </div>
          </div>
        </div>

        {/* バトル統計 */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-bold mb-4">ゲーム統計</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-gray-900 mb-1">総バトル数</div>
              <div className="text-3xl font-bold text-red-600">{stats.totalBattles}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-gray-900 mb-1">平均バトル数/人</div>
              <div className="text-3xl font-bold text-green-600">
                {stats.totalUsers > 0 ? Math.round(stats.totalBattles / stats.totalUsers) : 0}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
