'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { updateMissionProgress } from '@/utils/missionTracker';
import { Rarity } from '@/types/adventure';
import { getRarityLabel, getRarityLabelWithEmoji, getRarityColorClass, getRarityShortLabel, getRarityBorderColor } from '@/utils/rarity';
import { getPlateImageUrl } from '@/utils/plateImage';

// HSTメンバーデータ
const HST_MEMBERS = {
  HST: [
    { 
      name: 'HST Smile', 
      emoji: '😊', 
      description: 'HSTesportsの笑顔を体現する最高位メンバー',
      skill_type: 'hst_power',
      skill_power: 100
    }
  ],
  stary: [
    { 
      name: 'STARY', 
      emoji: '🌠', 
      description: '伝説のマスコット',
      skill_type: 'revive',
      skill_power: 1
    }
  ],
  legendary: [
    { 
      name: 'smile', 
      emoji: '😊', 
      description: 'チームリーダー',
      skill_type: 'attack_boost',
      skill_power: 20
    },
    { 
      name: 'zerom', 
      emoji: '⚡', 
      description: 'エースプレイヤー',
      skill_type: 'heal',
      skill_power: 50
    },
    { 
      name: 'shunkoro', 
      emoji: '🔥', 
      description: 'ストラテジスト',
      skill_type: 'defense_boost',
      skill_power: 15
    }
  ],
  'ultra-rare': [
    { 
      name: 'smile', 
      emoji: '😊', 
      description: 'チームリーダー',
      skill_type: 'attack_boost',
      skill_power: 18
    },
    { 
      name: 'zerom', 
      emoji: '⚡', 
      description: 'エースプレイヤー',
      skill_type: 'heal',
      skill_power: 45
    },
    { 
      name: 'shunkoro', 
      emoji: '🔥', 
      description: 'ストラテジスト',
      skill_type: 'defense_boost',
      skill_power: 12
    }
  ],
  'super-rare': [
    { 
      name: 'smile', 
      emoji: '😊', 
      description: 'チームリーダー',
      skill_type: 'attack_boost',
      skill_power: 15
    },
    { 
      name: 'zerom', 
      emoji: '⚡', 
      description: 'エースプレイヤー',
      skill_type: 'heal',
      skill_power: 40
    },
    { 
      name: 'shunkoro', 
      emoji: '🔥', 
      description: 'ストラテジスト',
      skill_type: null
    }
  ],
  rare: [
    { 
      name: 'smile', 
      emoji: '😊', 
      description: 'チームリーダー',
      skill_type: 'attack_boost',
      skill_power: 12
    },
    { 
      name: 'zerom', 
      emoji: '⚡', 
      description: 'エースプレイヤー',
      skill_type: 'heal',
      skill_power: 35
    },
    { 
      name: 'shunkoro', 
      emoji: '🔥', 
      description: 'ストラテジスト',
      skill_type: null
    }
  ],
  common: [
    { 
      name: 'smile', 
      emoji: '😊', 
      description: 'チームリーダー',
      skill_type: null
    },
    { 
      name: 'zerom', 
      emoji: '⚡', 
      description: 'エースプレイヤー',
      skill_type: null
    },
    { 
      name: 'shunkoro', 
      emoji: '🔥', 
      description: 'ストラテジスト',
      skill_type: null
    }
  ]
};

// 基本ステータス
const baseStats: { [key: string]: { hp: number; attack: number; defense: number; speed: number } } = {
  'HST': { hp: 300, attack: 80, defense: 50, speed: 60 },
  'stary': { hp: 200, attack: 50, defense: 30, speed: 40 },
  'legendary': { hp: 150, attack: 35, defense: 20, speed: 25 },
  'ultra-rare': { hp: 120, attack: 25, defense: 15, speed: 20 },
  'super-rare': { hp: 100, attack: 20, defense: 12, speed: 15 },
  'rare': { hp: 80, attack: 15, defense: 10, speed: 12 },
  'common': { hp: 60, attack: 10, defense: 8, speed: 10 }
};

