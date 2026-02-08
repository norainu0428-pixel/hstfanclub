'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { updateProfilePoints } from '@/utils/profilePoints';
import { getEquipmentStats, getRarityColor, getRarityLabel } from '@/utils/equipment';
import type { EquipmentMaster, UserEquipment } from '@/types/equipment';

const EQUIPMENT_GACHA_COST = 1000;

// レアリティ出現率（%）
const RARITY_WEIGHTS: Record<string, number> = {
  'common': 50,
  'rare': 30,
  'super-rare': 15,
  'ultra-rare': 4,
  'legendary': 1
};

export default function EquipmentGachaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [equipmentMaster, setEquipmentMaster] = useState<EquipmentMaster[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<{ equipment: EquipmentMaster; userEquipment: UserEquipment } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

    const [profileRes, equipmentRes] = await Promise.all([
      supabase.from('profiles').select('points').eq('user_id', user.id).maybeSingle(),
      supabase.from('equipment_master').select('*')
    ]);

    if (profileRes.data) setCurrentPoints(profileRes.data.points || 0);
    if (equipmentRes.data) setEquipmentMaster(equipmentRes.data as EquipmentMaster[]);
    setLoading(false);
  }

  function performGacha(): EquipmentMaster | null {
    if (equipmentMaster.length === 0) return null;

    const roll = Math.random() * 100;
    let acc = 0;
    let selectedRarity = 'common';
    for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
      acc += weight;
      if (roll < acc) {
        selectedRarity = rarity;
        break;
      }
    }

    const byRarity = equipmentMaster.filter(e => e.rarity === selectedRarity);
    if (byRarity.length === 0) {
      return equipmentMaster[Math.floor(Math.random() * equipmentMaster.length)];
    }
    return byRarity[Math.floor(Math.random() * byRarity.length)];
  }

  async function spinGacha() {
    if (currentPoints < EQUIPMENT_GACHA_COST) {
      alert(`ポイントが足りません！（装備ガチャ1回: ${EQUIPMENT_GACHA_COST}pt）`);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsSpinning(true);
    setResult(null);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const equipment = performGacha();
    if (!equipment) {
      setIsSpinning(false);
      return;
    }

    const { data: userEquipment, error } = await supabase
      .from('user_equipment')
      .insert({
        user_id: user.id,
        equipment_id: equipment.id,
        level: 1
      })
      .select()
      .single();

    if (error) {
      alert('装備の獲得に失敗しました');
      setIsSpinning(false);
      return;
    }

    const pointsUpdated = await updateProfilePoints(-EQUIPMENT_GACHA_COST);
    if (!pointsUpdated) {
      alert('装備は獲得しましたが、ポイントの反映に失敗しました。ページを再読み込みしてください。');
      setIsSpinning(false);
      return;
    }
    setCurrentPoints(prev => prev - EQUIPMENT_GACHA_COST);
    setResult({ equipment, userEquipment: userEquipment as UserEquipment });
    setIsSpinning(false);
  }

  const getRarityBg = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-500 to-orange-500';
      case 'ultra-rare': return 'from-purple-500 to-pink-500';
      case 'super-rare': return 'from-purple-400 to-blue-400';
      case 'rare': return 'from-blue-500 to-cyan-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-600 to-orange-700 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-600 to-orange-700 p-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push('/')}
          className="text-white/90 hover:underline mb-4"
        >
          ← ホームに戻る
        </button>

        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">⚔️ 装備ガチャ</h1>
          <p className="text-lg opacity-90">強力な装備を手に入れよう！</p>
          <div className="mt-4 bg-white/20 rounded-lg px-6 py-3 inline-block">
            <div className="text-2xl font-bold">{currentPoints}pt</div>
            <div className="text-sm opacity-90">所持ポイント</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl mb-6 text-gray-900">
          <div className="text-center mb-6">
            <p className="text-gray-900 font-bold mb-2">1回 {EQUIPMENT_GACHA_COST}pt</p>
            <p className="text-sm text-gray-800">
              出現率: コモン50% / レア30% / スーパーレア15% / ウルトラレア4% / レジェンド1%
            </p>
          </div>

          <button
            onClick={spinGacha}
            disabled={isSpinning || currentPoints < EQUIPMENT_GACHA_COST}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white py-4 rounded-xl font-bold text-xl disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition"
          >
            {isSpinning ? '回転中...' : '装備ガチャを引く'}
          </button>
        </div>

        {result && (
          <div className="bg-white rounded-2xl p-8 shadow-2xl mb-6 animate-fade-in text-gray-900">
            <h2 className="text-2xl font-bold text-center mb-4 text-gray-900">🎉 獲得！</h2>
            <div className={`bg-gradient-to-r ${getRarityBg(result.equipment.rarity)} rounded-xl p-6 text-white`}>
              <div className="text-6xl text-center mb-2">{result.equipment.emoji}</div>
              <div className="text-xl font-bold text-center">{result.equipment.name}</div>
              <div className="text-center text-white/90 text-sm mt-1">
                {getRarityLabel(result.equipment.rarity)} / {' '}
                {result.equipment.slot_type === 'weapon' && '武器'}
                {result.equipment.slot_type === 'armor' && '防具'}
                {result.equipment.slot_type === 'accessory' && 'アクセサリ'}
                {' '}Lv.1
              </div>
              <div className="mt-3 flex justify-center gap-4 text-sm">
                {result.equipment.base_atk > 0 && <span>ATK+{result.equipment.base_atk}</span>}
                {result.equipment.base_def > 0 && <span>DEF+{result.equipment.base_def}</span>}
                {result.equipment.base_hp > 0 && <span>HP+{result.equipment.base_hp}</span>}
                {result.equipment.base_spd > 0 && <span>SPD+{result.equipment.base_spd}</span>}
              </div>
            </div>
            <div className="text-center mt-4">
              <button
                onClick={() => router.push('/equipment')}
                className="px-6 py-2 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600"
              >
                装備一覧を見る
              </button>
            </div>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={() => router.push('/equipment')}
            className="text-white/90 hover:underline"
          >
            装備一覧へ →
          </button>
        </div>
      </div>
    </div>
  );
}
