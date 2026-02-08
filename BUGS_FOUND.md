# バグ調査レポート（今回の修正含む）

## ✅ 今回修正したバグ

### 1. パーティロビーで「一緒にバトルへ遷移」が動かない
- **場所**: `app/party/lobby/page.tsx`
- **原因**: `adventure_invites` 取得時の `select` に `battle_party_stage_id` が含まれておらず、常に undefined だった。
- **修正**: `select` に `battle_party_stage_id` を追加し、型キャストをやめて `inviteData.battle_party_stage_id` を直接参照。

### 2. 装備画面で member_equipment を全ユーザー分取得していた
- **場所**: `app/equipment/page.tsx`
- **原因**: `member_equipment` の取得に `user_member_id` のフィルタがなく、RLS 任せで全件取得していた（RLS で自ユーザー分に制限されていても、クエリ意図が不明瞭で無駄な取得の可能性）。
- **修正**: 先に取得した自ユーザーの `user_members.id` 一覧で `.in('user_member_id', memberIds)` を付与。メンバーが0人の場合は `member_equipment` クエリをスキップ。

---

## 📋 既存ドキュメントで指摘されている主なバグ（未修正）

詳細は `BUG_REPORT.md` および `ADDITIONAL_BUGS.md` を参照。

| 優先度 | 内容 | 場所 |
|--------|------|------|
| 高 | バトル画面の競合状態（enemyTurn の setTimeout と setParty） | `app/adventure/battle/page.tsx` |
| 高 | `.single()` のエラーハンドリング不足 | 複数ページ |
| 高 | 初期キャラ付与のエラーチェック・ロールバックなし | `app/page.tsx` |
| 高 | バトル勝利処理の重複実行（handleVictory が複数回呼ばれる可能性） | `app/adventure/battle/page.tsx` |
| 中 | 配列範囲外・undefined チェック不足（checkAutoRevive, useSkill 等） | `app/adventure/battle/page.tsx` |
| 中 | 合成機能のエラーハンドリング・ロールバック不足 | `app/adventure/page.tsx`, `app/adventure/collection/page.tsx` |
| 中 | 敵の攻撃処理で target の undefined チェック不足 | `app/adventure/battle/page.tsx` |
| 低 | レベルアップ計算の while ループ（maxLevel で制限済みだが防御的制限の余地） | `utils/levelup.ts` |
| 低 | HP回復の非同期タイミング（バトル開始が回復より早い可能性） | `app/adventure/page.tsx` |

---

## 🔍 軽微な改善候補

- **games/page.tsx**: `profiles` の `.single()` で error を扱っておらず、プロフィール未作成時に無言で null のまま。`maybeSingle()` やエラー時の表示検討の余地あり。
- **adventure/collection/page.tsx**: レアリティソート時は `loadMembers` 内で早期 return しており、他ソート時と処理経路が異なる。ローディング状態はこのページでは未使用のため、現状は表示上の問題はなし。
