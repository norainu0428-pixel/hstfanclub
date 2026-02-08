'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { updateMissionProgress } from '@/utils/missionTracker';
import { getSkillName } from '@/utils/skills';

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

// HSTメンバーデータ（スキル情報追加）
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
  superRare: [
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

// デフォルト確率
const DEFAULT_RATES = {
  single: {
    stary: 0.05,
    legendary: 1.0,
    'ultra-rare': 4.0,
    'super-rare': 10.0,
    rare: 25.0,
    common: 59.95
  },
  ten: {
    stary: 0.1,
    legendary: 5.0,
    'ultra-rare': 15.0,
    'super-rare': 30.0,
    rare: 49.9,
    common: 0
  }
};

export default function PremiumGachaPage() {
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
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

  // プレミアム会員確認 & ガチャ確率読み込み
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
          .select('role, points, premium_until')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('プロフィール取得エラー:', profileError);
        }

        if (!profile) {
          setIsPremium(false);
          setLoading(false);
          return;
        }

        // ownerは常にアクセス可能（roleは大文字小文字を区別しない）
        const role = (profile.role || '').toString().toLowerCase();
        if (role === 'owner') {
          setIsPremium(true);
          setCurrentPoints(profile.points || 0);
          setIsOwner(true);
        } 
        // premiumの場合はpremium_untilをチェック
        else if (role === 'premium') {
          if (profile.premium_until) {
            const premiumDate = new Date(profile.premium_until);
            const today = new Date();
            if (premiumDate > today) {
              setIsPremium(true);
              setCurrentPoints(profile.points || 0);
            } else {
              setIsPremium(false);
            }
          } else {
            setIsPremium(false);
          }
        } else {
          setIsPremium(false);
        }

        // ガチャ確率読み込み
        await loadGachaRates();
        
        setLoading(false);
      } catch (error) {
        console.error('エラー:', error);
        setIsPremium(false);
        setLoading(false);
      }
    }

    initialize();
  }, []);

  // ガチャ確率読み込み
  async function loadGachaRates() {
    try {
      const { data } = await supabase
        .from('gacha_rates')
        .select('*');

      if (data && data.length > 0) {
        const ratesMap: any = {};
        data.forEach(rate => {
          ratesMap[rate.rarity] = {
            single: parseFloat(rate.rate),
            ten: parseFloat(rate.ten_pull_rate)
          };
        });
        setGachaRates(ratesMap);
      }
    } catch (error) {
      // gacha_ratesテーブルが存在しない場合はデフォルト確率を使用
      console.log('ガチャ確率テーブルが見つかりません。デフォルト確率を使用します。');
    }
  }

  // ガチャ実行（共通処理）
  async function performGacha(guaranteedRare: boolean): Promise<GachaResult> {
    const rates = guaranteedRare ? 
      (gachaRates ? {
        stary: gachaRates['stary']?.ten || DEFAULT_RATES.ten.stary,
        legendary: gachaRates['legendary']?.ten || DEFAULT_RATES.ten.legendary,
        'ultra-rare': gachaRates['ultra-rare']?.ten || DEFAULT_RATES.ten['ultra-rare'],
        'super-rare': gachaRates['super-rare']?.ten || DEFAULT_RATES.ten['super-rare'],
        rare: gachaRates['rare']?.ten || DEFAULT_RATES.ten.rare,
        common: 0
      } : DEFAULT_RATES.ten) :
      (gachaRates ? {
        stary: gachaRates['stary']?.single || DEFAULT_RATES.single.stary,
        legendary: gachaRates['legendary']?.single || DEFAULT_RATES.single.legendary,
        'ultra-rare': gachaRates['ultra-rare']?.single || DEFAULT_RATES.single['ultra-rare'],
        'super-rare': gachaRates['super-rare']?.single || DEFAULT_RATES.single['super-rare'],
        rare: gachaRates['rare']?.single || DEFAULT_RATES.single.rare,
        common: gachaRates['common']?.single || DEFAULT_RATES.single.common
      } : DEFAULT_RATES.single);

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

  // ヘルパー関数
  function getRarityBorderColor(rarity: Rarity): string {
    const colors: any = {
      'HST': '#f59e0b',
      'stary': '#ec4899',
      'legendary': '#f59e0b',
      'ultra-rare': '#a855f7',
      'super-rare': '#8b5cf6',
      'rare': '#3b82f6',
      'common': '#6b7280'
    };
    return colors[rarity] || '#6b7280';
  }

  function getRarityShortName(rarity: Rarity): string {
    const names: any = {
      'HST': 'HST',
      'stary': 'STARY',
      'legendary': 'L',
      'ultra-rare': 'UR',
      'super-rare': 'SR',
      'rare': 'R',
      'common': 'C'
    };
    return names[rarity] || 'C';
  }

  // 単発ガチャ
  const spinSingleGacha = async () => {
    if (currentPoints < 50) {
      alert('ポイントが足りません！（ガチャ1回: 50pt）');
      return;
    }

    setIsSpinning(true);
    setResult(null);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const gachaResult = await performGacha(false);
    
    // メンバー保存とポイント消費
    await saveMemberAndConsumePoints([gachaResult], 50);

    setResult(gachaResult);
    setHistory([gachaResult, ...history.slice(0, 4)]);
    setIsSpinning(false);
  };

  // メンバー保存＆ポイント消費（共通処理）
  async function saveMemberAndConsumePoints(results: GachaResult[], pointCost: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const baseStats: { [key: string]: { hp: number; attack: number; defense: number; speed: number } } = {
      'HST': { hp: 300, attack: 100, defense: 50, speed: 60 },
      'stary': { hp: 200, attack: 65, defense: 30, speed: 40 },
      'legendary': { hp: 150, attack: 45, defense: 20, speed: 25 },
      'ultra-rare': { hp: 120, attack: 35, defense: 15, speed: 20 },
      'super-rare': { hp: 100, attack: 28, defense: 12, speed: 15 },
      'rare': { hp: 80, attack: 22, defense: 10, speed: 12 },
      'common': { hp: 60, attack: 16, defense: 8, speed: 10 }
    };

    // メンバー保存
    for (const result of results) {
      const stats = baseStats[result.rarity];
      
      await supabase
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
    }

    // ポイント消費
    const newPoints = currentPoints - pointCost;
    await supabase
      .from('profiles')
      .update({ points: newPoints })
      .eq('user_id', user.id);

    setCurrentPoints(newPoints);

    // ミッション進捗更新（ガチャを引いた回数分）
    await updateMissionProgress(user.id, 'gacha_pull', results.length);
  }

  // 10連ガチャ
  const spinTenGacha = async () => {
    if (currentPoints < 450) {
      alert('ポイントが足りません！（10連ガチャ: 450pt）');
      return;
    }

    setIsPulling(true);
    setTenPullResults([]);

    const results: GachaResult[] = [];

    // 10回ガチャを引く
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 10回目はレア以上確定
      const isLastPull = i === 9;
      const gachaResult = await performGacha(isLastPull);
      results.push(gachaResult);
      setTenPullResults([...results]);
    }

    // メンバー保存とポイント消費
    await saveMemberAndConsumePoints(results, 450);
    setIsPulling(false);
  };

  // レアリティの色
  const getRarityColor = (rarity: Rarity) => {
    switch (rarity) {
      case 'HST': return 'bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 animate-pulse';
      case 'stary': return 'bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 animate-pulse';
      case 'legendary': return 'bg-gradient-to-r from-yellow-400 to-orange-500';
      case 'ultra-rare': return 'bg-gradient-to-r from-purple-500 to-pink-500';
      case 'super-rare': return 'bg-purple-500';
      case 'rare': return 'bg-blue-500';
      case 'common': return 'bg-gray-400';
    }
  };

  const getRarityBorder = (rarity: Rarity) => {
    switch (rarity) {
      case 'HST': return 'border-yellow-400';
      case 'stary': return 'border-pink-500';
      case 'legendary': return 'border-yellow-500';
      case 'ultra-rare': return 'border-purple-500';
      case 'super-rare': return 'border-purple-400';
      case 'rare': return 'border-blue-400';
      case 'common': return 'border-gray-400';
    }
  };

  const getRarityName = (rarity: Rarity) => {
    switch (rarity) {
      case 'HST': return '👑 HST';
      case 'stary': return '🌠 STARY!!!';
      case 'legendary': return 'レジェンド';
      case 'ultra-rare': return 'ウルトラレア';
      case 'super-rare': return 'スーパーレア';
      case 'rare': return 'レア';
      case 'common': return 'コモン';
    }
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
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-4">プレミアム会員限定</h1>
          <p className="text-gray-600 mb-6">
            このガチャゲームはプレミアム会員専用です。
            <br />
            プレミアム会員になってお楽しみください！
          </p>
          <button
            onClick={() => router.push('/premium')}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-lg font-bold hover:opacity-90 transition"
          >
            プレミアムページへ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center text-white mb-8">
          <div className="inline-block bg-gradient-to-r from-yellow-400 to-orange-500 px-6 py-2 rounded-full font-bold text-lg mb-4">
            💎 プレミアム限定ガチャ
          </div>
          <h1 className="text-4xl font-bold mb-2">HSTメンバーガチャ</h1>
          <p className="text-lg opacity-90">推しメンバーを引き当てよう！</p>
        </div>

        {/* ポイント表示 */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-2xl">
          <div className="text-center">
            <div className="text-gray-600 mb-2">現在のポイント</div>
            <div className="text-5xl font-bold text-purple-600">{currentPoints}</div>
            <div className="text-sm text-gray-500 mt-2">pt</div>
            {currentPoints < 50 && (
              <div className="mt-3 text-red-500 font-bold">
                ⚠️ ガチャにはあと{50 - currentPoints}pt必要です
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
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                単発ガチャ
              </button>
              <button
                onClick={() => setPullType('ten')}
                className={`px-6 py-3 rounded-lg font-bold transition ${
                  pullType === 'ten'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                10連ガチャ
              </button>
            </div>

            {pullType === 'single' ? (
              <>
                {/* 単発ガチャUI */}
                <div className={`w-32 h-32 mx-auto mb-6 rounded-full flex items-center justify-center text-6xl ${
                  isSpinning ? 'animate-spin' : ''
                } ${result ? getRarityColor(result.rarity) : 'bg-gradient-to-br from-gray-300 to-gray-400'} shadow-xl`}>
                  {result ? result.member.emoji : '🎰'}
                </div>

                {result && !isSpinning && (
                  <div className="mb-6 animate-fade-in">
                    <div className={`inline-block px-6 py-3 rounded-full text-white font-bold text-xl mb-3 ${getRarityColor(result.rarity)}`}>
                      {getRarityName(result.rarity)}
                    </div>
                    <div className="text-4xl mb-2">{result.member.emoji}</div>
                    <div className="text-2xl font-bold mb-2">{result.member.name}</div>
                    <div className="text-gray-600 mb-2">{result.member.description}</div>
                    {result.member.skill_type && (
                      <div className="mt-2 inline-block bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-bold">
                        スキル: {getSkillName(result.member.skill_type)}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={spinSingleGacha}
                  disabled={isSpinning || currentPoints < 50}
                  className={`bg-gradient-to-r from-purple-500 to-pink-500 text-white px-12 py-4 rounded-full text-xl font-bold shadow-lg transition transform ${
                    isSpinning || currentPoints < 50 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:shadow-2xl'
                  }`}
                >
                  {isSpinning ? '抽選中...' : currentPoints < 50 ? 'ポイント不足' : 'ガチャを回す！（50pt）'}
                </button>
                <div className="text-sm text-gray-500 mt-4">
                  ガチャ1回: 50pt消費
                </div>
              </>
            ) : (
              <>
                {/* 10連ガチャUI */}
                <div className="mb-6">
                  <div className="text-4xl mb-4">🎰✨</div>
                  <div className="text-2xl font-bold mb-2">10連ガチャ</div>
                  <div className="text-gray-600 mb-4">10回目はレア以上確定！</div>
                  
                  {isPulling && (
                    <div className="text-lg text-purple-600 font-bold animate-pulse mb-4">
                      抽選中... {tenPullResults.length}/10
                    </div>
                  )}

                  {tenPullResults.length > 0 && !isPulling && (
                    <div className="grid grid-cols-5 gap-3 mb-6">
                      {tenPullResults.map((result, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg border-2 bg-white shadow-lg"
                          style={{ borderColor: getRarityBorderColor(result.rarity) }}
                        >
                          <div className="text-3xl mb-1">{result.member.emoji}</div>
                          <div className="text-xs font-bold truncate">{result.member.name}</div>
                          <div className={`text-xs px-2 py-1 rounded-full mt-1 ${getRarityColor(result.rarity)} text-white text-center`}>
                            {getRarityShortName(result.rarity)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={spinTenGacha}
                  disabled={isPulling || currentPoints < 450}
                  className={`bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-12 py-4 rounded-full text-xl font-bold shadow-lg transition transform ${
                    isPulling || currentPoints < 450 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:shadow-2xl'
                  }`}
                >
                  {isPulling ? '抽選中...' : currentPoints < 450 ? 'ポイント不足' : '10連ガチャ！（450pt）'}
                </button>
                <div className="text-sm text-green-600 font-bold mt-2">
                  50pt お得！
                </div>
              </>
            )}
          </div>
        </div>

        {/* 確率表示 */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-xl">
          <h3 className="font-bold text-xl mb-4 text-center">
            {pullType === 'single' ? '通常確率' : '10連確率（10回目はレア以上確定）'}
          </h3>
          <div className="space-y-2">
            {/* HSTはオーナーのみ表示（確率0%） */}
            {isOwner && (
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 rounded-lg text-white">
                <span className="font-bold">👑 HST</span>
                <span className="font-bold">0.00%</span>
              </div>
            )}
            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-lg text-white">
              <span className="font-bold">🌠 STARY</span>
              <span className="font-bold">{displayRates[pullType].stary.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg text-white">
              <span className="font-bold">🏆 レジェンド</span>
              <span className="font-bold">{displayRates[pullType].legendary.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white">
              <span className="font-bold">💎 ウルトラレア</span>
              <span>{displayRates[pullType]['ultra-rare'].toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-purple-500 rounded-lg text-white">
              <span>⭐ スーパーレア</span>
              <span>{displayRates[pullType]['super-rare'].toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-500 rounded-lg text-white">
              <span>✨ レア</span>
              <span>{displayRates[pullType].rare.toFixed(2)}%</span>
            </div>
            {pullType === 'single' && (
              <div className="flex justify-between items-center p-3 bg-gray-400 rounded-lg text-white">
                <span>📦 コモン</span>
                <span>{displayRates.single.common.toFixed(2)}%</span>
              </div>
            )}
          </div>
        </div>

        {/* ポイント不足時の誘導 */}
        {currentPoints < 50 && (
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
              {history.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{item.member.emoji}</span>
                    <div>
                      <div className="font-bold">{item.member.name}</div>
                      <span className={`px-3 py-1 rounded-full text-white text-xs font-bold ${getRarityColor(item.rarity)}`}>
                        {getRarityName(item.rarity)}
                      </span>
                    </div>
                  </div>
                  <span className="text-red-500 font-bold">-50pt</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 戻るボタン */}
        <div className="text-center mt-8">
          <button
            onClick={() => router.push('/premium')}
            className="bg-white text-purple-600 px-8 py-3 rounded-full font-bold hover:bg-gray-100 transition"
          >
            プレミアムページに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
