// バトルページは useSearchParams 使用のためプリレンダーをスキップ
export const dynamic = 'force-dynamic';

export default function BattleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
