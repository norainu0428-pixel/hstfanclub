'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DistributeHSTPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkOwner();
  }, []);

  async function checkOwner() {
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

    setIsOwner(true);
    setChecking(false);
    loadUsers();
  }

  async function loadUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, email, role')
        .order('display_name');

      if (error) {
        console.error('ユーザー読み込みエラー:', error);
        alert(`ユーザー読み込みエラー: ${error.message}`);
        return;
      }

      if (data) {
        console.log('読み込んだユーザー数:', data.length);
        console.log('ユーザー一覧:', data);
        setUsers(data);
      } else {
        console.warn('ユーザーデータが空です');
        setUsers([]);
      }
    } catch (error) {
      console.error('予期しないエラー:', error);
      alert('ユーザー読み込みに失敗しました');
    }
  }

  async function distributeMaxHST() {
    if (!selectedUser) {
      alert('ユーザーを選択してください');
      return;
    }

    const confirmed = confirm('レベルMAX（Lv999）のHST Smileを配布しますか？');
    if (!confirmed) return;

    setLoading(true);

    try {
      // レベル999のHST Smile作成
      const maxHST = {
        user_id: selectedUser,
        member_name: 'HST Smile',
        member_emoji: '😊',
        member_description: 'HSTesportsの笑顔を体現する最高位メンバー（レベルMAX）',
        rarity: 'HST',
        level: 999,
        experience: 0,
        max_hp: 20260,
        hp: 20260,
        current_hp: 20260,
        attack: 5070,
        defense: 4042,
        speed: 4052,
        skill_type: 'hst_power',
        skill_power: 999,
        revive_used: false
      };

      const { error } = await supabase
        .from('user_members')
        .insert(maxHST);

      if (error) throw error;

      alert('レベルMAXのHST Smileを配布しました！');
      setSelectedUser('');
    } catch (error) {
      console.error(error);
      alert('配布に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  if (!isOwner) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">👑 オーナー専用配布</h1>
          <p className="text-yellow-100">レベルMAX HST Smile配布</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-yellow-500/30">
          <h2 className="text-2xl font-bold text-white mb-6">
            😊 HST Smile Lv999 配布
          </h2>

          <div className="mb-6">
            <label className="block text-yellow-100 mb-2 font-bold">
              配布先ユーザー
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-yellow-500/30 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
            >
              <option value="" className="bg-gray-800">選択してください</option>
              {users.map(user => (
                <option key={user.user_id} value={user.user_id} className="bg-gray-800">
                  {user.display_name || '未設定'} ({user.email || 'メールなし'}){user.role === 'owner' && ' 👑 オーナー'}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-orange-900/30 rounded-lg p-6 mb-6 border border-yellow-500/50">
            <h3 className="text-xl font-bold text-yellow-200 mb-4 flex items-center gap-2">
              <span className="text-4xl">😊</span>
              HST Smile（レベルMAX）
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-yellow-100">
              <div>
                <div className="font-bold">レアリティ</div>
                <div>HST</div>
              </div>
              <div>
                <div className="font-bold">レベル</div>
                <div className="text-2xl font-bold text-yellow-300">999 MAX</div>
              </div>
              <div>
                <div className="font-bold">HP</div>
                <div>20,260</div>
              </div>
              <div>
                <div className="font-bold">攻撃力</div>
                <div>5,070</div>
              </div>
              <div>
                <div className="font-bold">防御力</div>
                <div>4,042</div>
              </div>
              <div>
                <div className="font-bold">素早さ</div>
                <div>4,052</div>
              </div>
            </div>
          </div>

          <button
            onClick={distributeMaxHST}
            disabled={loading || !selectedUser}
            className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 text-white px-8 py-4 rounded-full text-xl font-bold hover:opacity-90 disabled:opacity-50 transition shadow-lg"
          >
            {loading ? '配布中...' : '👑 レベルMAX HST Smileを配布'}
          </button>

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/admin')}
              className="text-yellow-200 hover:text-white transition"
            >
              ← 管理画面に戻る
            </button>
          </div>
        </div>

        <div className="mt-8 bg-red-900/30 rounded-lg p-6 border border-red-500/50">
          <h3 className="text-xl font-bold text-red-200 mb-2">⚠️ 注意事項</h3>
          <ul className="text-sm text-red-100 space-y-2">
            <li>• この配布はレベル999（MAX）です</li>
            <li>• 通常のイベントガチャではLv1で排出されます</li>
            <li>• オーナー専用の特別配布です</li>
            <li>• 配布は慎重に行ってください</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
