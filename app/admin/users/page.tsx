'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { UserWithProfile } from '@/types/admin';

export default function UsersManagement() {
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAdminAndLoadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, filterRole, users]);

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
    setLoading(false);
  }

  async function loadUsers() {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesData) {
      setUsers(profilesData as any);
      setFilteredUsers(profilesData as any);
    }
  }

  function filterUsers() {
    let filtered = users;

    // 検索フィルター
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // ロールフィルター
    if (filterRole !== 'all') {
      filtered = filtered.filter(user => user.role === filterRole);
    }

    setFilteredUsers(filtered);
  }

  async function updateRole(userId: string, newRole: string) {
    if (newRole === 'owner') {
      alert('ownerロールは変更できません');
      return;
    }

    const confirmed = confirm(`ロールを ${newRole} に変更しますか？`);
    if (!confirmed) return;

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('user_id', userId);

    if (error) {
      alert('エラーが発生しました');
      return;
    }

    alert('ロールを変更しました');
    loadUsers();
  }

  const getRoleBadge = (role: string) => {
    const badges = {
      owner: 'bg-red-100 text-red-700',
      staff: 'bg-orange-100 text-orange-700',
      premium: 'bg-purple-100 text-purple-700',
      member: 'bg-gray-100 text-gray-700'
    };
    const labels = {
      owner: 'オーナー',
      staff: 'スタッフ',
      premium: 'プレミアム',
      member: 'メンバー'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${badges[role as keyof typeof badges] || badges.member}`}>
        {labels[role as keyof typeof labels] || role}
      </span>
    );
  };

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
        <h1 className="text-3xl font-bold mb-8">ユーザー管理</h1>

        {/* 検索・フィルター */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-2">検索</label>
              <input
                type="text"
                placeholder="ユーザー名で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">ロール</label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="all">すべて</option>
                <option value="owner">オーナー</option>
                <option value="staff">スタッフ</option>
                <option value="premium">プレミアム</option>
                <option value="member">メンバー</option>
              </select>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            {filteredUsers.length}人 / 全{users.length}人
          </div>
        </div>

        {/* ユーザーテーブル */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">ユーザー名</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">ロール</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">ポイント</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map(user => (
                  <tr key={user.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-bold">{user.display_name || '名前なし'}</div>
                      <div className="text-xs text-gray-500">{user.user_id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-green-600">{user.points || 0} pt</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <select
                          value={user.role}
                          onChange={(e) => updateRole(user.user_id, e.target.value)}
                          className="text-xs border rounded px-2 py-1"
                          disabled={user.role === 'owner'}
                        >
                          <option value="member">メンバー</option>
                          <option value="premium">プレミアム</option>
                          <option value="staff">スタッフ</option>
                          <option value="owner">オーナー</option>
                        </select>
                        <button
                          onClick={() => router.push(`/admin/users/${user.user_id}`)}
                          className="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          詳細
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
