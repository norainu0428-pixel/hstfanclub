import { supabase } from '@/lib/supabaseClient';

export type MissionType = 'battle_win' | 'battle_complete' | 'gacha_pull' | 'stage_clear' | 'level_up';

// ミッション進捗を更新
export async function updateMissionProgress(
  userId: string,
  missionType: MissionType,
  increment: number = 1
) {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
    
    // 今日の日付のミッションを取得
    const { data: missions } = await supabase
      .from('daily_missions')
      .select('*')
      .eq('mission_type', missionType)
      .eq('is_active', true);

    if (!missions || missions.length === 0) return;

    for (const mission of missions) {
      // ユーザーの進捗を取得または作成（エラーハンドリング付き）
      const { data: progress, error: progressError } = await supabase
        .from('user_mission_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('mission_id', mission.id)
        .eq('mission_date', today)
        .maybeSingle();

      if (progressError && progressError.code !== 'PGRST116') {
        console.error('ミッション進捗取得エラー:', progressError);
        continue;
      }

      if (progress) {
        // 既に完了している場合はスキップ
        if (progress.completed) continue;

        const newCount = Math.min(progress.current_count + increment, mission.target_count);
        const completed = newCount >= mission.target_count;

        const { error: updateError } = await supabase
          .from('user_mission_progress')
          .update({
            current_count: newCount,
            completed: completed,
            updated_at: new Date().toISOString()
          })
          .eq('id', progress.id);

        if (updateError) {
          console.error('ミッション進捗更新エラー:', updateError);
        }
      } else {
        // 新しい進捗を作成（upsertを使用して競合を回避）
        const newCount = Math.min(increment, mission.target_count);
        const completed = newCount >= mission.target_count;

        const { error: insertError } = await supabase
          .from('user_mission_progress')
          .upsert({
            user_id: userId,
            mission_id: mission.id,
            current_count: newCount,
            completed: completed,
            mission_date: today,
            claimed: false
          }, {
            onConflict: 'user_id,mission_id,mission_date'
          });

        if (insertError) {
          console.error('ミッション進捗作成エラー:', insertError);
        }
      }
    }
  } catch (error) {
    console.error('ミッション進捗更新エラー:', error);
  }
}

// 今日のミッションを初期化（日付が変わった時に呼び出す）
export async function initializeDailyMissions(userId: string) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 今日のミッション進捗が既にあるかチェック
    const { data: existingProgress } = await supabase
      .from('user_mission_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('mission_date', today)
      .limit(1);

    if (existingProgress && existingProgress.length > 0) {
      // 既に今日のミッションは初期化済み
      return;
    }

    // アクティブなミッションを取得
    const { data: missions } = await supabase
      .from('daily_missions')
      .select('*')
      .eq('is_active', true);

    if (!missions || missions.length === 0) return;

    // 各ミッションの進捗を初期化
    const progressEntries = missions.map(mission => ({
      user_id: userId,
      mission_id: mission.id,
      current_count: 0,
      completed: false,
      claimed: false,
      mission_date: today
    }));

    await supabase
      .from('user_mission_progress')
      .insert(progressEntries);
  } catch (error) {
    console.error('デイリーミッション初期化エラー:', error);
  }
}

// ミッション報酬を受け取る（二重受け取り防止: claimed=false のときだけ更新してから報酬付与）
export async function claimMissionReward(
  userId: string,
  progressId: string,
  rewardPoints: number,
  rewardExp: number
) {
  try {
    // 未受け取りのものだけ「受け取り済み」に更新（連打で二重付与されないように先に更新）
    const { data: updated, error: updateError } = await supabase
      .from('user_mission_progress')
      .update({ claimed: true })
      .eq('id', progressId)
      .eq('user_id', userId)
      .eq('claimed', false)
      .eq('completed', true)
      .select('id')
      .maybeSingle();

    if (updateError || !updated) {
      return { success: false, message: '報酬を受け取れません（受け取り済みか未達成です）' };
    }

    // ここに来た = この1回だけ受け取り権を取得したので報酬を付与
    if (rewardPoints > 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('points')
        .eq('user_id', userId)
        .single();

      if (profile) {
        await supabase
          .from('profiles')
          .update({ points: (profile.points || 0) + rewardPoints })
          .eq('user_id', userId);
      }
    }

    if (rewardExp > 0) {
      const { data: members } = await supabase
        .from('user_members')
        .select('*')
        .eq('user_id', userId);

      if (members) {
        for (const member of members) {
          const newExp = (member.experience || 0) + rewardExp;
          await supabase
            .from('user_members')
            .update({ experience: newExp })
            .eq('id', member.id);
        }
      }
    }

    return { success: true, message: '報酬を受け取りました！' };
  } catch (error) {
    console.error('報酬受け取りエラー:', error);
    return { success: false, message: 'エラーが発生しました' };
  }
}
