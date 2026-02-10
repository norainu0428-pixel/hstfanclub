'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { UserWithProfile } from '@/types/admin';

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.id as string;
  const router = useRouter();
  const [user, setUser] = useState<UserWithProfile | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAndLoadUser();
  }, [userId]);

  async function checkAdminAndLoadUser() {
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    
    if (!adminUser) {
      router.push('/');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', adminUser.id)
      .single();

    if (profile?.role !== 'owner') {
      router.push('/');
      return;
    }

    setIsAdmin(true);
    await loadUser();
    setLoading(false);
  }

  async function loadUser() {
    // ユーザー情報取得
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (userError) {
      console.error('ユーザー情報取得エラー:', userError);
      return;
    }

    if (userData) {
      setUser(userData as UserWithProfile);
    }

    // メンバー情報取得
    const { data: membersData } = await supabase
      .from('user_members')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (membersData) {
      setMembers(membersData);
    }
  }

  async function updatePoints(newPoints: number) {
    const confirmed = confirm(`ポイントを ${newPoints} に設定しますか？`);
    if (!confirmed) return;

    const { error } = await supabase
      .from('profiles')
      .update({ points: newPoints })
      .eq('user_id', userId);

    if (error) {
      alert('エラーが発生しました');
      return;
    }

    alert('ポイントを更新しました');
    loadUser();
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-12">読み込み中...</div>
      </AdminLayout>
    );
  }

  if (!isAdmin || !user) {
    return null;
  }

  return (
    <AdminLayout>
      <div>
        <button
          onClick={() => router.push('/admin/users')}
          className="mb-4 text-blue-600 hover:text-blue-800"
        >
          ← ユーザー一覧に戻る
        </button>

        <h1 className="text-3xl font-bold mb-8">ユーザー詳細</h1>

        {/* ユーザー情報 */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-bold mb-4">基本情報</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-1">ユーザー名</label>
              <div className="text-lg font-bold">{user.display_name || '名前なし'}</div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-1">ユーザーID</label>
              <div className="text-sm font-mono text-gray-900">{user.user_id}</div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-1">ロール</label>
              <div className="text-lg">{user.role}</div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-1">ポイント</label>
              <div className="text-lg font-bold text-green-600">{user.points || 0} pt</div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-1">登録日</label>
              <div className="text-sm">{new Date(user.created_at).toLocaleString('ja-JP')}</div>
            </div>
          </div>
        </div>

        {/* ポイント編集 */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-bold mb-4">ポイント編集</h2>
          <div className="flex gap-4">
            <input
              type="number"
              defaultValue={user.points || 0}
              id="pointsInput"
              className="border-2 border-gray-300 rounded-lg px-4 py-2"
              placeholder="ポイント数"
            />
            <button
              onClick={() => {
                const input = document.getElementById('pointsInput') as HTMLInputElement;
                const newPoints = parseInt(input.value) || 0;
                updatePoints(newPoints);
              }}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
            >
              ポイント更新
            </button>
          </div>
        </div>

        {/* 経験値アップコース（レベルアップステージ）残り回数 */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-bold mb-4">経験値アップコース 残り回数</h2>
          <p className="text-sm text-gray-600 mb-3">
            基本は1日5回まで。ここで設定した「ボーナス回数」が毎日加算され、実質の残り回数になります（例: 10にすると1日15回まで挑戦可能）。
          </p>
          <div className="flex gap-4 items-center">
            <label htmlFor="bonusPlaysInput" className="font-bold text-gray-900">ボーナス回数</label>
            <input
              type="number"
              id="bonusPlaysInput"
              min={0}
              defaultValue={user.level_training_bonus_plays ?? 0}
              className="border-2 border-gray-300 rounded-lg px-4 py-2 w-24"
            />
            <button
              onClick={async () => {
                const input = document.getElementById('bonusPlaysInput') as HTMLInputElement;
                const value = Math.max(0, parseInt(input.value, 10) || 0);
                const { error } = await supabase
                  .from('profiles')
                  .update({ level_training_bonus_plays: value })
                  .eq('user_id', userId);
                if (error) {
                  alert('更新に失敗しました: ' + error.message);
                  return;
                }
                alert('経験値アップコースのボーナス回数を更新しました。');
                loadUser();
              }}
              className="bg-indigo-500 text-white px-6 py-2 rounded-lg hover:bg-indigo-600"
            >
              ボーナス回数を更新
            </button>
          </div>
        </div>

        {/* 所持メンバー */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-bold mb-4">所持メンバー ({members.length}体)</h2>
          {members.length === 0 ? (
            <p className="text-gray-900">メンバーを所持していません</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map(member => (
                <div key={member.id} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{member.member_emoji}</span>
                    <div>
                      <div className="font-bold">{member.member_name}</div>
                      <div className="text-xs text-gray-900">Lv.{member.level}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-900">
                    HP: {member.hp}/{member.max_hp} | ATK: {member.attack} | DEF: {member.defense}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
