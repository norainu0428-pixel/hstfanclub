'use client';
/**
 * 通常ガチャ（ポイント消費）
 * 実装メモ: 全ログインユーザーがアクセス可能（プレミアム期限不要）。
 * 単発30pt / 10連270pt。basic_gacha_rates で確率管理。
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { updateMissionProgress } from '@/utils/missionTracker';
import { getPlateImageUrl } from '@/utils/plateImage';
import { getRarityLabel, getRarityShortLabel, getRarityLabelWithEmoji, getRarityColorClass, getRarityBorderColor } from '@/utils/rarity';
import { getSkillName } from '@/utils/skills';
import Image from 'next/image';

type Rarity = 'HST' | 'stary' | 'common' | 'rare' | 'super-rare' | 'ultra-rare' | 'legendary';

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

// HSTメンバーデータ（プレミアムと同じ）
const HST_MEMBERS = {
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
  ultraRare: [
    { name: 'smile', emoji: '😊', description: 'チームリーダー', skill_type: 'attack_boost', skill_power: 18 },
    { name: 'zerom', emoji: '⚡', description: 'エースプレイヤー', skill_type: 'heal', skill_power: 45 },
    { name: 'shunkoro', emoji: '🔥', description: 'ストラテジスト', skill_type: 'defense_boost', skill_power: 12 }
  ],
  superRare: [
    { name: 'smile', emoji: '😊', description: 'チームリーダー', skill_type: 'attack_boost', skill_power: 15 },
    { name: 'zerom', emoji: '⚡', description: 'エースプレイヤー', skill_type: 'heal', skill_power: 40 },
    { name: 'shunkoro', emoji: '🔥', description: 'ストラテジスト', skill_type: null }
  ],
  rare: [
    { name: 'smile', emoji: '😊', description: 'チームリーダー', skill_type: 'attack_boost', skill_power: 12 },
    { name: 'zerom', emoji: '⚡', description: 'エースプレイヤー', skill_type: 'heal', skill_power: 35 },
    { name: 'shunkoro', emoji: '🔥', description: 'ストラテジスト', skill_type: null }
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

// デフォルト確率（通常会員用）
const DEFAULT_RATES = {
  single: {
    stary: 0.1,
    legendary: 1.0,
    'ultra-rare': 3.0,
    'super-rare': 10.0,
    rare: 30.0,
    common: 55.9
  },
  ten: {
    stary: 1.0,
    legendary: 5.0,
    'ultra-rare': 15.0,
    'super-rare': 79.0,
    rare: 0,
    common: 0
  }
};

export default function BasicGachaPage() {
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [result, setResult] = useState<GachaResult | null>(null);
  const [tenPullResults, setTenPullResults] = useState<GachaResult[]>([]);
  const [history, setHistory] = useState<GachaResult[]>([]);
  const [pullType, setPullType] = useState<'single' | 'ten'>('single');
  const [gachaRates, setGachaRates] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);
  const router = useRouter();

  // 会員確認 & ガチャ確率読み込み
  useEffect(() => {
    async function initialize() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push('/');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, premium_until, points')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('プロフィール取得エラー:', profileError);
        }

        if (!profile) {
          setIsAuthorized(false);
          setLoading(false);
          return;
        }

        // 全ユーザーがアクセス可能（通常会員ガチャはポイントで引く）
        setIsAuthorized(true);
        setCurrentPoints(profile.points || 0);
        setIsOwner(profile.role === 'owner');
        await loadGachaRates();
        setLoading(false);
      } catch (error) {
        console.error('エラー:', error);
        setIsAuthorized(false);
        setLoading(false);
      }
    }

    initialize();
  }, []);

  // ガチャ確率読み込み（NaN対策: SupabaseのNUMERIC型が文字列で返る場合がある）
  async function loadGachaRates() {
    try {
      const { data } = await supabase
        .from('basic_gacha_rates')
        .select('*');

      if (data && data.length > 0) {
        const ratesMap: any = {};
        data.forEach(rate => {
          const single = Number(rate.rate);
          const ten = Number(rate.ten_pull_rate);
          ratesMap[rate.rarity] = {
            single: Number.isFinite(single) ? single : 0,
            ten: Number.isFinite(ten) ? ten : 0
          };
        });
        setGachaRates(ratesMap);
      }
    } catch (error) {
      // basic_gacha_ratesテーブルが存在しない場合はデフォルト確率を使用
      console.log('通常会員ガチャ確率テーブルが見つかりません。デフォルト確率を使用します。');
    }
  }

  // ガチャ実行（共通処理）
  async function performGacha(isTenthPull: boolean): Promise<GachaResult> {
    let rates: Record<string, number>;
    if (isTenthPull) {
      rates = gachaRates ? {
        stary: gachaRates['stary']?.ten ?? DEFAULT_RATES.ten.stary,
        legendary: gachaRates['legendary']?.ten ?? DEFAULT_RATES.ten.legendary,
        'ultra-rare': gachaRates['ultra-rare']?.ten ?? DEFAULT_RATES.ten['ultra-rare'],
        'super-rare': gachaRates['super-rare']?.ten ?? DEFAULT_RATES.ten['super-rare'],
        rare: 0,
        common: 0
      } : { ...DEFAULT_RATES.ten };
    } else {
      rates = gachaRates ? {
        stary: gachaRates['stary']?.single ?? DEFAULT_RATES.single.stary,
        legendary: gachaRates['legendary']?.single ?? DEFAULT_RATES.single.legendary,
        'ultra-rare': gachaRates['ultra-rare']?.single ?? DEFAULT_RATES.single['ultra-rare'],
        'super-rare': gachaRates['super-rare']?.single ?? DEFAULT_RATES.single['super-rare'],
        rare: gachaRates['rare']?.single ?? DEFAULT_RATES.single.rare,
        common: gachaRates['common']?.single ?? DEFAULT_RATES.single.common
      } : { ...DEFAULT_RATES.single };
    }
    // NaN対策: 各確率を0以上に正規化
    const safe = (v: number) => (Number.isFinite(v) && v >= 0 ? v : 0);
    rates = {
      stary: safe(rates.stary),
      legendary: safe(rates.legendary),
      'ultra-rare': safe(rates['ultra-rare']),
      'super-rare': safe(rates['super-rare']),
      rare: safe(rates.rare),
      common: safe(rates.common)
    };
    // 合計が0の場合はデフォルト確率を使用
    const total = rates.stary + rates.legendary + rates['ultra-rare'] + rates['super-rare'] + rates.rare + rates.common;
    if (total <= 0) {
      rates = isTenthPull ? { ...DEFAULT_RATES.ten } : { ...DEFAULT_RATES.single };
    }

    const random = Math.random() * 100;
    let cumulative = 0;
    let rarity: Rarity;
    let members: any[];

    // 確率判定
    if (random < (cumulative += rates.stary)) {
      rarity = 'stary';
      members = HST_MEMBERS.stary;
    } else if (random < (cumulative += rates.legendary)) {
      rarity = 'legendary';
      members = HST_MEMBERS.legendary;
    } else if (random < (cumulative += rates['ultra-rare'])) {
      rarity = 'ultra-rare';
      members = HST_MEMBERS.ultraRare;
    } else if (random < (cumulative += rates['super-rare'])) {
      rarity = 'super-rare';
      members = HST_MEMBERS.superRare;
    } else if (isTenthPull) {
      // 10連目はスーパーレア以上確定なので、ここには来ないはずだが念のため
      rarity = 'super-rare';
      members = HST_MEMBERS.superRare;
    } else if (random < (cumulative += rates.rare)) {
      rarity = 'rare';
      members = HST_MEMBERS.rare;
    } else {
      rarity = 'common';
      members = HST_MEMBERS.common;
    }

    const member = members[Math.floor(Math.random() * members.length)];

    return { rarity, member };
  }

  // メンバー保存＆ポイント消費（共通処理）
  async function saveMemberAndConsumePoints(results: GachaResult[], pointCost: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const baseStats: { [key: string]: { hp: number; attack: number; defense: number; speed: number } } = {
      'HST': { hp: 300, attack: 80, defense: 50, speed: 60 },
      'stary': { hp: 200, attack: 50, defense: 30, speed: 40 },
      'legendary': { hp: 150, attack: 35, defense: 20, speed: 25 },
      'ultra-rare': { hp: 120, attack: 25, defense: 15, speed: 20 },
      'super-rare': { hp: 100, attack: 20, defense: 12, speed: 15 },
      'rare': { hp: 80, attack: 15, defense: 10, speed: 12 },
      'common': { hp: 60, attack: 10, defense: 8, speed: 10 }
    };

    // メンバー保存
    for (const result of results) {
      const stats = baseStats[result.rarity] ?? baseStats['common'];
      
      const { error: insertErr } = await supabase
        .from('user_members')
        .insert({
          user_id: user.id,
          member_name: result.member.name,
          member_emoji: result.member.emoji,
          member_description: result.member.description,
          rarity: result.rarity,
          hp: stats.hp,
          max_hp: stats.hp,
          current_hp: stats.hp,
          attack: stats.attack,
          defense: stats.defense,
          speed: stats.speed,
          skill_type: result.member.skill_type || null,
          skill_power: result.member.skill_power || 0
        });
      if (insertErr) {
        console.error('メンバー追加エラー:', insertErr);
        throw new Error(`メンバーの追加に失敗しました: ${insertErr.message}`);
      }
    }

    // ポイント消費
    const newPoints = currentPoints - pointCost;
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ points: newPoints })
      .eq('user_id', user.id);
    if (updateErr) {
      throw new Error(`ポイントの消費に失敗しました: ${updateErr.message}`);
    }

    setCurrentPoints(newPoints);

    // ミッション進捗更新（ガチャを引いた回数分）
    await updateMissionProgress(user.id, 'gacha_pull', results.length);
  }

  // 単発ガチャ
  const spinSingleGacha = async () => {
    if (currentPoints < 30) {
      alert('ポイントが足りません！（ガチャ1回: 30pt）');
      return;
    }

    setIsSpinning(true);
    setResult(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const gachaResult = await performGacha(false);
      await saveMemberAndConsumePoints([gachaResult], 30);

      setResult(gachaResult);
      setHistory([gachaResult, ...history.slice(0, 4)]);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'ガチャに失敗しました');
    } finally {
      setIsSpinning(false);
    }
  };

  // 10連ガチャ
  const spinTenGacha = async () => {
    if (currentPoints < 270) {
      alert('ポイントが足りません！（10連ガチャ: 270pt）');
      return;
    }

    setIsPulling(true);
    setTenPullResults([]);

    try {
      const results: GachaResult[] = [];

      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 300));
        const isLastPull = i === 9;
        const gachaResult = await performGacha(isLastPull);
        results.push(gachaResult);
        setTenPullResults([...results]);
      }

      await saveMemberAndConsumePoints(results, 270);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'ガチャに失敗しました');
      setTenPullResults([]);
    } finally {
      setIsPulling(false);
    }
  };

  // レアリティの色（共通ユーティリティ使用）
  const getRarityColor = (rarity: Rarity) => {
    const base = getRarityColorClass(rarity);
    return (rarity === 'HST' || rarity === 'stary') ? `${base} animate-pulse` : base;
  };

  // 確率表示用
  const displayRates = gachaRates ? {
    single: {
      stary: gachaRates['stary']?.single || DEFAULT_RATES.single.stary,
      legendary: gachaRates['legendary']?.single || DEFAULT_RATES.single.legendary,
      'ultra-rare': gachaRates['ultra-rare']?.single || DEFAULT_RATES.single['ultra-rare'],
      'super-rare': gachaRates['super-rare']?.single || DEFAULT_RATES.single['super-rare'],
      rare: gachaRates['rare']?.single || DEFAULT_RATES.single.rare,
      common: gachaRates['common']?.single || DEFAULT_RATES.single.common
    },
    ten: {
      stary: gachaRates['stary']?.ten || DEFAULT_RATES.ten.stary,
      legendary: gachaRates['legendary']?.ten || DEFAULT_RATES.ten.legendary,
      'ultra-rare': gachaRates['ultra-rare']?.ten || DEFAULT_RATES.ten['ultra-rare'],
      'super-rare': gachaRates['super-rare']?.ten || DEFAULT_RATES.ten['super-rare'],
      rare: gachaRates['rare']?.ten || DEFAULT_RATES.ten.rare,
      common: 0
    }
  } : { single: DEFAULT_RATES.single, ten: DEFAULT_RATES.ten };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-4">アクセス権限がありません</h1>
          <p className="text-gray-600 mb-6">
            このガチャゲームにアクセスする権限がありません。
            <br />
            通常の会員以上でアクセス可能です。
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-lg font-bold hover:opacity-90 transition"
          >
            トップページへ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-cyan-600 p-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center text-white mb-8">
          <div className="inline-block bg-gradient-to-r from-blue-400 to-cyan-400 px-6 py-2 rounded-full font-bold text-lg mb-4">
            🎲 通常会員ガチャ
          </div>
          <h1 className="text-4xl font-bold mb-2">🎰 通常会員ガチャ</h1>
          <p className="text-lg opacity-90">推しメンバーを引き当てよう！</p>
          <div className="text-sm opacity-75 mt-2">単発: 30pt / 10連: 270pt</div>
        </div>

        {/* ポイント表示 */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-2xl">
          <div className="text-center">
            <div className="text-gray-600 mb-2">現在のポイント</div>
            <div className="text-5xl font-bold text-blue-600">{currentPoints}</div>
            <div className="text-sm text-gray-500 mt-2">pt</div>
            {currentPoints < 30 && (
              <div className="mt-3 text-red-500 font-bold">
                ⚠️ ガチャにはあと{30 - currentPoints}pt必要です
              </div>
            )}
          </div>
        </div>

        {/* ガチャマシン */}
        <div className="bg-white rounded-2xl p-8 mb-6 shadow-2xl">
          <div className="text-center">
            {/* タブ切り替え */}
            <div className="flex gap-2 mb-6 justify-center">
              <button
                onClick={() => setPullType('single')}
                className={`px-6 py-3 rounded-lg font-bold transition ${
                  pullType === 'single'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                単発ガチャ
              </button>
              <button
                onClick={() => setPullType('ten')}
                className={`px-6 py-3 rounded-lg font-bold transition ${
                  pullType === 'ten'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
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
                  isSpinning ? 'animate-spin' : ''
                } ${result ? getRarityColor(result.rarity) : 'bg-gradient-to-br from-gray-300 to-gray-400'} shadow-xl`}>
                  {result ? (
                    (() => {
                      const imageUrl = getPlateImageUrl(result.member.name, result.rarity);
                      return imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={result.member.name}
                          width={128}
                          height={128}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-6xl">{result.member.emoji}</span>
                      );
                    })()
                  ) : (
                    <span className="text-6xl">🎰</span>
                  )}
                </div>

                {result && !isSpinning && (
                  <div className="mb-6 animate-fade-in">
                    <div className="bg-white rounded-2xl p-6 shadow-2xl border-4 mx-auto max-w-sm"
                         style={{ borderColor: getRarityBorderColor(result.rarity) }}>
                      <div className="text-center text-sm font-bold text-gray-500 mb-3">🎉 当たり！</div>
                      <div className={`inline-block px-6 py-3 rounded-full text-white font-bold text-xl mb-4 w-full text-center ${getRarityColor(result.rarity)}`}>
                        {getRarityLabel(result.rarity)}
                      </div>
                      {(() => {
                        const imageUrl = getPlateImageUrl(result.member.name, result.rarity);
                        return imageUrl ? (
                          <div className="flex justify-center mb-4">
                            <Image
                              src={imageUrl}
                              alt={result.member.name}
                              width={120}
                              height={120}
                              className="w-28 h-28 object-cover rounded-xl shadow-lg"
                            />
                          </div>
                        ) : (
                          <div className="text-6xl mb-4 text-center">{result.member.emoji}</div>
                        );
                      })()}
                      <div className="text-2xl font-bold mb-2 text-center text-gray-900">{result.member.name}</div>
                      <div className="text-gray-600 mb-3 text-center text-sm">{result.member.description}</div>
                      {result.member.skill_type && (
                        <div className="text-center">
                          <span className="inline-block bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-bold">
                            スキル: {getSkillName(result.member.skill_type)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={spinSingleGacha}
                  disabled={isSpinning || currentPoints < 30}
                  className={`bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-12 py-4 rounded-full text-xl font-bold shadow-lg transition transform ${
                    isSpinning || currentPoints < 30 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:shadow-2xl'
                  }`}
                >
                  {isSpinning ? '抽選中...' : currentPoints < 30 ? 'ポイント不足' : 'ガチャを回す！（30pt）'}
                </button>
                <div className="text-sm text-gray-500 mt-4">
                  ガチャ1回: 30pt消費
                </div>
              </>
            ) : (
              <>
                {/* 10連ガチャUI */}
                <div className="mb-6">
                  <div className="text-4xl mb-4">🎰✨</div>
                  <div className="text-2xl font-bold mb-2">10連ガチャ</div>
                  <div className="text-gray-600 mb-4">10回目はスーパーレア以上確定！</div>
                  
                  {isPulling && (
                    <div className="text-lg text-blue-600 font-bold animate-pulse mb-4">
                      抽選中... {tenPullResults.length}/10
                    </div>
                  )}

                  {tenPullResults.length > 0 && !isPulling && (
                    <div className="mb-6">
                      <div className="text-lg font-bold text-gray-700 mb-4 text-center">🎊 獲得キャラクター</div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        {tenPullResults.map((result, index) => {
                          const imageUrl = getPlateImageUrl(result.member.name, result.rarity);
                          return (
                            <div
                              key={index}
                              className="p-4 rounded-xl border-4 bg-white shadow-xl min-w-[110px]"
                              style={{ borderColor: getRarityBorderColor(result.rarity) }}
                            >
                              {imageUrl ? (
                                <div className="flex justify-center mb-2">
                                  <Image
                                    src={imageUrl}
                                    alt={result.member.name}
                                    width={64}
                                    height={64}
                                    className="w-16 h-16 object-cover rounded-lg"
                                  />
                                </div>
                              ) : (
                                <div className="text-4xl mb-2 text-center">{result.member.emoji}</div>
                              )}
                              <div className={`text-sm font-bold truncate text-center ${result.rarity === 'common' ? 'text-gray-800' : 'text-gray-900'}`}>
                                {result.member.name}
                              </div>
                              <div className={`px-2 py-1 rounded-full mt-2 ${getRarityColor(result.rarity)} text-white text-center font-bold text-xs`}>
                                {getRarityShortLabel(result.rarity)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={spinTenGacha}
                  disabled={isPulling || currentPoints < 270}
                  className={`bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-12 py-4 rounded-full text-xl font-bold shadow-lg transition transform ${
                    isPulling || currentPoints < 270 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:shadow-2xl'
                  }`}
                >
                  {isPulling ? '抽選中...' : currentPoints < 270 ? 'ポイント不足' : '10連ガチャ！（270pt）'}
                </button>
                <div className="text-sm text-green-600 font-bold mt-2">
                  30pt お得！
                </div>
              </>
            )}
          </div>
        </div>

        {/* 確率表示 */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-xl">
          <h3 className="font-bold text-xl mb-2 text-center">
            {pullType === 'single' ? '通常確率' : '10連確率（10回目はスーパーレア以上確定）'}
          </h3>
          <p className="text-sm text-gray-500 mb-4 text-center">★7が最上位、★1が最下位</p>
          <div className="space-y-2">
            {/* HSTはオーナーのみ表示（確率0%） */}
            {isOwner && (
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 rounded-lg text-white">
                <span className="font-bold">{getRarityLabelWithEmoji('HST')}</span>
                <span className="font-bold">0.00%</span>
              </div>
            )}
            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-lg text-white">
              <span className="font-bold">{getRarityLabelWithEmoji('stary')}</span>
              <span className="font-bold">{displayRates[pullType].stary.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg text-white">
              <span className="font-bold">{getRarityLabelWithEmoji('legendary')}</span>
              <span className="font-bold">{displayRates[pullType].legendary.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white">
              <span className="font-bold">{getRarityLabelWithEmoji('ultra-rare')}</span>
              <span>{displayRates[pullType]['ultra-rare'].toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-purple-500 rounded-lg text-white">
              <span>{getRarityLabelWithEmoji('super-rare')}</span>
              <span>{displayRates[pullType]['super-rare'].toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-500 rounded-lg text-white">
              <span>{getRarityLabelWithEmoji('rare')}</span>
              <span>{displayRates[pullType].rare.toFixed(2)}%</span>
            </div>
            {pullType === 'single' && (
              <div className="flex justify-between items-center p-3 bg-gray-500 rounded-lg text-white">
                <span>{getRarityLabelWithEmoji('common')}</span>
                <span>{displayRates.single.common.toFixed(2)}%</span>
              </div>
            )}
          </div>
        </div>

        {/* ポイント不足時の誘導 */}
        {currentPoints < 30 && (
          <div className="bg-yellow-100 border-2 border-yellow-400 rounded-xl p-4 mb-6">
            <div className="text-center">
              <div className="text-2xl mb-2">💡</div>
              <div className="font-bold text-yellow-800 mb-2">ポイントが足りません</div>
              <div className="text-sm text-yellow-700 mb-3">
                ゲームをプレイしてポイントを貯めよう！
              </div>
              <button
                onClick={() => router.push('/games')}
                className="bg-yellow-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-yellow-600 transition"
              >
                ゲームで遊ぶ
              </button>
            </div>
          </div>
        )}

        {/* 履歴 */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-xl">
            <h3 className="font-bold text-xl mb-4">最近の結果</h3>
            <div className="space-y-2">
              {history.map((item, index) => {
                const imageUrl = getPlateImageUrl(item.member.name, item.rarity);
                return (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={item.member.name}
                          width={40}
                          height={40}
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <span className="text-2xl">{item.member.emoji}</span>
                      )}
                      <div>
                        <div className="font-bold">{item.member.name}</div>
                        <span className={`px-3 py-1 rounded-full text-white text-xs font-bold ${getRarityColor(item.rarity)}`}>
                          {getRarityLabel(item.rarity)}
                        </span>
                      </div>
                    </div>
                    <span className="text-red-500 font-bold">-30pt</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 戻るボタン */}
        <div className="text-center mt-8">
          <button
            onClick={() => router.push('/')}
            className="bg-white text-blue-600 px-8 py-3 rounded-full font-bold hover:bg-gray-100 transition"
          >
            トップページに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
