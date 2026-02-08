'use client';
/**
 * 装備ガチャ
 * 実装内容: 1回1000ptで装備を1つ獲得。レアリティは重み付きランダム（common〜legendary）。
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getRarityLabel } from '@/utils/rarity';
import { useRouter } from 'next/navigation';

const SLOT_LABELS: Record<string, string> = { weapon: '武器', armor: '防具', accessory: 'アクセサリ' };
const RARITY_WEIGHTS = [
  { rarity: 'common', weight: 50 },
  { rarity: 'rare', weight: 25 },
  { rarity: 'super-rare', weight: 15 },
  { rarity: 'ultra-rare', weight: 7 },
  { rarity: 'legendary', weight: 3 }
];
const COST = 1000;

export default function EquipmentGachaPage() {
  const router = useRouter();
  const [points, setPoints] = useState(0);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('points').eq('user_id', user.id).single();
    setPoints(profile?.points ?? 0);
    const { data: defs } = await supabase.from('equipment_definitions').select('*');
    setDefinitions(defs || []);
    setLoading(false);
  }

  function pickRandomDefinition() {
    const total = RARITY_WEIGHTS.reduce((s, r) => s + r.weight, 0);
    let r = Math.random() * total;
    let chosenRarity = RARITY_WEIGHTS[0].rarity;
    for (const { rarity, weight } of RARITY_WEIGHTS) {
      r -= weight;
      if (r <= 0) {
        chosenRarity = rarity;
        break;
      }
    }
    const byRarity = definitions.filter((d: any) => d.rarity === chosenRarity);
    return byRarity[Math.floor(Math.random() * byRarity.length)];
  }

  async function pull() {
    if (points < COST) {
      alert(`ポイントが足りません（必要: ${COST}pt）`);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setPulling(true);
    setResult(null);

    const def = pickRandomDefinition();
    if (!def) {
      setPulling(false);
      alert('装備データの取得に失敗しました');
      return;
    }

    const { data: newEquip, error: insertError } = await supabase
      .from('user_equipment')
      .insert({ user_id: user.id, definition_id: def.id, level: 1 })
      .select()
      .single();

    if (insertError) {
      setPulling(false);
      alert('装備の付与に失敗しました: ' + insertError.message);
      return;
    }

    const { error: pointsError } = await supabase
      .from('profiles')
      .update({ points: points - COST })
      .eq('user_id', user.id);

    if (pointsError) {
      setPulling(false);
      alert('ポイントの消費に失敗しました');
      return;
    }

    setPoints(points - COST);
    setResult({ ...newEquip, def });
    setPulling(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-orange-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-gray-900 text-white p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-center">🎰 装備ガチャ</h1>
        <p className="text-gray-400 text-center mb-6">1回 {COST}pt で装備を1つ獲得</p>

        <div className="bg-gray-800 rounded-xl p-6 mb-6 text-center">
          <div className="text-2xl font-bold text-orange-400 mb-4">所持pt: {points}</div>
          <button
            onClick={pull}
            disabled={pulling || points < COST}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-bold text-xl disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
          >
            {pulling ? '抽選中...' : `${COST}pt で1回引く`}
          </button>
        </div>

        {result && (
          <div className="bg-gray-800 rounded-xl p-6 border-2 border-orange-500">
            <h2 className="text-xl font-bold mb-4 text-center">🎉 獲得装備</h2>
            <div className="flex items-center gap-4 p-4 bg-gray-700 rounded-lg">
              <span className="text-5xl">{result.def?.icon}</span>
              <div>
                <div className="font-bold text-lg">{result.def?.name}</div>
                <div className="text-sm text-gray-400">
                  {SLOT_LABELS[result.def?.slot]} | {result.def?.rarity ? getRarityLabel(result.def.rarity) : '-'} | Lv.{result.level}
                </div>
                <div className="text-xs text-gray-900 mt-1">
                  HP+{result.def?.hp_bonus} ATK+{result.def?.attack_bonus} DEF+{result.def?.defense_bonus} SPD+{result.def?.speed_bonus}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setResult(null); load(); }}
                className="flex-1 py-2 bg-gray-600 rounded-lg font-bold hover:bg-gray-500"
              >
                もう1回引く
              </button>
              <button
                onClick={() => router.push('/equipment')}
                className="flex-1 py-2 bg-orange-500 rounded-lg font-bold hover:bg-orange-600"
              >
                装備画面へ
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <button onClick={() => router.push('/equipment')} className="text-gray-400 hover:text-white">← 装備に戻る</button>
        </div>
      </div>
    </div>
  );
}
