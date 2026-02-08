'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { initializeDailyMissions } from '@/utils/missionTracker';
import { generateMemberStatsWithIV } from '@/utils/memberStats';

type Profile = {
  user_id: string;
  display_name: string | null;
  role: "owner" | "staff" | "premium" | "member";
  points: number;
  membership_tier?: string | null;
};

type Announcement = {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

export default function Home() {
  console.log('=== Home コンポーネント レンダリング開始 ===');
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();

  // 認証コールバックエラーをURLから取得
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('error');
      if (err) {
        setAuthError(decodeURIComponent(err));
        window.history.replaceState({}, '', '/');
      }
    }
  }, []);
  
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

      // 初期キャラクター（common レアリティ、個体値・才能値を付与）
      const starterCharacters = [
        { name: 'smile', emoji: '😊', description: 'チームリーダー', rarity: 'common' as const },
        { name: 'zerom', emoji: '⚡', description: 'エースプレイヤー', rarity: 'common' as const },
        { name: 'shunkoro', emoji: '🔥', description: 'ストラテジスト', rarity: 'common' as const }
      ];
      const baseStats = { hp: 60, attack: 10, defense: 8, speed: 10 };

      const insertResults = await Promise.all(
        starterCharacters.map(char => {
          const statsWithIV = generateMemberStatsWithIV(baseStats);
          return supabase
            .from('user_members')
            .insert({
              user_id: userId,
              member_name: char.name,
              member_emoji: char.emoji,
              member_description: char.description,
              rarity: char.rarity,
              level: 1,
              experience: 0,
              hp: statsWithIV.hp,
              max_hp: statsWithIV.hp,
              current_hp: statsWithIV.hp,
              attack: statsWithIV.attack,
              defense: statsWithIV.defense,
              speed: statsWithIV.speed,
              skill_type: null,
              skill_power: 0,
              individual_hp: statsWithIV.individual_hp,
              individual_atk: statsWithIV.individual_atk,
              individual_def: statsWithIV.individual_def,
              individual_spd: statsWithIV.individual_spd,
              talent_value: statsWithIV.talent_value
            });
        })
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
              revive_used: false,
              individual_hp: 0,
              individual_atk: 0,
              individual_def: 0,
              individual_spd: 0,
              talent_value: 50
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
      try {
        // getSession を先に試す（未ログイン時は getUser が AuthSessionMissingError を投げる場合がある）
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;

        if (!user) {
          clearTimeout(timeout);
          setLoading(false);
          return;
        }

        console.log('  fetchProfile: profiles取得 開始');
        // RPC関数を優先（RLSをバイパス、SQLでget_my_profileを作成済みの場合）
        let { data: profileData, error: rpcError } = await supabase.rpc('get_my_profile');
        let profile = Array.isArray(profileData) ? profileData[0] ?? null : profileData;
        let profileError = rpcError;

        // RPCが失敗または未定義の場合は従来のSELECT
        if (profileError) {
          console.log('  fetchProfile: RPC エラー／未定義、従来のSELECTを使用', profileError);
          const res = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
          profile = res.data ?? profile;
          profileError = res.error ?? profileError;
        }
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
              display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'ユーザー',
              role: 'member',
              points: 0,
              membership_tier: null
            })
            .select()
            .single();

          if (createError) {
            console.error('  fetchProfile: プロフィール作成エラー', createError);
            // プロフィール作成失敗時もユーザーは表示する（ログイン状態は維持）
            setUser(user);
            setProfile(null);
            setLoading(false);
            clearTimeout(timeout);
            // エラーメッセージを表示
            setAuthError(`プロフィール作成に失敗しました: ${createError.message}`);
            return;
          } else {
            profile = newProfile;
            console.log('  fetchProfile: プロフィール作成完了', profile);
          }
        } else if (profileError && profileError.code !== 'PGRST116') {
          console.error('  fetchProfile: profilesエラー', profileError);
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

        // お知らせ取得（最新5件、固定優先）
        const { data: annData } = await supabase
          .from('announcements')
          .select('*')
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5);
        setAnnouncements((annData as Announcement[]) ?? []);

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

  console.log('=== レンダリング: loading =', loading);

  if (loading) {
    console.log('=== 描画: 読み込み中 ===');
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-orange-500 text-lg">読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    console.log('=== 描画: ログインボタン ===');
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black p-4">
        {authError && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm max-w-md">
            <p className="font-bold mb-2">ログインエラー</p>
            <p>{authError}</p>
            <p className="mt-2 text-sm text-gray-300">
              {authError.includes('server_error') ? (
                <>
                  <strong>server_error の対処法：</strong><br />
                  1. <strong>必ず https://hstfanclub.vercel.app でアクセス</strong>してからログインしてください（プレビューURLでは失敗します）<br />
                  2. ブラウザのCookieを有効にしてください<br />
                  3. シークレットモードで試してください<br />
                  4. Supabase → URL Configuration に <code className="bg-black/30 px-1">https://hstfanclub.vercel.app/auth/callback</code> が追加されているか確認
                </>
              ) : authError.includes('プロフィール作成に失敗') ? (
                <>
                  <strong>対処法：</strong><br />
                  Supabase Dashboard → SQL Editor で <code className="bg-black/30 px-1">supabase_fix_new_user_login.sql</code> を実行してください。新規ユーザーのプロフィール作成が有効になります。
                </>
              ) : (
                'Supabaseの認証設定（Redirect URLs）を確認してください。'
              )}
            </p>
          </div>
        )}
        <button
          onClick={async () => {
            console.log('Discordログイン開始');
            const redirectUrl = typeof window !== 'undefined' 
              ? `${window.location.origin}/auth/callback`
              : '/auth/callback';
            await supabase.auth.signInWithOAuth({
              provider: 'discord',
              options: { redirectTo: redirectUrl },
            });
          }}
          className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/50"
        >
          Discordでログイン
        </button>
      </div>
    );
  }

  console.log('=== 描画: メイン画面 ===');
  return (
    <div className="min-h-screen p-8 bg-black text-white">
      <h1 className="text-4xl font-bold mb-6 text-orange-500">HSTファンクラブ</h1>
      
      {authError && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm">
          <p className="font-bold mb-2">エラー</p>
          <p>{authError}</p>
          {authError.includes('プロフィール作成に失敗') && (
            <p className="mt-2 text-sm text-gray-300">
              Supabase Dashboard → SQL Editor で <code className="bg-black/30 px-1">supabase_fix_new_user_login.sql</code> を実行してください。
            </p>
          )}
        </div>
      )}
      {profile ? (
        <div className="border border-orange-500/30 bg-gray-900 p-4 rounded-lg mb-6 shadow-lg shadow-orange-500/10">
          <p className="text-white">ようこそ、<span className="text-orange-500 font-bold">{profile.display_name}</span>さん</p>
          <p className="text-gray-300">あなたのrole: <span className="text-orange-400">{profile.role}</span></p>
          <p className="text-gray-300">ポイント: <span className="text-orange-500 font-bold">{profile.points}pt</span></p>
        </div>
      ) : (
        <></>
      )}
      {profile && announcements.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-orange-500">📢 お知らせ</h2>
            <button
              onClick={() => router.push('/announcements')}
              className="text-sm text-orange-400 hover:text-orange-300 underline"
            >
              一覧を見る
            </button>
          </div>
          <ul className="space-y-3">
            {announcements.map((a) => (
              <li key={a.id} className="border border-orange-500/30 bg-gray-900 p-4 rounded-lg shadow-lg shadow-orange-500/10">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-orange-500">{a.title}</span>
                  {a.is_pinned && <span className="text-xs bg-amber-500/30 text-amber-200 px-1.5 py-0.5 rounded">固定</span>}
                </div>
                <p className="text-gray-300 text-sm mt-1 line-clamp-2">{a.body}</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(a.created_at).toLocaleString('ja-JP')}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!profile && (
        <div className="mb-4">
          <p className="text-orange-500 mb-3">プロフィールが見つかりません</p>
          <p className="text-gray-300 text-sm mb-3">
            SupabaseでSQLを実行した後は、下のボタンで再読み込みしてください。
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            プロフィールを再読み込み
          </button>
        </div>
      )}
      
      {profile && (
        <div className="space-y-3">
          <button 
            onClick={() => router.push('/adventure')}
            className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/30"
          >
            🗺️ 冒険に出る
          </button>
          <button 
            onClick={() => router.push('/games')}
            className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/30"
          >
            ゲームで遊ぶ
          </button>
          <button 
            onClick={() => router.push('/friends')}
            className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/30"
          >
            👥 フレンド
          </button>
          <button 
            onClick={() => router.push('/ranking')}
            className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/30"
          >
            ランキングを見る
          </button>
          <button 
            onClick={() => router.push('/missions')}
            className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/30"
          >
            📋 デイリーミッション
          </button>
          <button 
            onClick={() => router.push('/announcements')}
            className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/30"
          >
            📢 お知らせ
          </button>
          
          {(profile.role === 'owner' || profile.role === 'staff') && (
            <button 
              onClick={() => router.push('/admin')}
              className="w-full px-4 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg font-semibold hover:from-orange-700 hover:to-red-700 transition-all shadow-lg shadow-orange-500/30"
            >
              管理画面へ
            </button>
          )}
          
          {/* ガチャボタン */}
          {profile.membership_tier === 'premium' && (
            <button
              onClick={() => router.push('/premium/gacha')}
              className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/30"
            >
              🎰 プレミアムガチャ
            </button>
          )}

          {/* 通常会員ガチャ（basic/premium会員、通常の会員、オーナー、スタッフもアクセス可能） */}
          {(profile.membership_tier === 'basic' || 
            profile.membership_tier === 'premium' || 
            profile.role === 'member' || 
            profile.role === 'owner' ||
            profile.role === 'staff' ||
            !profile.membership_tier) && (
            <button
              onClick={() => router.push('/basic/gacha')}
              className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/30"
            >
              🎲 通常ガチャ
            </button>
          )}

          {(profile.role === 'premium' || profile.role === 'owner') && (
            <button 
              onClick={() => router.push('/premium')}
              className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/30"
            >
              プレミアムページへ
            </button>
          )}
          
          {/* イベントガチャ（全ユーザー向け） */}
          <button 
            onClick={() => router.push('/events')}
            className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/30"
          >
            🎪 イベントガチャ
          </button>

          {/* 装備 */}
          <button 
            onClick={() => router.push('/equipment')}
            className="w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-semibold hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg shadow-amber-500/30"
          >
            ⚔️ 装備
          </button>
          
          {profile.role === 'owner' && (
            <button 
              onClick={() => router.push('/admin/distribute-hst')}
              className="w-full px-4 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-lg font-semibold hover:from-orange-700 hover:to-amber-700 transition-all shadow-lg shadow-orange-500/30"
            >
              😊 HST配布（オーナー専用）
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
        className="mt-6 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors border border-gray-700"
      >
        ログアウト
      </button>
    </div>
  );
}
