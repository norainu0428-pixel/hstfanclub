'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { updateMissionProgress } from '@/utils/missionTracker';
import { Rarity } from '@/types/adventure';
import { generateMemberStatsWithIV } from '@/utils/memberStats';

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

// 開催中のイベントがあるか（管理者がイベント開始時にtrueに変更）
const HAS_ACTIVE_EVENT = false;

// HST Smile ガチャ 開催予定（2月8日 21:00）
const EVENT_SCHEDULE_TEXT = '2月8日 21:00';

// HST Smile Lv1 ステータス（HSTレアリティの基本値）
const HST_SMILE_LV1_STATS = baseStats['HST'];

export default function EventsPage() {
  const [points, setPoints] = useState(0);
  const [rates, setRates] = useState<any[]>([]);
  const [pulling, setPulling] = useState(false);
  const [result, setResult] = useState<GachaResult[] | null>(null);
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

    // イベントガチャ確率取得（開催中の場合のみ）
    if (HAS_ACTIVE_EVENT) {
      const { data: ratesData } = await supabase
        .from('event_gacha_rates')
        .select('*')
        .order('rate', { ascending: false });
      if (ratesData) setRates(ratesData);
    }

    setLoading(false);
  }

  async function pullGacha(type: 'single' | 'ten') {
    const cost = type === 'single' ? 100 : 900;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (points < cost) {
      alert('ポイントが足りません');
      return;
    }

    setPulling(true);

    try {
      const pulls = type === 'single' ? 1 : 10;
      const results: GachaResult[] = [];

      for (let i = 0; i < pulls; i++) {
        const isLast = type === 'ten' && i === 9;
        const rarity = drawRarity(isLast);
        const memberData = getMemberByRarity(rarity);
        const member = memberData[Math.floor(Math.random() * memberData.length)];

        results.push({
          rarity: rarity as Rarity,
          member
        });

        // メンバーをDBに追加（個体値・才能値を付与。カラムが無い場合は従来の項目のみで保存）
        const baseStatsForRarity = baseStats[rarity];
        const statsWithIV = generateMemberStatsWithIV(baseStatsForRarity);
        const insertPayload = {
          user_id: user.id,
          member_name: member.name,
          member_emoji: member.emoji,
          member_description: member.description,
          rarity: rarity,
          level: 1,
          experience: 0,
          max_hp: statsWithIV.hp,
          hp: statsWithIV.hp,
          current_hp: statsWithIV.hp,
          attack: statsWithIV.attack,
          defense: statsWithIV.defense,
          speed: statsWithIV.speed,
          skill_type: member.skill_type,
          skill_power: member.skill_power || 0,
          revive_used: false,
          individual_hp: statsWithIV.individual_hp,
          individual_atk: statsWithIV.individual_atk,
          individual_def: statsWithIV.individual_def,
          individual_spd: statsWithIV.individual_spd,
          talent_value: statsWithIV.talent_value
        };
        const { error: insertError } = await supabase.from('user_members').insert(insertPayload);
        if (insertError) {
          const isColumnError = /column.*does not exist|unknown column/i.test(insertError.message);
          if (isColumnError) {
            const { error: fallbackError } = await supabase.from('user_members').insert({
              user_id: user.id,
              member_name: member.name,
              member_emoji: member.emoji,
              member_description: member.description,
              rarity: rarity,
              level: 1,
              experience: 0,
              max_hp: statsWithIV.hp,
              hp: statsWithIV.hp,
              current_hp: statsWithIV.hp,
              attack: statsWithIV.attack,
              defense: statsWithIV.defense,
              speed: statsWithIV.speed,
              skill_type: member.skill_type,
              skill_power: member.skill_power || 0,
              revive_used: false
            });
            if (fallbackError) {
              alert(`キャラの保存に失敗しました: ${fallbackError.message}\n（Supabaseで supabase_iv_talent.sql の実行を推奨します）`);
              setPulling(false);
              return;
            }
          } else {
            alert(`キャラの保存に失敗しました: ${insertError.message}`);
            setPulling(false);
            return;
          }
        }
      }

      // ポイント消費
      await supabase
        .from('profiles')
        .update({ points: points - cost })
        .eq('user_id', user.id);

      // ミッション進捗更新
      await updateMissionProgress(user.id, 'gacha_pull', pulls);

      setPoints(points - cost);
      setResult(results);
    } catch (error) {
      console.error(error);
      alert('ガチャに失敗しました');
    } finally {
      setPulling(false);
    }
  }

  function drawRarity(isTenthPull: boolean): string {
    if (isTenthPull) {
      // 10連目はHST以上確定（HST, stary, legendary, ultra-rare, super-rare）
      const highRarities = rates.filter(r => 
        r.rarity === 'HST' || 
        r.rarity === 'stary' || 
        r.rarity === 'legendary' || 
        r.rarity === 'ultra-rare' || 
        r.rarity === 'super-rare'
      );
      
      // 10連目の確率で抽選
      const rand = Math.random() * 100;
      let cumulative = 0;
      
      for (const rate of highRarities) {
        cumulative += parseFloat(rate.ten_pull_rate || '0');
        if (rand < cumulative) {
          return rate.rarity;
        }
      }
      
      // フォールバック（確率の合計が100%未満の場合）
      return highRarities[0]?.rarity || 'super-rare';
    } else {
      // 通常の単発ガチャ
      const rateType = 'rate';
      const rand = Math.random() * 100;
      let cumulative = 0;

      for (const rate of rates) {
        cumulative += parseFloat(rate[rateType] || '0');
        if (rand < cumulative) {
          return rate.rarity;
        }
      }

      return 'common';
    }
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
    switch (rarity) {
      case 'HST': return 'bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 animate-pulse';
      case 'stary': return 'bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 animate-pulse';
      case 'legendary': return 'bg-gradient-to-r from-yellow-400 to-orange-500';
      case 'ultra-rare': return 'bg-gradient-to-r from-purple-500 to-pink-500';
      case 'super-rare': return 'bg-purple-500';
      case 'rare': return 'bg-blue-500';
      case 'common': return 'bg-gray-400';
    }
  }

  function getRarityName(rarity: Rarity): string {
    switch (rarity) {
      case 'HST': return '👑 HST';
      case 'stary': return '🌠 STARY';
      case 'legendary': return 'レジェンド';
      case 'ultra-rare': return 'ウルトラレア';
      case 'super-rare': return 'スーパーレア';
      case 'rare': return 'レア';
      case 'common': return 'コモン';
    }
  }

  function closeResult() {
    setResult(null);
    router.push('/adventure/collection');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-red-600 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  // 開催中のイベントがない場合
  if (!HAS_ACTIVE_EVENT) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-red-600 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-white mb-8">
            <h1 className="text-4xl font-bold mb-2">🎪 イベントガチャ</h1>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-12 shadow-2xl border border-white/20 mt-8">
              <p className="text-2xl font-bold text-white/90">開催中のイベントはありません</p>
              <p className="text-white/70 mt-4">新しいイベントの開催をお楽しみに！</p>
              
              {/* HST Smile ガチャ 開催予定 */}
              <div className="mt-8 p-6 bg-yellow-500/20 rounded-xl border border-yellow-400/50 text-gray-900">
                <h3 className="text-xl font-bold mb-2 text-gray-900">😊 HST Smile ガチャ</h3>
                <p className="text-lg font-semibold text-gray-900">開催予定: {EVENT_SCHEDULE_TEXT}</p>
              </div>

              {/* HST Smile Lv1 ステータス */}
              <div className="mt-6 p-6 bg-white/20 rounded-xl border border-white/30 text-gray-900">
                <h3 className="text-lg font-bold mb-4 text-gray-900">😊 HST Smile ステータス（Lv.1）</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-sm text-gray-700">HP</div>
                    <div className="text-xl font-bold text-gray-900">{HST_SMILE_LV1_STATS.hp}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-700">攻撃力</div>
                    <div className="text-xl font-bold text-gray-900">{HST_SMILE_LV1_STATS.attack}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-700">防御力</div>
                    <div className="text-xl font-bold text-gray-900">{HST_SMILE_LV1_STATS.defense}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-700">素早さ</div>
                    <div className="text-xl font-bold text-gray-900">{HST_SMILE_LV1_STATS.speed}</div>
                  </div>
                </div>
                <p className="text-xs text-gray-700 mt-3">※ 個体値・才能値により変動します</p>
              </div>
            </div>
          </div>
          <div className="text-center mt-8">
            <button
              onClick={() => router.push('/')}
              className="text-white text-lg hover:underline"
            >
              ← トップに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-red-600 p-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">🎪 イベントガチャ</h1>
          <p className="text-xl opacity-90 mb-4">HST Smileが出るかも！</p>
          <div className="text-3xl font-bold">
            ポイント: {points.toLocaleString()}pt
          </div>
        </div>

        {/* 結果表示 */}
        {result && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <h2 className="text-3xl font-bold text-center mb-6">
                🎉 ガチャ結果
              </h2>
              <div className={`grid gap-4 mb-6 ${result.length === 1 ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-5'}`}>
                {result.map((item, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 ${
                      item.rarity === 'HST'
                        ? 'bg-gradient-to-br from-yellow-200 to-orange-200 border-yellow-500'
                        : item.rarity === 'stary'
                        ? 'bg-yellow-100 border-yellow-400'
                        : 'bg-gray-100 border-gray-300'
                    }`}
                  >
                    <div className="text-4xl text-center mb-2">
                      {item.member.emoji}
                    </div>
                    <div className={`text-xs text-center font-bold px-2 py-1 rounded ${getRarityColor(item.rarity)} text-white`}>
                      {getRarityName(item.rarity)}
                    </div>
                    <div className="text-xs text-center mt-1 font-semibold">
                      {item.member.name}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={closeResult}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white px-8 py-4 rounded-full text-xl font-bold hover:opacity-90"
              >
                メンバー一覧へ
              </button>
            </div>
          </div>
        )}

        {/* ガチャボタン */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* 単発 */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
            <div className="text-center text-white mb-6">
              <div className="text-6xl mb-4">🎫</div>
              <h2 className="text-2xl font-bold mb-2">単発ガチャ</h2>
              <div className="text-4xl font-bold text-yellow-300 mb-2">
                100pt
              </div>
              <p className="text-sm opacity-80">通常の2倍のコスト</p>
            </div>
            <button
              onClick={() => pullGacha('single')}
              disabled={pulling || points < 100}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-8 py-4 rounded-full text-xl font-bold hover:opacity-90 disabled:opacity-50 transition"
            >
              {pulling ? '抽選中...' : '1回引く'}
            </button>
          </div>

          {/* 10連 */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
            <div className="text-center text-white mb-6">
              <div className="text-6xl mb-4">🎟️</div>
              <h2 className="text-2xl font-bold mb-2">10連ガチャ</h2>
              <div className="text-4xl font-bold text-yellow-300 mb-2">
                900pt
              </div>
              <p className="text-sm opacity-80">
                10%オフ + 10連目はHST以上確定
              </p>
            </div>
            <button
              onClick={() => pullGacha('ten')}
              disabled={pulling || points < 900}
              className="w-full bg-gradient-to-r from-pink-500 to-red-500 text-white px-8 py-4 rounded-full text-xl font-bold hover:opacity-90 disabled:opacity-50 transition"
            >
              {pulling ? '抽選中...' : '10連ガチャ'}
            </button>
          </div>
        </div>

        {/* 確率表 */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
          <h3 className="text-2xl font-bold text-white mb-6 text-center">
            📊 排出確率
          </h3>
          <div className="space-y-3">
            {rates.map(rate => (
              <div
                key={rate.rarity}
                className="flex items-center justify-between bg-white/5 rounded-lg p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {rate.rarity === 'HST' ? '😊' :
                     rate.rarity === 'stary' ? '🌠' :
                     rate.rarity === 'legendary' ? '🏆' :
                     rate.rarity === 'ultra-rare' ? '💎' :
                     rate.rarity === 'super-rare' ? '⭐' :
                     rate.rarity === 'rare' ? '✨' : '📦'}
                  </span>
                  <span className="text-white font-bold text-lg">
                    {getRarityName(rate.rarity as Rarity)}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-yellow-300 font-bold">
                    単発: {parseFloat(rate.rate || '0').toFixed(1)}%
                  </div>
                  <div className="text-pink-300 font-bold text-sm">
                    10連目: {parseFloat(rate.ten_pull_rate || '0').toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 戻るボタン */}
        <div className="text-center mt-8">
          <button
            onClick={() => router.push('/')}
            className="text-white text-lg hover:underline"
          >
            ← トップに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
