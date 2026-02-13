'use client';

import Image from 'next/image';
import { Member, MAX_LEVELS, getRequiredExp } from '@/types/adventure';
import { getPlateImageUrl } from '@/utils/plateImage';
import { getSkillName } from '@/utils/skills';
import { getRarityGradientPart, getRarityBorderColor } from '@/utils/rarity';

interface MemberCardProps {
  member: Member;
  onClick?: () => void;
  selected?: boolean;
  showStats?: boolean;
}

export default function MemberCard({ member, onClick, selected = false, showStats = true }: MemberCardProps) {
  const gradientPart = getRarityGradientPart(member.rarity);
  const borderColor = getRarityBorderColor(member.rarity);

  return (
    <div
      onClick={onClick}
      className={`relative bg-gray-900 border-4 shadow-xl overflow-hidden transition-all ${
        selected ? 'ring-4 ring-orange-500 scale-105' : 'hover:scale-105'
      } ${onClick ? 'cursor-pointer' : ''}`}
      style={{ borderColor }}
    >
      {/* レアリティバッジ */}
      {(() => {
        const maxLevel = MAX_LEVELS[member.rarity] || 40;
        const isMaxLevel = member.level >= maxLevel;
        return (
          <div className={`absolute top-2 right-2 px-3 py-1 rounded-full text-white text-xs font-bold bg-gradient-to-r ${gradientPart} shadow-lg`}>
            Lv.{member.level}{isMaxLevel && ' MAX'}
          </div>
        );
      })()}

      {/* 覚醒専用バッジ */}
      {member.rarity === '覚醒' && (
        <div className={`absolute top-12 right-2 px-2 py-1 rounded-full bg-gradient-to-r ${getRarityGradientPart('覚醒')} text-white text-xs font-bold animate-pulse`}>
          🌟 覚醒
        </div>
      )}

      {/* HST専用バッジ */}
      {member.rarity === 'HST' && (
        <div className={`absolute top-12 right-2 px-2 py-1 rounded-full bg-gradient-to-r ${getRarityGradientPart('HST')} text-white text-xs font-bold animate-pulse`}>
          👑 最高位
        </div>
      )}
      
      {/* STARY専用バッジ */}
      {member.rarity === 'stary' && (
        <div className={`absolute top-12 right-2 px-2 py-1 rounded-full bg-gradient-to-r ${getRarityGradientPart('stary')} text-white text-xs font-bold animate-pulse`}>
          無限成長
        </div>
      )}

      {/* 進化済みバッジ */}
      {(member.evolution_stage ?? 0) >= 1 && (
        <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 text-xs font-bold">
          ✨ 進化
        </div>
      )}

      {/* お気に入り */}
      {member.is_favorite && (
        <div className="absolute top-2 left-2 text-2xl">⭐</div>
      )}

      {/* メンバー画像（plate: HSTレア時はHSTフォルダ、それ以外は直下を使用） */}
      <div className={`p-6 bg-gradient-to-br ${gradientPart} flex items-center justify-center min-h-[180px]`}>
        {getPlateImageUrl(member.member_name, member.rarity) ? (
          <Image
            src={getPlateImageUrl(member.member_name, member.rarity)!}
            alt={member.member_name}
            width={120}
            height={120}
            className="object-contain rounded-lg"
            unoptimized
          />
        ) : (
          <div className="text-7xl">{member.member_emoji}</div>
        )}
      </div>

      {/* メンバー情報 */}
      <div className="p-4 bg-gray-800">
        <h3 className="font-bold text-lg mb-1 text-center text-white">{member.member_name}</h3>
        <p className="text-xs text-gray-400 text-center mb-3">{member.member_description}</p>

        {showStats && (
          <>
            {/* HPバー */}
            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-orange-500">HP</span>
                <span className="text-gray-400">{member.hp}/{member.max_hp}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${member.max_hp > 0
                      ? Math.min(Math.max((member.hp / member.max_hp) * 100, 0), 100)
                      : 0
                    }%`
                  }}
                />
              </div>
            </div>

            {/* EXPバー */}
            {(() => {
              const maxLevel = MAX_LEVELS[member.rarity] || 40;
              const isMaxLevel = member.level >= maxLevel;
              const requiredExp = getRequiredExp(member.level);
              
              if (isMaxLevel) {
                return (
                  <div className="mb-3 text-center">
                    <span className="inline-block bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-1 rounded-full text-xs font-bold">
                      ⭐ MAX LEVEL ⭐
                    </span>
                  </div>
                );
              }
              
              return (
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-orange-400">EXP</span>
                    <span className="text-gray-400">{member.experience}/{requiredExp}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-orange-400 to-amber-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((member.experience / requiredExp) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* ステータス */}
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div className="bg-gray-800 border border-orange-500/30 rounded p-2">
                <div className="text-xs text-gray-400">ATK</div>
                <div className="font-bold text-orange-500">{member.attack}</div>
              </div>
              <div className="bg-gray-800 border border-orange-500/30 rounded p-2">
                <div className="text-xs text-gray-400">DEF</div>
                <div className="font-bold text-orange-500">{member.defense}</div>
              </div>
              <div className="bg-gray-800 border border-orange-500/30 rounded p-2">
                <div className="text-xs text-gray-400">SPD</div>
                <div className="font-bold text-orange-500">{member.speed}</div>
              </div>
            </div>

            {/* スキル表示 */}
            {member.skill_type && showStats && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 rounded-lg p-2">
                  <div className="text-xs text-gray-400 mb-1">スキル</div>
                  <div className="font-bold text-sm text-orange-400">
                    {getSkillName(member.skill_type)}
                  </div>
                  {member.skill_type === 'heal' && (
                    <div className="text-xs text-gray-400 mt-1">
                      HP {member.skill_power || 0} 回復
                    </div>
                  )}
                  {member.skill_type === 'revive' && (
                    <div className="text-xs text-gray-400 mt-1">
                      戦闘不能時に1回だけ蘇生
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 選択中インジケーター */}
      {selected && (
        <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-orange-500/50">
            選択中
          </div>
        </div>
      )}
    </div>
  );
}
