import { supabase } from '@/lib/supabaseClient';

/**
 * プロフィールのポイントを加減算する（RPCでRLSをバイパス）
 * @param delta 加算する量（負の値で減算）
 */
export async function updateProfilePoints(delta: number): Promise<boolean> {
  const { error } = await supabase.rpc('add_profile_points', {
    points_to_add: delta
  });
  if (!error) return true;

  // RPC未定義の場合は従来の方法で試行
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('points')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) return false;

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ points: Math.max(0, (profile.points || 0) + delta) })
    .eq('user_id', user.id);

  return !updateErr;
}
