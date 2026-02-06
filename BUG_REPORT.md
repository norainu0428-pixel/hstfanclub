# 🐛 バグ報告書

## 🔴 重大なバグ

### 1. **バトル画面での競合状態（Race Condition）**
**場所**: `app/adventure/battle/page.tsx`

**問題**:
- `enemyTurn()`関数内で`updatedParty`をローカル変数として更新しているが、`setParty()`を呼ぶ前に複数の`setTimeout`が実行される可能性がある
- 複数の敵が同時に攻撃する際、古い`party`状態を参照してしまう可能性がある
- 防御力ブーストの削除が`setDefenseBoost()`で非同期に実行されるため、次の攻撃で正しく反映されない可能性がある

**影響**: 
- バトル中のHP計算が不正確になる
- 防御力ブーストが正しく適用されない
- 全滅判定が正しく動作しない可能性

**該当コード** (314-403行目):
```typescript
function enemyTurn() {
  // ...
  let updatedParty = [...party]; // 古い状態をコピー
  
  aliveEnemies.forEach((enemy, enemyIdx) => {
    setTimeout(() => {
      // updatedPartyを更新するが、setParty()は最後に1回だけ呼ばれる
      updatedParty = updatedParty.map(m => ...);
      // ...
    }, enemyIdx * 500);
  });
  
  // 最後にsetParty()を呼ぶが、setTimeout内の更新が完了する前に実行される可能性
  setParty(updatedParty);
}
```

**推奨修正**:
- `setParty()`を関数型更新に変更して、常に最新の状態を参照する
- または、各敵の攻撃後に`setParty()`を呼び、次の攻撃が最新の状態を参照するようにする

---

### 2. **`.single()`のエラーハンドリング不足**
**場所**: 複数ファイル（`app/page.tsx`, `app/adventure/page.tsx`, `app/missions/page.tsx`など）

**問題**:
- `.single()`はレコードが存在しない場合や複数存在する場合にエラーを返すが、多くの場所でエラーハンドリングが不十分
- エラーが発生した場合、アプリケーションがクラッシュする可能性がある

**影響**:
- 新規ユーザーやデータが存在しない場合にエラーが発生する
- ユーザー体験が悪化する

**該当コード例** (`app/adventure/page.tsx` 38-39行目):
```typescript
const [profileResult, membersResult, progressResult] = await Promise.all([
  supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single(), // エラーが発生する可能性があるが、ハンドリングされていない
```

**推奨修正**:
- `.single()`の結果をチェックし、エラーの場合は適切なデフォルト値を設定
- または、`.maybeSingle()`を使用してエラーではなくnullを返すようにする

---

### 3. **初期キャラクター付与のエラーハンドリング不足**
**場所**: `app/page.tsx` (77-97行目)

**問題**:
- `giveStarterCharacters()`関数内で、`supabase.insert()`の結果をチェックしていない
- エラーが発生してもログに出力するだけで、ユーザーに通知されない
- 複数のキャラクターを順次挿入しているため、途中で失敗した場合のロールバックがない

**影響**:
- 新規ユーザーが初期キャラクターを取得できない可能性がある
- 一部のキャラクターだけが付与される可能性がある

**該当コード**:
```typescript
for (const char of starterCharacters) {
  await supabase
    .from('user_members')
    .insert({...}); // エラーチェックなし
}
```

**推奨修正**:
- 各`insert()`の結果をチェック
- エラーが発生した場合はユーザーに通知
- トランザクション処理を検討（Supabaseの制限により難しい場合は、失敗時の再試行ロジックを追加）

---

## ⚠️ 中程度のバグ

### 4. **バトル勝利時の重複処理**
**場所**: `app/adventure/battle/page.tsx` (406-530行目)

**問題**:
- `handleVictory()`が複数回呼ばれる可能性がある（敵全滅チェックが複数箇所にある）
- `setBattleResult('victory')`が複数回呼ばれても、その後の処理が重複実行される可能性がある

**影響**:
- 報酬が重複して付与される可能性
- データベースへの重複書き込み
- ミッション進捗が重複して更新される可能性