interface GachaResult {
  rarity: Rarity;
  member: {
    name: string;
    emoji: string;
    description: string;
    skill_type?: string | null;
    skill_power?: number;
  };
}

export default function EventsPage() {
  const [points, setPoints] = useState(0);
  const [rates, setRates] = useState<any[]>([]);
  const [pulling, setPulling] = useState(false);
  const [pullType, setPullType] = useState<'single' | 'ten'>('ten');
  const [singleResult, setSingleResult] = useState<GachaResult | null>(null);
  const [tenPullResults, setTenPullResults] = useState<GachaResult[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, points')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      setPoints(profile.points || 0);
    }

    // イベントガチャ確率取得（運営が管理画面で変更可能）
    const DEFAULT_EVENT_RATES = [
      { rarity: 'HST', rate: 0.1, ten_pull_rate: 1.0 },
      { rarity: 'stary', rate: 0.5, ten_pull_rate: 5.0 },
      { rarity: 'legendary', rate: 3.0, ten_pull_rate: 10.0 },
      { rarity: 'ultra-rare', rate: 10.0, ten_pull_rate: 20.0 },
      { rarity: 'super-rare', rate: 20.0, ten_pull_rate: 64.0 },
      { rarity: 'rare', rate: 30.0, ten_pull_rate: 0.0 },
      { rarity: 'common', rate: 36.4, ten_pull_rate: 0.0 }
    ];

    const { data: ratesData } = await supabase
      .from('event_gacha_rates')
      .select('*')
      .order('rate', { ascending: false });

    if (ratesData && ratesData.length > 0) {
      // DBの値をベースに、stary・HSTが欠けている or rate=0 の場合はデフォルトで補完
      const merged = [...ratesData];
      for (const def of DEFAULT_EVENT_RATES) {
        const existing = merged.find((r: any) => (r.rarity || '').toLowerCase() === def.rarity.toLowerCase());
        if (!existing || parseFloat(existing.rate || '0') === 0) {
          if (existing) {
            const idx = merged.indexOf(existing);
            merged[idx] = { ...merged[idx], rate: def.rate, ten_pull_rate: def.ten_pull_rate };
          } else {
            merged.push(def);
          }
        }
      }
      // レアリティで重複を除去（DBに重複がある場合の対策。同一レアリティは ten_pull_rate が大きい方を採用）
      const CANONICAL_RARITY: Record<string, string> = {
        'hst': 'HST', 'stary': 'stary', 'legendary': 'legendary',
        'ultra-rare': 'ultra-rare', 'super-rare': 'super-rare', 'rare': 'rare', 'common': 'common'
      };
      const byKey = new Map<string, { rarity: string; rate: number; ten_pull_rate: number }>();
      for (const r of merged) {
        const key = (r.rarity || '').trim().toLowerCase();
        if (!key) continue;
        const curr = byKey.get(key);
        const rate = parseFloat(r.rate || '0');
        const tenPull = parseFloat(r.ten_pull_rate || '0');
        if (!curr || tenPull > curr.ten_pull_rate) {
          const canonical = CANONICAL_RARITY[key] || r.rarity || key;
          byKey.set(key, { rarity: canonical, rate, ten_pull_rate: tenPull });
        }
      }
      const deduped = Array.from(byKey.values());
      deduped.sort((a: any, b: any) => (parseFloat(b.rate || '0') - parseFloat(a.rate || '0')));
      setRates(deduped);
    } else {
      setRates(DEFAULT_EVENT_RATES);
    }

    setLoading(false);
  }

  async function saveMemberAndConsumePoints(results: GachaResult[], pointCost: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    for (const r of results) {
      const rarityMap: Record<string, string> = {
        'HST': 'HST', 'hst': 'HST',
        'stary': 'stary', 'STARY': 'stary',
        'legendary': 'legendary', 'ultra-rare': 'ultra-rare',
        'super-rare': 'super-rare', 'rare': 'rare', 'common': 'common'
      };
      const statsKey = rarityMap[r.rarity] ?? 'common';
      const stats = baseStats[statsKey] ?? baseStats['common'];
      const { error: insertErr } = await supabase
        .from('user_members')
        .insert({
          user_id: user.id,
          member_name: r.member.name,
          member_emoji: r.member.emoji,
          member_description: r.member.description,
          rarity: r.rarity,
          level: 1,
          experience: 0,
          max_hp: stats.hp,
          hp: stats.hp,
          current_hp: stats.hp,
          attack: stats.attack,
          defense: stats.defense,
          speed: stats.speed,
          skill_type: r.member.skill_type,
          skill_power: r.member.skill_power || 0,
          revive_used: false
        });
      if (insertErr) throw new Error(`メンバーの追加に失敗しました: ${insertErr.message}`);
    }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ points: points - pointCost })
      .eq('user_id', user.id);
    if (updateErr) throw new Error(`ポイントの消費に失敗しました: ${updateErr.message}`);

    await updateMissionProgress(user.id, 'gacha_pull', results.length);
    setPoints(points - pointCost);
  }

  async function pullSingleGacha() {
    if (points < 100) {
      alert('ポイントが足りません（100pt）');
      return;
    }
    setPulling(true);
    setSingleResult(null);
    try {
      await new Promise(r => setTimeout(r, 1500));
      const rarity = drawRarity();
      const memberData = getMemberByRarity(rarity);
      const member = memberData[Math.floor(Math.random() * memberData.length)];
      const gachaResult: GachaResult = { rarity: rarity as Rarity, member };
      await saveMemberAndConsumePoints([gachaResult], 100);
      setSingleResult(gachaResult);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'ガチャに失敗しました');
    } finally {
      setPulling(false);
    }
  }

  async function pullTenGacha() {
    if (points < 900) {
      alert('ポイントが足りません（900pt）');
      return;
    }
    setPulling(true);
    setTenPullResults([]);
    try {
      const results: GachaResult[] = [];
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 350));
        const rarity = drawRarity();
        const memberData = getMemberByRarity(rarity);
        const member = memberData[Math.floor(Math.random() * memberData.length)];
        results.push({ rarity: rarity as Rarity, member });
        setTenPullResults([...results]);
      }
      await saveMemberAndConsumePoints(results, 900);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'ガチャに失敗しました');
      setTenPullResults([]);
    } finally {
      setPulling(false);
    }
  }

  function drawRarity(): string {
    // 単発・10連ともに同じ確率（10連目もHST確定なし）
    const rand = Math.random() * 100;
    let cumulative = 0;

    for (const rate of rates) {
      cumulative += parseFloat(rate.rate || '0');
      if (rand < cumulative) {
        return rate.rarity;
      }
    }

    return 'common';
  }

  function getMemberByRarity(rarity: string): any[] {
    // データベースのレアリティ名をコードのキーにマッピング
    const rarityKey = rarity === 'HST' ? 'HST' : 
                     rarity === 'stary' || rarity === 'STARY' ? 'stary' :
                     rarity === 'legendary' || rarity === 'レジェンド' ? 'legendary' :
                     rarity === 'ultra-rare' || rarity === 'ウルトラレア' ? 'ultra-rare' :
                     rarity === 'super-rare' || rarity === 'スーパーレア' ? 'super-rare' :
                     rarity === 'rare' || rarity === 'レア' ? 'rare' : 'common';
    return (HST_MEMBERS as any)[rarityKey] || HST_MEMBERS.common;
  }

  function getRarityColor(rarity: Rarity): string {
    const base = getRarityColorClass(rarity);
    return (rarity === 'HST' || rarity === 'stary') ? `${base} animate-pulse` : base;
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-red-600 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-cyan-600 p-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center text-white mb-6">
          <h1 className="text-4xl font-bold mb-2">🎪 HST Smileガチャ</h1>
          <p className="text-xl opacity-90 mb-4">HST Smileが出る限定イベントガチャ！</p>
          <div className="text-3xl font-bold">
            ポイント: {points.toLocaleString()}pt
          </div>
        </div>

        {/* ポイント表示 */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-2xl">
          <div className="text-center">
            <div className="text-gray-600 mb-2">現在のポイント</div>
            <div className="text-5xl font-bold text-pink-600">{points}</div>
            <div className="text-sm text-gray-500 mt-2">pt</div>
            {points < 100 && (
              <div className="mt-3 text-red-500 font-bold">
                ガチャにはあと{100 - points}pt必要です
              </div>
            )}
          </div>
        </div>

        {/* ガチャマシン（白カード） */}
        <div className="bg-white rounded-2xl p-8 mb-6 shadow-2xl">
          <div className="text-center">
            {/* タブ切り替え */}
            <div className="flex gap-2 mb-6 justify-center">
              <button
                onClick={() => setPullType('single')}
                className={`px-6 py-3 rounded-lg font-bold transition ${
                  pullType === 'single'
                    ? 'bg-gradient-to-r from-pink-500 to-red-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                単発ガチャ
              </button>
              <button
                onClick={() => setPullType('ten')}
                className={`px-6 py-3 rounded-lg font-bold transition ${
                  pullType === 'ten'
                    ? 'bg-gradient-to-r from-pink-500 to-red-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                10連ガチャ
              </button>
            </div>

            {pullType === 'single' ? (
              <>
                {/* 単発ガチャUI */}
                <div className={`w-32 h-32 mx-auto mb-6 rounded-full flex items-center justify-center overflow-hidden ${
                  pulling ? 'animate-spin' : ''
                } ${singleResult ? getRarityColor(singleResult.rarity) : 'bg-gradient-to-br from-gray-300 to-gray-400'} shadow-xl`}>
                  {singleResult ? (
                    (() => {
                      const imageUrl = getPlateImageUrl(singleResult.member.name, singleResult.rarity);
                      return imageUrl ? (
                        <Image src={imageUrl} alt={singleResult.member.name} width={128} height={128} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-6xl">{singleResult.member.emoji}</span>
                      );
                    })()
                  ) : (
                    <span className="text-6xl">🎰</span>
                  )}
                </div>

                {singleResult && !pulling && (
                  <div className="mb-6 animate-fade-in">
                    <div className="bg-white rounded-2xl p-6 shadow-2xl border-4 mx-auto max-w-sm" style={{ borderColor: getRarityBorderColor(singleResult.rarity) }}>
                      <div className="text-center text-sm font-bold text-gray-500 mb-3">🎉 当たり！</div>
                      <div className={`inline-block px-6 py-3 rounded-full text-white font-bold text-xl mb-4 w-full text-center ${getRarityColor(singleResult.rarity)}`}>
                        {getRarityLabel(singleResult.rarity)}
                      </div>
                      {(() => {
                        const imageUrl = getPlateImageUrl(singleResult.member.name, singleResult.rarity);
                        return imageUrl ? (
                          <div className="flex justify-center mb-4">
                            <Image src={imageUrl} alt={singleResult.member.name} width={120} height={120} className="w-28 h-28 object-cover rounded-xl shadow-lg" />
                          </div>
                        ) : (
                          <div className="text-6xl mb-4 text-center">{singleResult.member.emoji}</div>
                        );
                      })()}
                      <div className="text-2xl font-bold mb-2 text-center text-gray-900">{singleResult.member.name}</div>
                      <div className="text-gray-600 mb-3 text-center text-sm">{singleResult.member.description}</div>
                    </div>
                  </div>
                )}

                <button
                  onClick={pullSingleGacha}
                  disabled={pulling || points < 100}
                  className={`bg-gradient-to-r from-pink-500 to-red-500 text-white px-12 py-4 rounded-full text-xl font-bold shadow-lg transition transform ${
                    pulling || points < 100 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:shadow-2xl'
                  }`}
                >
                  {pulling ? '抽選中...' : points < 100 ? 'ポイント不足' : 'ガチャを回す！（100pt）'}
                </button>
                <div className="text-sm text-gray-500 mt-4">ガチャ1回: 100pt消費</div>
              </>
            ) : (
              <>
                {/* 10連ガチャUI */}
                <div className="mb-6">
                  <div className="text-4xl mb-4">🎰✨</div>
                  <div className="text-2xl font-bold mb-2">10連ガチャ</div>
                  <div className="text-gray-600 mb-4">10回目はスーパーレア以上確定！</div>

                  {pulling && (
                    <div className="text-lg text-pink-600 font-bold animate-pulse mb-4">
                      抽選中... {tenPullResults.length}/10
                    </div>
                  )}

                  {tenPullResults.length > 0 && !pulling && (
                    <div className="mb-6">
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <span className="text-lg font-bold text-gray-700">🎊 獲得キャラクター</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        {tenPullResults.map((item, index) => {
                          const imageUrl = getPlateImageUrl(item.member.name, item.rarity);
                          return (
                            <div
                              key={index}
                              className="p-4 rounded-xl border-4 bg-white shadow-xl min-w-[110px]"
                              style={{ borderColor: getRarityBorderColor(item.rarity) }}
                            >
                              {imageUrl ? (
                                <div className="flex justify-center mb-2">
                                  <Image src={imageUrl} alt={item.member.name} width={64} height={64} className="w-16 h-16 object-cover rounded-lg" />
                                </div>
                              ) : (
                                <div className="text-4xl mb-2 text-center">{item.member.emoji}</div>
                              )}
                              <div className={`text-sm font-bold truncate text-center ${item.rarity === 'common' ? 'text-gray-800' : 'text-gray-900'}`}>
                                {item.member.name}
                              </div>
                              <div className={`px-2 py-1 rounded-full mt-2 ${getRarityColor(item.rarity)} text-white text-center font-bold text-xs`}>
                                {getRarityShortLabel(item.rarity)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={pullTenGacha}
                  disabled={pulling || points < 900}
                  className={`bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-12 py-4 rounded-full text-xl font-bold shadow-lg transition transform ${
                    pulling || points < 900 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:shadow-2xl'
                  }`}
                >
                  {pulling ? '抽選中...' : points < 900 ? 'ポイント不足' : '10連ガチャ！（900pt）'}
                </button>
                <div className="text-sm text-green-600 font-bold mt-2">10%オフ！</div>
              </>
            )}
          </div>
        </div>

        {/* 確率表 */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-xl">
          <h3 className="font-bold text-xl mb-2 text-center text-gray-800">
            📊 排出確率
          </h3>
          <p className="text-gray-500 text-sm mb-4 text-center">★7が最上位、★1が最下位</p>
          <div className="space-y-2">
            {rates.map(rate => (
              <div
                key={rate.rarity}
                className={`flex justify-between items-center p-3 rounded-lg text-white ${getRarityColorClass(rate.rarity)}`}
              >
                <span className="font-bold">{getRarityLabelWithEmoji(rate.rarity)}</span>
                <span className="font-bold">
                  単発: {parseFloat(rate.rate || '0').toFixed(1)}% / 10連: {parseFloat(rate.ten_pull_rate || '0').toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 戻るボタン */}
        <div className="text-center mt-8">
          <button
            onClick={() => router.push('/')}
            className="bg-white text-pink-600 px-8 py-3 rounded-full font-bold hover:bg-gray-100 transition"
          >
            ← トップに戻る
          </button>
          <button
            onClick={() => router.push('/adventure/collection')}
            className="ml-4 bg-white text-pink-600 px-8 py-3 rounded-full font-bold hover:bg-gray-100 transition"
          >
            メンバー一覧へ
          </button>
        </div>
      </div>
    </div>
  );
}
