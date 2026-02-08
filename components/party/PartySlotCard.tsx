'use client';

import Image from 'next/image';
import { Member } from '@/types/adventure';
import { getPlateImageUrl } from '@/utils/plateImage';

interface PartySlotCardProps {
  member: Member;
  /** スロット用はコンパクト、一覧用はやや大きめ */
  size?: 'slot' | 'list';
}

export default function PartySlotCard({ member, size = 'slot' }: PartySlotCardProps) {
  const imageUrl = getPlateImageUrl(member.member_name, member.rarity);
  const isSlot = size === 'slot';

  return (
    <div
      className={`rounded-xl overflow-hidden border border-white/15 bg-slate-800/90 text-white ${
        isSlot ? 'min-h-0' : ''
      }`}
    >
      {/* 上: キャラ絵 + Lv */}
      <div className="relative flex items-center justify-center bg-slate-700/80 p-2">
        <div className={`relative ${isSlot ? 'w-14 h-14' : 'w-16 h-16'}`}>
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={member.member_name}
              width={isSlot ? 56 : 64}
              height={isSlot ? 56 : 64}
              className="object-contain rounded-lg"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl rounded-lg bg-slate-600">
              {member.member_emoji}
            </div>
          )}
        </div>
        <div className="absolute top-1 right-1 bg-slate-900/90 text-orange-400 text-xs font-bold px-1.5 py-0.5 rounded">
          Lv.{member.level}
        </div>
      </div>
      {/* 下: 名前・HP・ステータス */}
      <div className="p-2">
        <p className={`font-bold text-white truncate ${isSlot ? 'text-xs' : 'text-sm'}`}>
          {member.member_name}
        </p>
        <div className="mt-1">
          <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
            <span>HP</span>
            <span className="text-white">{member.hp}/{member.max_hp}</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full"
              style={{ width: `${member.max_hp ? (member.hp / member.max_hp) * 100 : 0}%` }}
            />
          </div>
        </div>
        <div className="mt-1.5 flex gap-1 justify-between text-[10px]">
          <span className="text-slate-400">ATK</span>
          <span className="text-orange-400 font-bold tabular-nums">{member.attack}</span>
          <span className="text-slate-400">DEF</span>
          <span className="text-orange-400 font-bold tabular-nums">{member.defense}</span>
          <span className="text-slate-400">SPD</span>
          <span className="text-orange-400 font-bold tabular-nums">{member.speed}</span>
        </div>
      </div>
    </div>
  );
}
