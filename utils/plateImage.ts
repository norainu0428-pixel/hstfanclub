/**
 * plateフォルダの画像パスを取得するユーティリティ
 * - レアリティがHSTの時のみ plate/HST/ 内の画像を使用
 * - それ以外は plate/ 直下の画像を使用
 */

// member_name -> ファイル名（拡張子除く）のマッピング
const NAME_TO_ROOT_FILE: Record<string, string> = {
  smile: 'Smile',
  'hst smile': 'Smile',
  stary: 'STARY',
  maiku: 'Maiku',
  riemu: 'riemu', // 小文字のファイル名
  karu: 'Karu',
  rura: 'Rura',
  shunkoro: 'Shunkoro',
  zerom: '', // 画像なし
};

// HST用: member_name -> HSTフォルダ内のファイル名（拡張子含む）
// HSTフォルダには "名前さん.jpg" 形式で保存
const NAME_TO_HST_FILE: Record<string, string> = {
  smile: 'Smileさん.jpg',
  'hst smile': 'Smileさん.jpg',
  stary: 'STARYさん.jpg',
  maiku: 'Maikuさん.jpg',
  riemu: 'Riemuさん.jpg',
  'hst riemu': 'Riemuさん.jpg',
  shunkoro: 'Shunkoroさん.jpg',
};

/**
 * メンバーのプレート画像URLを取得
 * @param memberName - メンバー名（DBのmember_name）
 * @param rarity - レアリティ（HSTの時のみHSTフォルダを使用）
 * @returns 画像URL、該当画像がない場合はnull
 */
export function getPlateImageUrl(memberName: string, rarity: string): string | null {
  const normalizedName = (memberName || '').trim().toLowerCase();

  if (rarity === 'HST') {
    // HSTレアリティの時のみ plate/HST/ を使用
    const hstFile = NAME_TO_HST_FILE[normalizedName];
    if (hstFile) {
      return `/plate/HST/${encodeURIComponent(hstFile)}`;
    }
    return null;
  }

  // 通常は plate/ 直下を使用
  const rootFile = NAME_TO_ROOT_FILE[normalizedName];
  if (rootFile) {
    return `/plate/${rootFile}.png`;
  }
  return null;
}
