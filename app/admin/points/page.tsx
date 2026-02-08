'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { UserWithProfile } from '@/types/admin';

export default function PointsManagement() {
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [pointAmount, setPointAmount] = useState<number>(0);
  const [reason, setReason] = useState<string>('');
  const [bulkRole, setBulkRole] = useState<string>('all');
  const [bulkAmount, setBulkAmount] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAdminAndLoadUsers();
  }, []);

  async function checkAdminAndLoadUsers() {
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
    await loadUsers();
  }

  async function loadUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('display_name');

    if (data) {
      setUsers(data as any);
    }
  }

  async function givePoints() {
    if (!selectedUser || pointAmount === 0) {
      alert('ユーザーとポイント数を入力してください');
      return;
    }

    if (!reason.trim()) {
      alert('理由を入力してください');
      return;
    }

    const { data: { user: admin } } = await supabase.auth.getUser();

    // 現在のポイント取得
    const { data: userData } = await supabase
      .from('profiles')
      .select('points')
      .eq('user_id', selectedUser)
      .single();

    const newPoints = (userData?.points || 0) + pointAmount;

    // ポイント更新
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ points: newPoints })
      .eq('user_id', selectedUser);

    if (updateError) {
      alert('エラーが発生しました: ' + updateError.message);
      return;
    }

    // 履歴記録（point_historyテーブルが存在する場合）
    try {
      await supabase
        .from('point_history')
        .insert({
          user_id: selectedUser,
          amount: pointAmount,
          reason: reason,
          admin_id: admin?.id || null
        });
    } catch (error) {
      // point_historyテーブルが存在しない場合はスキップ
      console.log('point_historyテーブルが存在しないためスキップ');
    }

    alert(`${pointAmount}ポイントを付与しました`);
    setPointAmount(0);
    setReason('');
    loadUsers();
  }

  async function bulkGivePoints() {
    if (bulkAmount === 0) {
      alert('ポイント数を入力してください');
      return;
    }

    const roleLabel = bulkRole === 'all' ? '全ユーザー' : bulkRole;
    const confirmed = confirm(
      `${roleLabel}に${bulkAmount}ポイントを付与しますか？`
    );
    if (!confirmed) return;

    const { data: { user: admin } } = await supabase.auth.getUser();

    let targetUsers = users;
    if (bulkRole !== 'all') {
      targetUsers = users.filter(u => u.role === bulkRole);
    }

    for (const user of targetUsers) {
      const newPoints = (user.points || 0) + bulkAmount;

      await supabase
        .from('profiles')
        .update({ points: newPoints })
        .eq('user_id', user.user_id);

      // 履歴記録（point_historyテーブルが存在する場合）
      try {
        await supabase
          .from('point_history')
          .insert({
            user_id: user.user_id,
            amount: bulkAmount,
            reason: `一括付与（${bulkRole}）`,
            admin_id: admin?.id || null
          });
      } catch (error) {
        // スキップ
      }
    }

    alert(`${targetUsers.length}人に${bulkAmount}ポイントを付与しました`);
    setBulkAmount(0);
    loadUsers();
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="text-gray-900">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">ポイント管理</h1>

        {/* 個別付与 */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-6 text-gray-900">
          <h2 className="text-xl font-bold mb-4 text-gray-900">個別ポイント付与</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-900">ユーザー選択</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white"
              >
                <option value="">選択してください</option>
                {users.map(user => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.display_name || '名前なし'} ({user.points || 0}pt)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-900">ポイント数（マイナス可）</label>
              <input
                type="number"
                value={pointAmount}
                onChange={(e) => setPointAmount(parseInt(e.target.value) || 0)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white"
                placeholder="100"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-900">理由</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white placeholder-gray-600"
                placeholder="例: イベント参加報酬"
              />
            </div>
            <button
              onClick={givePoints}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:opacity-90"
            >
              ポイント付与
            </button>
          </div>
        </div>

        {/* 一括付与 */}
        <div className="bg-white rounded-xl p-6 shadow-lg text-gray-900">
          <h2 className="text-xl font-bold mb-4 text-gray-900">一括ポイント付与</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-900">対象</label>
              <select
                value={bulkRole}
                onChange={(e) => setBulkRole(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white"
              >
                <option value="all">全ユーザー</option>
                <option value="member">メンバーのみ</option>
                <option value="premium">プレミアム会員のみ</option>
                <option value="staff">スタッフのみ</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-900">ポイント数</label>
              <input
                type="number"
                value={bulkAmount}
                onChange={(e) => setBulkAmount(parseInt(e.target.value) || 0)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white"
                placeholder="100"
              />
            </div>
            <button
              onClick={bulkGivePoints}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-lg font-bold hover:opacity-90"
            >
              一括付与実行
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
