# プロジェクトクリーンアップ手順

## 現在の状況

`.next`と`node_modules`フォルダは、現在ファイルが使用中のため削除できませんでした。
これは、Next.jsの開発サーバーが実行中で、これらのファイルがロックされているためです。

## 重要な確認事項

✅ **`.gitignore`ファイルを確認しました**
- `/node_modules` - 既に無視設定済み
- `/.next/` - 既に無視設定済み

これらのフォルダは既にGitHubにアップロードされない設定になっています。

## 削除手順

### 1. 開発サーバーを停止
Next.jsの開発サーバーが実行中の場合は、以下の手順で停止してください：

```powershell
# ターミナルで Ctrl+C を押して開発サーバーを停止
# または、実行中のNode.jsプロセスを終了
```

### 2. フォルダを削除
開発サーバーを停止した後、以下のコマンドを実行してください：

```powershell
cd d:\FANCLUB\hst-fanclub

# .nextフォルダを削除
Remove-Item -Recurse -Force .next

# node_modulesフォルダを削除
Remove-Item -Recurse -Force node_modules
```

### 3. 削除の確認
削除が完了したことを確認：

```powershell
# フォルダが存在しないことを確認
Test-Path .next        # False を返すはず
Test-Path node_modules # False を返すはず
```

## 注意事項

- これらのフォルダは削除しても問題ありません
- `npm install`を実行すると`node_modules`が再生成されます
- `npm run dev`を実行すると`.next`が再生成されます
- `.gitignore`に既に設定されているため、GitHubにはアップロードされません

## 再インストール方法

削除後、プロジェクトを再開する場合は：

```powershell
# 依存関係を再インストール
npm install

# 開発サーバーを起動（.nextフォルダが自動生成されます）
npm run dev
```
