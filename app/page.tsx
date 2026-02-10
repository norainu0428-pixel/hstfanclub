'use client';
/**
 * トップページ
 * 実装メモ:
 * - ログイン: Discord OAuth。redirectTo は window.location.origin で本番対応。
 * - ログイン失敗時: auth_error をクエリで受け取りエラー表示。
 * - プロフィール未作成時: 「プロフィールを作成」ボタンで再試行（display_name に global_name も使用）。
 * - お知らせ: announcements の is_active=true を表示。
 * - 装備・ランキング・通常ガチャ・イベントガチャ（オーナーのみ）等のメニュー。
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { initializeDailyMissions } from '@/utils/missionTracker';

type Profile = {
  user_id: string;
  display_name: string | null;
  role: "owner" | "staff" | "premium" | "member";
  points: number;
  membership_tier?: string | null;
};

export default function Home() {
  console.log('=== Home コンポーネント レンダリング開始 ===');
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<{ id: string; title: string; body: string | null }[]>([]);
  const [profileError, setProfileError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  console.log('State - loading:', loading);
  console.log('State - user:', user?.id);
  console.log('State - profile:', profile?.role);

  // 初期キャラクター付与（新規ユーザー向け）
  async function giveStarterCharacters(userId: string) {
    try {
      // 既存のキャラクターをチェック
      const { data: existingMembers } = await supabase
        .from('user_members')
        .select('*')
        .eq('user_id', userId);

      // 既にキャラクターがいる場合はスキップ
      if (existingMembers && existingMembers.length > 0) {
        return;
      }

      // 初期キャラクター（common レアリティ）
      const starterCharacters = [
        { 
          name: 'smile', 
          emoji: '😊', 
          description: 'チームリーダー',
          rarity: 'common',
          hp: 60,
          attack: 10,
          defense: 8,
          speed: 10
        },
        { 
          name: 'zerom', 
          emoji: '⚡', 
          description: 'エースプレイヤー',
          rarity: 'common',
          hp: 60,
          attack: 10,
          defense: 8,
          speed: 10
        },
        { 
          name: 'shunkoro', 
          emoji: '🔥', 
          description: 'ストラテジスト',
          rarity: 'common',
          hp: 60,
          attack: 10,
          defense: 8,
          speed: 10
        }
      ];

      // 初期キャラクターを付与（エラーチェック付き）
      const insertResults = await Promise.all(
        starterCharacters.map(char =>
          supabase
            .from('user_members')
            .insert({
              user_id: userId,
              member_name: char.name,
              member_emoji: char.emoji,
              member_description: char.description,
              rarity: char.rarity,
              level: 1,
              experience: 0,
              hp: char.hp,
              max_hp: char.hp,
              current_hp: char.hp,
              attack: char.attack,
              defense: char.defense,
              speed: char.speed,
              skill_type: null,
              skill_power: 0
            })
        )
      );

      // エラーチェック
      const errors = insertResults.filter(result => result.error);
      if (errors.length > 0) {
        console.error('初期キャラクター付与エラー:', errors);
        // エラーが発生した場合でも、成功したキャラクターは付与されている
      } else {
        console.log(`✅ 初期キャラクター付与: smile, zerom, shunkoro を付与しました`);
      }
    } catch (error) {
      console.error('初期キャラクター付与エラー:', error);
    }
  }

  // オーナー初期特典チェック
  async function checkOwnerBonuses(userId: string) {
    try {
      // 既存のSTARYをチェック
      const { data: existingStary } = await supabase
        .from('user_members')
        .select('*')
        .eq('user_id', userId)
        .eq('member_name', 'STARY');

      const currentCount = existingStary?.length || 0;

      if (currentCount < 3) {
        // Lv500 STARYのステータス計算
        const level = 500;
        const levelUps = level - 1; // 499回レベルアップ
        
        const baseStats = {
          hp: 200,
          attack: 50,
          defense: 30,
          speed: 40
        };

        const growthPerLevel = {
          hp: 20,
          attack: 5,
          defense: 4,
          speed: 4
        };

        const finalStats = {
          hp: baseStats.hp + (levelUps * growthPerLevel.hp),
          attack: baseStats.attack + (levelUps * growthPerLevel.attack),
          defense: baseStats.defense + (levelUps * growthPerLevel.defense),
          speed: baseStats.speed + (levelUps * growthPerLevel.speed)
        };

        const staryToAdd = 3 - currentCount;

        for (let i = 0; i < staryToAdd; i++) {
          await supabase
            .from('user_members')
            .insert({
              user_id: userId,
              member_name: 'STARY',
              member_emoji: '🌠',
              member_description: '伝説のマスコット',
              rarity: 'stary',
              level: level,
              experience: 0,
              hp: finalStats.hp,
              max_hp: finalStats.hp,
              current_hp: finalStats.hp,
              attack: finalStats.attack,
              defense: finalStats.defense,
              speed: finalStats.speed,
              skill_type: 'revive',
              skill_power: 1,
              revive_used: false
            });
        }

        console.log(`✅ オーナー特典: Lv${level} STARYを${staryToAdd}体付与しました`);
      }
    } catch (error) {
      console.error('オーナー特典チェックエラー:', error);
    }
  }

  useEffect(() => {
    console.log('>>> useEffect 開始');
    
    // 強制タイムアウト（5秒）
    const timeout = setTimeout(() => {
      console.log('!!! タイムアウト: 強制的にloading終了 !!!');
      setLoading(false);
    }, 5000);
    
    const fetchProfile = async () => {
      console.log('  fetchProfile: 開始');

      try {
        console.log('  fetchProfile: getUser 呼び出し');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.log('  fetchProfile: getUser 完了', { userId: user?.id, error: userError });

        if (userError) {
          console.error('  fetchProfile: getUser エラー', userError);
          clearTimeout(timeout);
          setLoading(false);
          return;
        }

        if (!user) {
          console.log('  fetchProfile: ユーザーなし → loading終了');
          clearTimeout(timeout);
          setLoading(false);
          return;
        }

        console.log('  fetchProfile: profiles取得 開始');
        let { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        console.log('  fetchProfile: profiles取得 完了', {
          profile: profile,
          error: profileError
        });

        // プロフィールが存在しない場合は自動作成
        if (!profile && (profileError?.code === 'PGRST116' || !profileError)) {
          console.log('  fetchProfile: プロフィールが存在しないため自動作成');
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              user_id: user.id,
              display_name: user.user_metadata?.full_name || user.user_metadata?.global_name || user.user_metadata?.name || user.email?.split('@')[0] || 'ユーザー',
              role: 'member',
              points: 0,
              membership_tier: null
            })
            .select()
            .single();

          if (createError) {
            console.error('  fetchProfile: プロフィール作成エラー', createError);
            setProfileError(createError.message);
          } else {
            profile = newProfile;
            setProfileError(null);
            console.log('  fetchProfile: プロフィール作成完了', profile);
          }
        } else if (profileError && profileError.code !== 'PGRST116') {
          console.error('  fetchProfile: profilesエラー', profileError);
          setProfileError(profileError.message);
        } else {
          setProfileError(null);
        }

        console.log('  fetchProfile: State更新');
        setUser(user);
        setProfile(profile ?? null);

        // 初期キャラクター付与（新規ユーザー向け）
        await giveStarterCharacters(user.id);

        // デイリーミッション初期化
        await initializeDailyMissions(user.id);

        // オーナー初期特典チェック（profileがnullの場合はスキップ）
        if (profile != null && profile.role === 'owner') {
          await checkOwnerBonuses(user.id);
        }

        clearTimeout(timeout);
        setLoading(false);
        console.log('  fetchProfile: 完了');
      } catch (error) {
        console.error('  fetchProfile: 例外発生', error);
        clearTimeout(timeout);
        setLoading(false);
      }
    };

    fetchProfile();
    console.log('>>> useEffect 終了（fetchProfile呼び出し済み）');
    
    // クリーンアップ関数
    return () => {
      console.log('>>> useEffect クリーンアップ');
      clearTimeout(timeout);
    };
  }, []); // 依存配列は空

  useEffect(() => {
    supabase.from('announcements').select('id, title, body').eq('is_active', true).order('created_at', { ascending: false })
      .then(({ data }) => setAnnouncements(data || []));
  }, []);

  console.log('=== レンダリング: loading =', loading);

  if (loading) {
    console.log('=== 描画: 読み込み中 ===');
    return (
      <div className="min-h-screen flex items-center justify-center bg-black safe-area-inset">
        <p className="text-orange-500 text-lg">読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    const authError = searchParams.get('auth_error');
    console.log('=== 描画: ログインボタン ===');
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black p-8 safe-area-inset">
        <h1 className="text-3xl font-bold text-orange-500 mb-8">HSTファンクラブ</h1>
        {authError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-900/30 border border-red-500/50 max-w-md text-center">
            <p className="text-red-300 font-bold">ログインに失敗しました</p>
            <p className="text-red-200 text-sm mt-2">{decodeURIComponent(authError)}</p>
            <p className="text-gray-400 text-xs mt-2">Discordの権限を確認するか、別のブラウザでお試しください</p>
          </div>
        )}
        <button
          onClick={async () => {
            console.log('Discordログイン開始');
            const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
            await supabase.auth.signInWithOAuth({
              provider: 'discord',
              options: { redirectTo: `${baseUrl || 'http://localhost:3000'}/auth/callback` },
            });
          }}
          className="w-full max-w-xs py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold active:scale-[0.98] transition shadow-lg"
        >
          Discordでログイン
        </button>
      </div>
    );
  }

  // ログイン済みだがプロフィール取得/作成に失敗（一部メンバーがログインできない原因）
  async function retryCreateProfile() {
    setProfileError(null);
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return;
    const { data: newProfile, error } = await supabase
      .from('profiles')
      .insert({
        user_id: u.id,
        display_name: u.user_metadata?.full_name || u.user_metadata?.global_name || u.user_metadata?.name || u.email?.split('@')[0] || 'ユーザー',
        role: 'member',
        points: 0,
        membership_tier: null
      })
      .select()
      .single();
    if (error) {
      setProfileError(error.message);
      return;
    }
    setProfile(newProfile);
    setProfileError(null);
  }

  if (user && !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black p-8 safe-area-inset">
        <h1 className="text-3xl font-bold mb-6 text-orange-500">HSTファンクラブ</h1>
        <div className="rounded-2xl border border-orange-500/30 bg-white/5 p-6 max-w-md w-full backdrop-blur-sm">
          <p className="text-orange-400 font-bold mb-2">プロフィールの設定が必要です</p>
          <p className="text-gray-300 text-sm mb-4">
            一部のメンバーでログインできない場合、プロフィールの自動作成に失敗している可能性があります。下のボタンで再試行してください。
          </p>
          {profileError && (
            <p className="text-red-400 text-sm mb-4">エラー: {profileError}</p>
          )}
          <button
            onClick={retryCreateProfile}
            className="w-full py-3 rounded-2xl bg-orange-500 text-white font-bold active:scale-[0.98] transition"
          >
            プロフィールを作成
          </button>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.refresh(); }}
            className="w-full mt-3 py-2 text-gray-400 hover:text-white"
          >
            ログアウト
          </button>
        </div>
      </div>
    );
  }

  console.log('=== 描画: メイン画面 ===');
  return (
    <div className="min-h-screen px-4 py-6 max-w-lg mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-orange-500">HSTファンクラブ</h1>
      </header>
      
      {announcements.length > 0 && (
        <div className="mb-4 space-y-2">
          {announcements.map(a => (
            <div key={a.id} className="rounded-2xl border border-orange-500/30 bg-orange-950/30 p-4">
              <p className="font-bold text-orange-400">{a.title}</p>
              {a.body && <p className="text-gray-300 text-sm mt-1">{a.body}</p>}
            </div>
          ))}
        </div>
      )}
      
      {profile ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-5 backdrop-blur-sm">
          <p className="text-white">ようこそ、<span className="text-orange-500 font-bold">{profile.display_name}</span>さん</p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-orange-500 font-bold text-lg">{profile.points}pt</span>
            <span className="text-gray-400 text-sm">{profile.role}</span>
          </div>
        </div>
      ) : (
        <p className="text-orange-500 mb-4">プロフィールが見つかりません</p>
      )}
      
      {profile && (
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => router.push('/adventure')}
            className="rounded-2xl p-4 bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold text-left shadow-lg active:scale-[0.98] transition touch-target"
          >
            <span className="text-3xl block mb-1">🗺️</span>
            <span className="text-sm">冒険</span>
          </button>
          <button 
            onClick={() => router.push('/party')}
            className="rounded-2xl p-4 bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold text-left shadow-lg active:scale-[0.98] transition touch-target"
          >
            <span className="text-3xl block mb-1">🎪</span>
            <span className="text-sm">パーティー</span>
          </button>
          <button 
            onClick={() => router.push('/games')}
            className="rounded-2xl p-4 bg-gradient-to-br from-purple-500 to-pink-600 text-white font-bold text-left shadow-lg active:scale-[0.98] transition touch-target"
          >
            <span className="text-3xl block mb-1">🎮</span>
            <span className="text-sm">ゲーム</span>
          </button>
          <button 
            onClick={() => router.push('/friends')}
            className="rounded-2xl p-4 bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold text-left shadow-lg active:scale-[0.98] transition touch-target"
          >
            <span className="text-3xl block mb-1">👥</span>
            <span className="text-sm">フレンド</span>
          </button>
          <button 
            onClick={() => router.push('/ranking')}
            className="rounded-2xl p-4 bg-gradient-to-br from-yellow-500 to-amber-600 text-white font-bold text-left shadow-lg active:scale-[0.98] transition touch-target"
          >
            <span className="text-3xl block mb-1">🏆</span>
            <span className="text-sm">ランキング</span>
          </button>
          <button 
            onClick={() => router.push('/missions')}
            className="rounded-2xl p-4 bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold text-left shadow-lg active:scale-[0.98] transition touch-target"
          >
            <span className="text-3xl block mb-1">📋</span>
            <span className="text-sm">ミッション</span>
          </button>
          <button 
            onClick={() => router.push('/adventure?mode=tower')}
            className="rounded-2xl p-4 bg-gradient-to-br from-red-600 to-purple-700 text-white font-bold text-left shadow-lg active:scale-[0.98] transition touch-target"
          >
            <span className="text-3xl block mb-1">🏯</span>
            <span className="text-sm">覇者の塔</span>
          </button>
          <button 
            onClick={() => router.push('/adventure?mode=riemu_event')}
            className="rounded-2xl p-4 bg-gradient-to-br from-pink-500 to-red-600 text-white font-bold text-left shadow-lg active:scale-[0.98] transition touch-target"
          >
            <span className="text-3xl block mb-1">✨</span>
            <span className="text-sm">イベントステージ</span>
          </button>
          <button 
            onClick={() => router.push('/equipment')}
            className="rounded-2xl p-4 bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-left shadow-lg active:scale-[0.98] transition touch-target"
          >
            <span className="text-3xl block mb-1">🛡️</span>
            <span className="text-sm">装備</span>
          </button>
          
          {(profile.membership_tier === 'basic' || profile.membership_tier === 'premium' || profile.role === 'member' || profile.role === 'owner' || profile.role === 'staff' || !profile.membership_tier) && (
            <>
              <button onClick={() => router.push('/basic/gacha')} className="rounded-2xl p-4 bg-gradient-to-br from-amber-500 to-yellow-600 text-white font-bold text-left shadow-lg active:scale-[0.98] transition touch-target">
                <span className="text-2xl block mb-1">🎲</span>
                <span className="text-sm">通常ガチャ</span>
              </button>
              <button onClick={() => router.push('/events')} className="rounded-2xl p-4 bg-gradient-to-br from-orange-500 to-red-500 text-white font-bold text-left shadow-lg active:scale-[0.98] transition touch-target">
                <span className="text-2xl block mb-1">🎪</span>
                <span className="text-sm">HST Smileガチャ</span>
              </button>
            </>
          )}
          {(profile.membership_tier === 'premium' || profile.role === 'premium' || profile.role === 'owner') && (
            <>
              {profile.membership_tier === 'premium' && (
                <button onClick={() => router.push('/premium/gacha')} className="rounded-2xl p-4 bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold text-left shadow-lg active:scale-[0.98] transition touch-target">
                  <span className="text-2xl block mb-1">🎰</span>
                  <span className="text-sm">プレミアムガチャ</span>
                </button>
              )}
              <button onClick={() => router.push('/premium')} className="rounded-2xl p-4 bg-gradient-to-br from-amber-600 to-orange-600 text-white font-bold text-left shadow-lg active:scale-[0.98] transition touch-target">
                <span className="text-2xl block mb-1">👑</span>
                <span className="text-sm">プレミアム</span>
              </button>
            </>
          )}
          {profile.role === 'owner' && (
            <>
              <button onClick={() => router.push('/admin')} className="rounded-2xl p-4 bg-gradient-to-br from-red-600 to-red-700 text-white font-bold text-left shadow-lg active:scale-[0.98] transition touch-target">
                <span className="text-2xl block mb-1">⚙️</span>
                <span className="text-sm">管理</span>
              </button>
              <button onClick={() => router.push('/admin/distribute-hst')} className="rounded-2xl p-4 bg-gradient-to-br from-amber-600 to-orange-600 text-white font-bold text-left shadow-lg active:scale-[0.98] transition touch-target col-span-2">
                <span className="text-2xl mr-2">😊</span> HST配布
              </button>
            </>
          )}
          {profile.role === 'staff' && (
            <button onClick={() => router.push('/admin')} className="rounded-2xl p-4 bg-gradient-to-br from-red-600 to-red-700 text-white font-bold text-left shadow-lg active:scale-[0.98] transition touch-target col-span-2">
              <span className="text-2xl mr-2">⚙️</span> 管理画面
            </button>
          )}
        </div>
      )}
      
      <button
        onClick={async () => {
          console.log('ログアウト開始');
          await supabase.auth.signOut();
          window.location.reload();
        }}
        className="mt-6 w-full py-3 rounded-2xl bg-white/10 text-gray-400 border border-white/10 font-bold"
      >
        ログアウト
      </button>
    </div>
  );
}