**該当コード**:
```typescript
// 236-239行目: スキル使用時
if (newEnemies.every(e => e.hp <= 0)) {
  setTimeout(() => handleVictory(), 1000);
  return;
}

// 297-299行目: 通常攻撃時
if (newEnemies.every(e => e.hp <= 0)) {
  setTimeout(() => handleVictory(), 1000);
  return;
}
```

**推奨修正**:
- `handleVictory()`の最初で`battleResult`をチェックし、既に勝利処理が実行されている場合は早期リターン
- または、フラグを使用して重複実行を防ぐ

---

### 5. **プレイヤー攻撃後の全滅チェックのタイミング問題**
**場所**: `app/adventure/battle/page.tsx` (302-311行目)

**問題**:
- `setTimeout`内で`party`状態を参照しているが、`setTimeout`が実行される時点では古い状態を参照している可能性がある
- `enemyTurn()`が呼ばれる前に全滅チェックが実行されるが、その時点での`party`は更新前の状態

**影響**:
- 全滅判定が正しく動作しない可能性
- ゲームオーバー画面が表示されない

**該当コード**:
```typescript
setTimeout(() => {
  const currentAliveParty = party.filter(m => m.hp > 0); // 古いpartyを参照
  if (currentAliveParty.length === 0) {
    handleDefeat();
    return;
  }
  enemyTurn();
}, 1500);
```

**推奨修正**:
- `useEffect`で`party`の変更を監視して全滅チェックを行う（既に実装されているが、この部分は冗長）
- または、`enemyTurn()`内で全滅チェックを行う

---

### 6. **ミッション進捗更新の競合状態**
**場所**: `utils/missionTracker.ts` (25-31行目)

**問題**:
- `.single()`を使用しているが、レコードが存在しない場合のエラーハンドリングが不十分
- 複数のバトルが同時に発生した場合、同じミッション進捗を同時に更新しようとして競合する可能性がある

**影響**:
- ミッション進捗が正しく記録されない
- エラーが発生する可能性

**該当コード**:
```typescript
const { data: progress } = await supabase
  .from('user_mission_progress')
  .select('*')
  .eq('user_id', userId)
  .eq('mission_id', mission.id)
  .eq('mission_date', today)
  .single(); // エラーが発生する可能性
```

**推奨修正**:
- `.maybeSingle()`を使用するか、エラーハンドリングを追加
- または、`upsert()`を使用して競合を回避

---

## 💡 軽微な問題・改善提案

### 7. **HP回復処理の非同期実行**
**場所**: `app/adventure/page.tsx` (83-101行目)

**問題**:
- HP回復処理が非同期で実行されるため、ユーザーがすぐにバトルを開始すると、HPが回復する前にバトルが始まる可能性がある

**影響**:
- ユーザーがHPが回復していない状態でバトルを開始する可能性がある

**推奨修正**:
- HP回復が完了するまで待機するか、バトル開始時に最新のHPを取得する

---

### 8. **型の安全性の問題**
**場所**: 複数ファイル

**問題**:
- `user`の型が`any`として定義されている箇所がある（`app/page.tsx` 19行目）
- 一部の関数で戻り値の型が明示されていない

**影響**:
- 型エラーが発生する可能性
- IDEの補完が効かない

**推奨修正**:
- 適切な型定義を追加
- TypeScriptのstrictモードを有効にする

---

### 9. **エラーメッセージの国際化**
**場所**: 全ファイル

**問題**:
- エラーメッセージが日本語のみで、英語対応がない
- コンソールログが本番環境でも出力される

**推奨修正**:
- 本番環境ではコンソールログを無効化
- エラーメッセージの国際化を検討

---

## 📋 修正優先度

1. **高**: バグ #1, #2, #3（ユーザー体験に直接影響）
2. **中**: バグ #4, #5, #6（データ整合性の問題）
3. **低**: 問題 #7, #8, #9（改善提案）

---

## 🔧 テスト推奨項目

1. 新規ユーザーの初期キャラクター付与
2. バトル中の複数敵の同時攻撃
3. バトル勝利時の報酬付与（重複チェック）
4. ミッション進捗の更新（同時実行）
5. プロフィールが存在しない場合の動作
6. HP回復処理のタイミング
