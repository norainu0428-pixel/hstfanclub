'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { getRarityLabel } from '@/utils/rarity';

interface UserMember {
  id: string;
  user_id: string;
  member_name: string;
  member_emoji: string;
  rarity: string;
  level: number;
  experience: number;
  hp: number;
  max_hp: number;
  attack: number;
  defense: number;
  speed: number;
  user_name?: string;
}

export default function MembersManagement() {
  const [members, setMembers] = useState<UserMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAdminAndLoadMembers();
  }, []);

  async function checkAdminAndLoadMembers() {
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
    await loadMembers();
    setLoading(false);
  }

  async function loadMembers() {
    const { data: membersData } = await supabase
      .from('user_members')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (membersData) {
      // ユーザー名を取得
      const userIds = [...new Set(membersData.map(m => m.user_id))];
      const { data: usersData } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const userMap = new Map(usersData?.map(u => [u.user_id, u.display_name]));

      const membersWithNames = membersData.map(member => ({
        ...member,
        user_name: userMap.get(member.user_id) || '不明'
      }));

      setMembers(membersWithNames);
    }
  }

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
        <h1 className="text-3xl font-bold mb-8">メンバー管理</h1>

        <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
          <p className="text-gray-600">
            ユーザーが所持しているメンバーの一覧です。
            <br />
            メンバーの編集・削除機能は今後実装予定です。
          </p>
        </div>

        {/* メンバーテーブル */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">メンバー</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">所有者</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">レアリティ</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">レベル</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">HP</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">ATK</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">DEF</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">SPD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                      メンバーが登録されていません
                    </td>
                  </tr>
                ) : (
                  members.map(member => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{member.member_emoji}</span>
                          <span className="font-bold">{member.member_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{member.user_name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-bold">
                          {getRarityLabel(member.rarity)}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold">Lv.{member.level}</td>
                      <td className="px-6 py-4">{member.hp}/{member.max_hp}</td>
                      <td className="px-6 py-4">{member.attack}</td>
                      <td className="px-6 py-4">{member.defense}</td>
                      <td className="px-6 py-4">{member.speed}</td>
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
