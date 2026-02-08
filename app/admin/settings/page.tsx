'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';

interface GachaRate {
  id: string;
  rarity: string;
  rate: number;
  ten_pull_rate: number;
  updated_at: string;
}

export default function SettingsPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<GachaRate[]>([]);
  const [basicRates, setBasicRates] = useState<GachaRate[]>([]);
  const router = useRouter();

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
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
    await loadRates();
    setLoading(false);
  }

  async function loadRates() {
    try {
      // プレミアム用
      const { data: premiumData } = await supabase
        .from('gacha_rates')
        .select('*')
        .order('rate', { ascending: false });

      if (premiumData) {
        setRates(premiumData);
      }

      // 通常会員用
      const { data: basicData } = await supabase
        .from('basic_gacha_rates')
        .select('*')
        .order('rate', { ascending: false });

      if (basicData) {
        setBasicRates(basicData);
      }
    } catch (error) {
      console.log('ガチャ確率テーブルが見つかりません');
    }
  }

  async function updateRate(rarity: string, field: 'rate' | 'ten_pull_rate', value: string) {
    const numValue = parseFloat(value);
    
    if (isNaN(numValue) || numValue < 0 || numValue > 100) {
      alert('0〜100の数値を入力してください');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('gacha_rates')
      .update({ 
        [field]: numValue,
        updated_by: user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('rarity', rarity);

    if (error) {
      alert('更新に失敗しました: ' + error.message);
      return;
    }

    loadRates();
  }

  async function updateBasicRate(rarity: string, field: 'rate' | 'ten_pull_rate', value: string) {
    const numValue = parseFloat(value);
    
    if (isNaN(numValue) || numValue < 0 || numValue > 100) {
      alert('0〜100の数値を入力してください');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('basic_gacha_rates')
      .update({ 
        [field]: numValue,
        updated_by: user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('rarity', rarity);

    if (error) {
      alert('更新に失敗しました: ' + error.message);
      return;
    }

    loadRates();
  }

  const getRarityLabel = (rarity: string) => {
    const labels: any = {
      'HST': '👑 HST',
      'stary': '🌠 STARY',
      'legendary': '🏆 レジェンド',
      'ultra-rare': '💎 ウルトラレア',
      'super-rare': '⭐ スーパーレア',
      'rare': '✨ レア',
      'common': '📦 コモン'
    };
    return labels[rarity] || rarity;
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
      <div className="text-gray-900">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">システム設定</h1>

        <div className="space-y-6">
          {/* お知らせ管理 */}
          <div className="bg-white rounded-xl p-6 shadow-lg text-gray-900">
            <h2 className="text-xl font-bold mb-4 text-gray-900">📢 お知らせ管理</h2>
            <p className="text-gray-700 mb-4">
              運営からのお知らせを投稿・編集できます。
            </p>
            <button
              onClick={() => router.push('/admin/announcements')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
            >
              お知らせ管理ページへ
            </button>
          </div>

          {/* メンテナンスモード */}
          <div className="bg-white rounded-xl p-6 shadow-lg text-gray-900">
            <h2 className="text-xl font-bold mb-4 text-gray-900">🔧 メンテナンスモード</h2>
            <p className="text-gray-700 mb-4">
              メンテナンスモードの設定機能は今後実装予定です。
            </p>
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                メンテナンスモードを有効にすると、一般ユーザーはサイトにアクセスできなくなります。
              </p>
            </div>
          </div>

          {/* プレミアム会員ガチャ確率調整 */}
          <div className="bg-white rounded-xl p-6 shadow-lg mb-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">🎰 プレミアム会員ガチャ確率設定</h2>
            
            {rates.length === 0 ? (
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                <div className="font-bold text-yellow-800 mb-2">⚠️ ガチャ確率テーブルが見つかりません</div>
                <div className="text-sm text-yellow-700">
                  Supabase SQL Editorでgacha_ratesテーブルを作成してください。
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                  <div className="font-bold text-yellow-800 mb-2">⚠️ 注意事項</div>
                  <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                    <li>確率の合計は必ず100%になるように調整してください</li>
                    <li>変更は即座にガチャに反映されます</li>
                    <li>0〜100の数値を入力してください</li>
                  </ul>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-gray-900">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left font-bold text-gray-900">レアリティ</th>
                        <th className="px-6 py-3 text-left font-bold text-gray-900">通常確率 (%)</th>
                        <th className="px-6 py-3 text-left font-bold text-gray-900">10連確率 (%)</th>
                        <th className="px-6 py-3 text-left font-bold text-gray-900">最終更新</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {rates.map(rate => (
                        <tr key={rate.rarity}>
                          <td className="px-6 py-4 font-bold text-gray-900">
                            {getRarityLabel(rate.rarity)}
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={rate.rate}
                              onChange={(e) => updateRate(rate.rarity, 'rate', e.target.value)}
                              className="border-2 border-gray-300 rounded-lg px-3 py-2 w-28 text-center font-bold text-gray-900 bg-white"
                            />
                            <span className="ml-2 text-gray-700">%</span>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={rate.ten_pull_rate}
                              onChange={(e) => updateRate(rate.rarity, 'ten_pull_rate', e.target.value)}
                              className="border-2 border-gray-300 rounded-lg px-3 py-2 w-28 text-center font-bold text-gray-900 bg-white"
                            />
                            <span className="ml-2 text-gray-700">%</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-800">
                            {new Date(rate.updated_at).toLocaleString('ja-JP')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-6">
                  <div className={`p-6 rounded-xl ${
                    Math.abs(rates.reduce((sum, r) => sum + parseFloat(String(r.rate)), 0) - 100) < 0.01 
                      ? 'bg-green-50 border-2 border-green-400' 
                      : 'bg-red-50 border-2 border-red-400'
                  }`}>
                    <div className="font-bold mb-2 text-gray-900">通常確率 合計</div>
                    <div className={`text-4xl font-bold ${
                      Math.abs(rates.reduce((sum, r) => sum + parseFloat(String(r.rate)), 0) - 100) < 0.01 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {rates.reduce((sum, r) => sum + parseFloat(String(r.rate)), 0).toFixed(2)}%
                    </div>
                    {Math.abs(rates.reduce((sum, r) => sum + parseFloat(String(r.rate)), 0) - 100) >= 0.01 && (
                      <div className="text-sm text-red-600 mt-2">
                        ⚠️ 100%になっていません
                      </div>
                    )}
                  </div>
                  <div className={`p-6 rounded-xl ${
                    Math.abs(rates.reduce((sum, r) => sum + parseFloat(String(r.ten_pull_rate)), 0) - 100) < 0.01 
                      ? 'bg-green-50 border-2 border-green-400' 
                      : 'bg-red-50 border-2 border-red-400'
                  }`}>
                    <div className="font-bold mb-2 text-gray-900">10連確率 合計</div>
                    <div className={`text-4xl font-bold ${
                      Math.abs(rates.reduce((sum, r) => sum + parseFloat(String(r.ten_pull_rate)), 0) - 100) < 0.01 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {rates.reduce((sum, r) => sum + parseFloat(String(r.ten_pull_rate)), 0).toFixed(2)}%
                    </div>
                    {Math.abs(rates.reduce((sum, r) => sum + parseFloat(String(r.ten_pull_rate)), 0) - 100) >= 0.01 && (
                      <div className="text-sm text-red-600 mt-2">
                        ⚠️ 100%になっていません
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 通常会員ガチャ確率調整 */}
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">🎲 通常会員ガチャ確率設定</h2>
            
            {basicRates.length === 0 ? (
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                <div className="font-bold text-yellow-800 mb-2">⚠️ 通常会員ガチャ確率テーブルが見つかりません</div>
                <div className="text-sm text-yellow-700">
                  Supabase SQL Editorでbasic_gacha_ratesテーブルを作成してください。
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-400 rounded-lg">
                  <div className="font-bold text-blue-800 mb-2">💡 ヒント</div>
                  <div className="text-sm text-blue-700">
                    通常会員ガチャはプレミアム会員より確率が低めに設定されています。
                    <br />
                    単発: 30pt / 10連: 270pt で引けます。
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-gray-900">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left font-bold text-gray-900">レアリティ</th>
                        <th className="px-6 py-3 text-left font-bold text-gray-900">通常確率 (%)</th>
                        <th className="px-6 py-3 text-left font-bold text-gray-900">10連確率 (%)</th>
                        <th className="px-6 py-3 text-left font-bold text-gray-900 text-xs">最終更新</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {basicRates.map(rate => (
                        <tr key={rate.rarity} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-bold text-lg text-gray-900">
                            {getRarityLabel(rate.rarity)}
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={rate.rate}
                              onChange={(e) => updateBasicRate(rate.rarity, 'rate', e.target.value)}
                              className="border-2 border-gray-300 rounded-lg px-3 py-2 w-28 text-center font-bold text-gray-900 bg-white"
                            />
                            <span className="ml-2 text-gray-700">%</span>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={rate.ten_pull_rate}
                              onChange={(e) => updateBasicRate(rate.rarity, 'ten_pull_rate', e.target.value)}
                              className="border-2 border-gray-300 rounded-lg px-3 py-2 w-28 text-center font-bold text-gray-900 bg-white"
                            />
                            <span className="ml-2 text-gray-700">%</span>
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-800">
                            {new Date(rate.updated_at).toLocaleString('ja-JP')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Basic会員ガチャの確率合計を計算 */}
                {(() => {
                  const basicTotalSingle = basicRates.reduce((sum, rate) => sum + parseFloat(String(rate.rate)), 0);
                  const basicTotalTen = basicRates.reduce((sum, rate) => sum + parseFloat(String(rate.ten_pull_rate)), 0);

                  return (
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg ${
                    Math.abs(basicTotalSingle - 100) < 0.01 
                      ? 'bg-green-50 border-2 border-green-400' 
                      : 'bg-red-50 border-2 border-red-400'
                  }`}>
                    <div className="font-bold mb-2 text-gray-900">通常確率 合計</div>
                    <div className={`text-3xl font-bold ${
                      Math.abs(basicTotalSingle - 100) < 0.01 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {basicTotalSingle.toFixed(2)}%
                    </div>
                    {Math.abs(basicTotalSingle - 100) >= 0.01 && (
                      <div className="text-sm text-red-600 mt-2">
                        ⚠️ 100%になっていません
                      </div>
                    )}
                  </div>
                  <div className={`p-4 rounded-lg ${
                    Math.abs(basicTotalTen - 100) < 0.01 
                      ? 'bg-green-50 border-2 border-green-400' 
                      : 'bg-red-50 border-2 border-red-400'
                  }`}>
                    <div className="font-bold mb-2 text-gray-900">10連確率 合計</div>
                    <div className={`text-3xl font-bold ${
                      Math.abs(basicTotalTen - 100) < 0.01 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {basicTotalTen.toFixed(2)}%
                    </div>
                    {Math.abs(basicTotalTen - 100) >= 0.01 && (
                      <div className="text-sm text-red-600 mt-2">
                        ⚠️ 100%になっていません
                      </div>
                    )}
                  </div>
                </div>
                  );
                })()}
              </>
            )}
          </div>

          {/* データベース情報 */}
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-bold mb-4">💾 データベース情報</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Supabase URL:</span>
                <span className="font-mono text-xs">{process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">環境:</span>
                <span className="font-bold">{process.env.NODE_ENV || 'development'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
