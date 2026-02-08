// ステージ選択は useSearchParams 使用のためプリレンダーをスキップ
export const dynamic = 'force-dynamic';

export default function StagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
