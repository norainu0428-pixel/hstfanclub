'use client';
/**
 * 管理画面・システム設定
 * 実装メモ:
 * - メンテナンスモード: system_settings の maintenance_mode を ON/OFF。一般ユーザーはブロック、オーナー・スタッフはアクセス可。
 * - お知らせ管理: AnnouncementsEditor で追加・表示/非表示・削除。トップページに反映。
 * - プレミアム/通常会員ガチャ確率の編集（オーナーのみ）。
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { getRarityLabelWithEmoji, normalizeRarity } from '@/utils/rarity';

interface Announcement {
  id: string;
  title: string;
  body: string | null;
  is_active: boolean;
  created_at: string;
}

function AnnouncementsEditor() {
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    setList(data || []);
    setLoading(false);
  }

  async function add() {
    if (!newTitle.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('announcements').insert({
      title: newTitle.trim(),
      body: newBody.trim() || null,
      is_active: true,
      created_by: user?.id
    });
    setNewTitle('');
    setNewBody('');
    load();
  }

  async function toggleActive(id: string, isActive: boolean) {
    await supabase.from('announcements').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id);
    load();
  }

  async function remove(id: string) {
    if (!confirm('削除しますか？')) return;
    await supabase.from('announcements').delete().eq('id', id);
    load();
  }

  if (loading) return <p className="text-gray-900">読込中...</p>;
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="タイトル"
          className="border-2 border-gray-300 rounded-lg px-3 py-2 flex-1 min-w-[200px]"
        />
        <input
          value={newBody}
          onChange={e => setNewBody(e.target.value)}
          placeholder="本文（任意）"
          className="border-2 border-gray-300 rounded-lg px-3 py-2 flex-1 min-w-[200px]"
        />
        <button onClick={add} className="px-4 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600">追加</button>
      </div>
      <div className="space-y-2">
        {list.length === 0 ? (
          <p className="text-gray-900">お知らせはありません</p>
        ) : (
          list.map(a => (
            <div key={a.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <span className="flex-1 font-bold">{a.title}</span>
              <button
                onClick={() => toggleActive(a.id, !a.is_active)}
                className={`px-2 py-1 rounded text-sm ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-900'}`}
              >
                {a.is_active ? '表示中' : '非表示'}
              </button>
              <button onClick={() => remove(a.id)} className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm">削除</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

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
  const [eventRates, setEventRates] = useState<GachaRate[]>([]);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
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
    await loadMaintenanceMode();
    setLoading(false);
  }

  async function loadMaintenanceMode() {
    setMaintenanceLoading(true);
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .maybeSingle();
    const enabled = data?.value && typeof data.value === 'object' && 'enabled' in data.value
      ? Boolean((data.value as { enabled?: boolean }).enabled)
      : false;
    setMaintenanceMode(enabled);
    setMaintenanceLoading(false);
  }

  async function setMaintenanceEnabled(enabled: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'maintenance_mode',
        value: { enabled },
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null
      }, { onConflict: 'key' });
    if (error) {
      alert('メンテナンスモードの更新に失敗しました: ' + error.message);
      return;
    }
    setMaintenanceMode(enabled);
  }

  /** 同一レアリティの重複を除去（1レアリティ1行に統一） */
  function dedupeByRarity<T extends { rarity?: string; id?: string; ten_pull_rate?: unknown }>(rows: T[]): T[] {
    const byCanonical = new Map<string, T>();
    for (const r of rows) {
      const c = normalizeRarity((r.rarity || '').trim()) || 'common';
      if (!byCanonical.has(c)) byCanonical.set(c, r);
      else {
        const curr = byCanonical.get(c)!;
        const currTen = parseFloat(String(curr.ten_pull_rate ?? 0));
        const rTen = parseFloat(String(r.ten_pull_rate ?? 0));
        if (rTen > currTen) byCanonical.set(c, r);
      }
    }
    return Array.from(byCanonical.values());
  }

  async function loadRates() {
    try {
      // プレミアム用
      const { data: premiumData } = await supabase
        .from('gacha_rates')
        .select('*')
        .order('rate', { ascending: false });

      if (premiumData) {
        setRates(dedupeByRarity(premiumData));
      }

      // 通常会員用
      const { data: basicData } = await supabase
        .from('basic_gacha_rates')
        .select('*')
        .order('rate', { ascending: false });

      if (basicData) {
        setBasicRates(dedupeByRarity(basicData));
      }

      // イベントガチャ（HST Smile）用
      const { data: eventData } = await supabase
        .from('event_gacha_rates')
        .select('*')
        .order('rate', { ascending: false });

      if (eventData) {
        setEventRates(dedupeByRarity(eventData));
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

  async function updateEventRate(rarity: string, field: 'rate' | 'ten_pull_rate', value: string) {
    const numValue = parseFloat(value);

    if (isNaN(numValue) || numValue < 0 || numValue > 100) {
      alert('0〜100の数値を入力してください');
      return;
    }

    const { error } = await supabase
      .from('event_gacha_rates')
      .update({
        [field]: numValue,
        updated_at: new Date().toISOString()
      })
      .eq('rarity', rarity);

    if (error) {
      alert('更新に失敗しました: ' + error.message);
      return;
    }

    loadRates();
  }

  const getRarityLabel = (rarity: string) => getRarityLabelWithEmoji(rarity);

  // レアリティ表示順（★7→★1）
  const RARITY_ORDER: Record<string, number> = { 'hst': 0, 'stary': 1, 'legendary': 2, 'ultra-rare': 3, 'super-rare': 4, 'rare': 5, 'common': 6 };
  const sortByRarity = (a: GachaRate, b: GachaRate) =>
    (RARITY_ORDER[(a.rarity || '').toLowerCase()] ?? 99) - (RARITY_ORDER[(b.rarity || '').toLowerCase()] ?? 99);

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
        <h1 className="text-3xl font-bold mb-8">システム設定</h1>

        <div className="space-y-6">
          {/* お知らせ管理 */}
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-bold mb-4">📢 お知らせ管理</h2>
            <AnnouncementsEditor />
          </div>

          {/* メンテナンスモード */}
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-bold mb-4">🔧 メンテナンスモード</h2>
            <p className="text-gray-900 mb-4">
              メンテナンスモードを有効にすると、一般ユーザーはサイトにアクセスできなくなります。オーナー・スタッフは継続してアクセス可能です。
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMaintenanceEnabled(!maintenanceMode)}
                disabled={maintenanceLoading}
                className={`px-6 py-3 rounded-lg font-bold transition ${
                  maintenanceMode
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {maintenanceLoading ? '読込中...' : maintenanceMode ? 'メンテナンス中' : '通常稼働'}
              </button>
              <span className={`font-bold ${maintenanceMode ? 'text-orange-600' : 'text-green-600'}`}>
                {maintenanceMode ? '🔴 メンテナンスモード ON' : '🟢 通常'}
              </span>
            </div>
          </div>

          {/* プレミアム会員ガチャ確率調整 */}
          <div className="bg-white rounded-xl p-6 shadow-lg mb-8">
            <h2 className="text-2xl font-bold mb-6">🎰 プレミアム会員ガチャ確率設定</h2>
            
            {rates.length === 0 ? (
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                <div className="font-bold text-yellow-800 mb-2">⚠️ ガチャ確率テーブルが見つかりません</div>
                <div className="text-sm text-yellow-700">
                  Supabase SQL Editorでgacha_ratesテーブルを作成してください。
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
                  <div className="font-bold text-blue-800 mb-2">📖 使い方</div>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li><strong>通常確率</strong>＝1回引くときの出現率（例：単発ガチャ）</li>
                    <li><strong>10連確率</strong>＝10連ガチャの10回目（確定枠）の出現率</li>
                    <li>それぞれの列の合計が<strong>100%</strong>になるように入力してください</li>
                  </ul>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-black">レアリティ<br /><span className="text-xs font-normal text-black">★7が最上位</span></th>
                        <th className="px-4 py-3 text-left font-bold text-black">通常確率<br /><span className="text-xs font-normal text-black">単発時の%</span></th>
                        <th className="px-4 py-3 text-left font-bold text-black">10連確率<br /><span className="text-xs font-normal text-black">10回目確定の%</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {[...rates].sort(sortByRarity).map(rate => (
                        <tr key={rate.rarity} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div className="font-bold text-base whitespace-nowrap text-black">{getRarityLabel(rate.rarity)}</div>
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={rate.rate}
                              onChange={(e) => updateRate(rate.rarity, 'rate', e.target.value)}
                              placeholder="0"
                              className="border-2 border-gray-300 rounded-lg px-3 py-2 w-24 text-center font-bold"
                            />
                            <span className="ml-1 text-black">%</span>
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={rate.ten_pull_rate}
                              onChange={(e) => updateRate(rate.rarity, 'ten_pull_rate', e.target.value)}
                              placeholder="0"
                              className="border-2 border-gray-300 rounded-lg px-3 py-2 w-24 text-center font-bold"
                            />
                            <span className="ml-1 text-black">%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  {(() => {
                    const totalSingle = rates.reduce((sum, r) => sum + parseFloat(String(r.rate)), 0);
                    const totalTen = rates.reduce((sum, r) => sum + parseFloat(String(r.ten_pull_rate)), 0);
                    const okSingle = Math.abs(totalSingle - 100) < 0.01;
                    const okTen = Math.abs(totalTen - 100) < 0.01;
                    return (
                      <>
                        <div className={`p-6 rounded-xl border-2 ${okSingle ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-400'}`}>
                          <div className="text-sm text-black mb-1">通常確率の合計</div>
                          <div className={`text-4xl font-bold ${okSingle ? 'text-green-600' : 'text-red-600'}`}>
                            {totalSingle.toFixed(1)}%
                          </div>
                          <div className="text-sm mt-1 text-black">{okSingle ? '✓ 100% OK' : '※ 100%にしてください'}</div>
                        </div>
                        <div className={`p-6 rounded-xl border-2 ${okTen ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-400'}`}>
                          <div className="text-sm text-black mb-1">10連確率の合計</div>
                          <div className={`text-4xl font-bold ${okTen ? 'text-green-600' : 'text-red-600'}`}>
                            {totalTen.toFixed(1)}%
                          </div>
                          <div className="text-sm mt-1 text-black">{okTen ? '✓ 100% OK' : '※ 100%にしてください'}</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </>
            )}
          </div>

          {/* 通常会員ガチャ確率調整 */}
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h2 className="text-2xl font-bold mb-6">🎲 通常会員ガチャ確率設定</h2>
            
            {basicRates.length === 0 ? (
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                <div className="font-bold text-yellow-800 mb-2">⚠️ 通常会員ガチャ確率テーブルが見つかりません</div>
                <div className="text-sm text-yellow-700">
                  Supabase SQL Editorでbasic_gacha_ratesテーブルを作成してください。
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
                  <div className="font-bold text-blue-800 mb-2">📖 通常会員ガチャ</div>
                  <div className="text-sm text-blue-700">
                    単発: 30pt / 10連: 270pt。各列の合計を100%にしてください。
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-black">レアリティ<br /><span className="text-xs font-normal text-black">★7が最上位</span></th>
                        <th className="px-4 py-3 text-left font-bold text-black">通常確率<br /><span className="text-xs font-normal text-black">単発時の%</span></th>
                        <th className="px-4 py-3 text-left font-bold text-black">10連確率<br /><span className="text-xs font-normal text-black">10回目確定の%</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {[...basicRates].sort(sortByRarity).map(rate => (
                        <tr key={rate.rarity} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div className="font-bold text-base whitespace-nowrap text-black">{getRarityLabel(rate.rarity)}</div>
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={rate.rate}
                              onChange={(e) => updateBasicRate(rate.rarity, 'rate', e.target.value)}
                              placeholder="0"
                              className="border-2 border-gray-300 rounded-lg px-3 py-2 w-24 text-center font-bold"
                            />
                            <span className="ml-1 text-black">%</span>
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={rate.ten_pull_rate}
                              onChange={(e) => updateBasicRate(rate.rarity, 'ten_pull_rate', e.target.value)}
                              placeholder="0"
                              className="border-2 border-gray-300 rounded-lg px-3 py-2 w-24 text-center font-bold"
                            />
                            <span className="ml-1 text-black">%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {(() => {
                  const totalSingle = basicRates.reduce((sum, r) => sum + parseFloat(String(r.rate)), 0);
                  const totalTen = basicRates.reduce((sum, r) => sum + parseFloat(String(r.ten_pull_rate)), 0);
                  const okSingle = Math.abs(totalSingle - 100) < 0.01;
                  const okTen = Math.abs(totalTen - 100) < 0.01;
                  return (
                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div className={`p-6 rounded-xl border-2 ${okSingle ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-400'}`}>
                        <div className="text-sm text-black mb-1">通常確率の合計</div>
                        <div className={`text-4xl font-bold ${okSingle ? 'text-green-600' : 'text-red-600'}`}>{totalSingle.toFixed(1)}%</div>
                        <div className="text-sm mt-1 text-black">{okSingle ? '✓ 100% OK' : '※ 100%にしてください'}</div>
                      </div>
                      <div className={`p-6 rounded-xl border-2 ${okTen ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-400'}`}>
                        <div className="text-sm text-black mb-1">10連確率の合計</div>
                        <div className={`text-4xl font-bold ${okTen ? 'text-green-600' : 'text-red-600'}`}>{totalTen.toFixed(1)}%</div>
                        <div className="text-sm mt-1 text-black">{okTen ? '✓ 100% OK' : '※ 100%にしてください'}</div>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          {/* イベントガチャ（HST Smile）確率設定 */}
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h2 className="text-2xl font-bold mb-6">🎪 イベントガチャ（HST Smile）確率設定</h2>

            {eventRates.length === 0 ? (
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                <div className="font-bold text-yellow-800 mb-2">⚠️ イベントガチャ確率テーブルが見つかりません</div>
                <div className="text-sm text-yellow-700">
                  Supabase SQL Editorで supabase_event_gacha_setup.sql を実行してください。
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 p-4 bg-purple-50 border-2 border-purple-300 rounded-lg">
                  <div className="font-bold text-purple-800 mb-2">📖 HST Smile イベントガチャ</div>
                  <div className="text-sm text-purple-700">
                    単発: 100pt / 10連: 900pt。10連目はHST以上確定。各列の合計を100%にしてください。
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-black">レアリティ<br /><span className="text-xs font-normal text-black">★7が最上位</span></th>
                        <th className="px-4 py-3 text-left font-bold text-black">単発確率<br /><span className="text-xs font-normal text-black">1回引く時の%</span></th>
                        <th className="px-4 py-3 text-left font-bold text-black">10連目確率<br /><span className="text-xs font-normal text-black">10回目確定の%</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {[...eventRates].sort(sortByRarity).map(rate => (
                        <tr key={rate.rarity} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div className="font-bold text-base whitespace-nowrap text-black">{getRarityLabel(rate.rarity)}</div>
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={rate.rate}
                              onChange={(e) => updateEventRate(rate.rarity, 'rate', e.target.value)}
                              placeholder="0"
                              className="border-2 border-gray-300 rounded-lg px-3 py-2 w-24 text-center font-bold"
                            />
                            <span className="ml-1 text-black">%</span>
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={rate.ten_pull_rate}
                              onChange={(e) => updateEventRate(rate.rarity, 'ten_pull_rate', e.target.value)}
                              placeholder="0"
                              className="border-2 border-gray-300 rounded-lg px-3 py-2 w-24 text-center font-bold"
                            />
                            <span className="ml-1 text-black">%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {(() => {
                  const totalSingle = eventRates.reduce((sum, r) => sum + parseFloat(String(r.rate)), 0);
                  const totalTen = eventRates.reduce((sum, r) => sum + parseFloat(String(r.ten_pull_rate)), 0);
                  const okSingle = Math.abs(totalSingle - 100) < 0.01;
                  const okTen = Math.abs(totalTen - 100) < 0.01;
                  return (
                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div className={`p-6 rounded-xl border-2 ${okSingle ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-400'}`}>
                        <div className="text-sm text-black mb-1">単発確率の合計</div>
                        <div className={`text-4xl font-bold ${okSingle ? 'text-green-600' : 'text-red-600'}`}>{totalSingle.toFixed(1)}%</div>
                        <div className="text-sm mt-1 text-black">{okSingle ? '✓ 100% OK' : '※ 100%にしてください'}</div>
                      </div>
                      <div className={`p-6 rounded-xl border-2 ${okTen ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-400'}`}>
                        <div className="text-sm text-black mb-1">10連目確率の合計</div>
                        <div className={`text-4xl font-bold ${okTen ? 'text-green-600' : 'text-red-600'}`}>{totalTen.toFixed(1)}%</div>
                        <div className="text-sm mt-1 text-black">{okTen ? '✓ 100% OK' : '※ 100%にしてください'}</div>
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
                <span className="text-gray-900">Supabase URL:</span>
                <span className="font-mono text-xs">{process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-900">環境:</span>
                <span className="font-bold">{process.env.NODE_ENV || 'development'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
