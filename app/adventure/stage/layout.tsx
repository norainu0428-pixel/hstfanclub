// ステージ詳細は useSearchParams 使用のためプリレンダーをスキップ
export const dynamic = 'force-dynamic';

export default function StageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
