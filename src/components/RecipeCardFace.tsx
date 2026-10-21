import { FlaskConical, Star } from 'lucide-react'
import { useState } from 'react'
import { COLORS, MATERIAL, type Color, type RecipeCard } from '../game/types'
import { GEM_STYLE, Gem } from './Gem'

/**
 * 調合カードの共通レイアウト（docs/card-spec.md）。
 * 寸法はすべてカード幅基準（cqw）なので、どのサイズで表示しても配置比率は同じ。
 *
 *   ┌ 枠（点数で意匠が変わる）─┐
 *   │ カード名        ★点数   │ 名前帯
 *   │       イラスト          │
 *   │   素材アイコン（必要数） │ 素材帯
 *   └──────────────────┘
 */

type Tier = 1 | 2 | 3

export const TIER_STYLE: Record<Tier, { label: string; frame: string; band: string; ink: string; medal: string }> = {
  1: {
    label: '銅',
    frame: 'linear-gradient(145deg,#6b4220 0%,#d79a5b 35%,#8a5a2b 60%,#e2a96b 85%,#6b4220 100%)',
    band: 'linear-gradient(180deg,#f3dcc2,#e5c39e)',
    ink: '#4a2c12',
    medal: 'radial-gradient(circle at 35% 30%,#c98a4b,#7a4a1f 70%)',
  },
  2: {
    label: '銀',
    frame: 'linear-gradient(145deg,#5d6773 0%,#e9edf2 35%,#8a95a3 60%,#f6f8fa 85%,#5d6773 100%)',
    band: 'linear-gradient(180deg,#eef1f5,#d6dce4)',
    ink: '#29313b',
    medal: 'radial-gradient(circle at 35% 30%,#8f9aa8,#3f4752 70%)',
  },
  3: {
    label: '金',
    frame: 'linear-gradient(145deg,#8a6208 0%,#ffe08a 35%,#b8860b 60%,#fff1b8 85%,#8a6208 100%)',
    band: 'linear-gradient(180deg,#fff6d5,#f5df95)',
    ink: '#4d3500',
    medal: 'radial-gradient(circle at 35% 30%,#e0a823,#8a5a00 70%)',
  },
}

const tierOf = (points: number): Tier => (Math.min(3, Math.max(1, points)) as Tier)

/** 必要素材を共通順（鱗→涙→マンドラ→硫黄→キノコ）で1個ずつ並べる */
export const costIcons = (card: RecipeCard): Color[] => COLORS.flatMap((c) => Array<Color>(card.cost[c] ?? 0).fill(c))

/** compact：スマホ幅ではイラストを省いて高さを抑える（md 以上は通常どおり） */
export function RecipeCardFace({ card, compact = false }: { card: RecipeCard; compact?: boolean }) {
  const tier = tierOf(card.points)
  const t = TIER_STYLE[tier]
  const icons = costIcons(card)

  return (
    <div className="@container w-full">
    <div
      className={`relative w-full select-none ${compact ? 'md:aspect-[3/4]' : 'aspect-[3/4]'} rounded-[6cqw] p-[4.5cqw] shadow-md`}
      style={{ background: t.frame }}
    >
      {compact ? <span className="hidden md:contents"><FrameOrnament tier={tier} /></span> : <FrameOrnament tier={tier} />}
      <div className="relative flex h-full flex-col overflow-hidden rounded-[3cqw] bg-[#fbf7ef] shadow-[inset_0_0_0_0.6cqw_rgba(0,0,0,.25)]">
        {/* 名前帯：カード名（左）＋点数メダル（右） */}
        <div className="flex h-[20cqw] shrink-0 items-center gap-[2cqw] pl-[3.5cqw] pr-[2cqw]" style={{ background: t.band }}>
          <span className="min-w-0 flex-1 truncate text-[10.5cqw] font-black leading-none tracking-tight" style={{ color: t.ink }}>
            {card.name}
          </span>
          <span
            className="relative flex aspect-square h-[16cqw] shrink-0 items-center justify-center rounded-full border-[0.8cqw] border-white/80 shadow-[0_0.6cqw_1cqw_rgba(0,0,0,.35)]"
            style={{ background: t.medal }}
            aria-label={`${card.points}点`}
          >
            <Star className="absolute h-[12cqw] w-[12cqw] text-white/25" fill="currentColor" strokeWidth={0} />
            <span className="relative text-[10.5cqw] font-black leading-none text-white [text-shadow:0_0.4cqw_0.8cqw_rgba(0,0,0,.6)]">
              {card.points}
            </span>
          </span>
        </div>

        {/* イラスト */}
        <div className={compact ? 'relative hidden md:block md:min-h-0 md:flex-1' : 'relative min-h-0 flex-1'}>
          <CardArt card={card} icons={icons} />
        </div>

        {/* 素材帯 */}
        <div className="flex h-[22cqw] shrink-0 items-center justify-center gap-[1.2cqw] border-t-[0.6cqw] border-black/15" style={{ background: t.band }}>
          {icons.map((c, i) => (
            <span
              key={i}
              title={MATERIAL[c].name}
              aria-label={MATERIAL[c].name}
              className="flex aspect-square h-[15cqw] items-center justify-center rounded-full bg-white shadow-[0_0.4cqw_0.8cqw_rgba(0,0,0,.25)] [&_svg]:h-[10.5cqw] [&_svg]:w-[10.5cqw]"
            >
              <Gem color={c} />
            </span>
          ))}
        </div>
      </div>
    </div>
    </div>
  )
}

/** public/cards/{id}.jpg を表示。未配置なら素材色のプレースホルダー */
function CardArt({ card, icons }: { card: RecipeCard; icons: Color[] }) {
  const [missing, setMissing] = useState<string | null>(null)
  const src = `${import.meta.env.BASE_URL}cards/${card.id}.jpg`
  if (missing !== card.id) {
    return (
      <img
        src={src}
        alt={card.name}
        draggable={false}
        onError={() => setMissing(card.id)}
        className="absolute inset-0 h-full w-full object-cover"
      />
    )
  }
  const hues = [...new Set(icons)].map((c) => GEM_STYLE[c].hex)
  const bg =
    hues.length > 1
      ? `radial-gradient(circle at 50% 45%, #ffffffcc 0 18%, transparent 55%), linear-gradient(135deg, ${hues.map((h) => `${h}66`).join(',')})`
      : `radial-gradient(circle at 50% 45%, #ffffffcc 0 18%, ${hues[0]}55 70%)`
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: bg }}>
      <FlaskConical className="h-[34cqw] w-[34cqw] text-black/25" strokeWidth={1.5} />
    </div>
  )
}

/** 点数ごとの枠の意匠：銅＝鋲、銀＝鋲＋唐草、金＝宝石＋唐草 */
function FrameOrnament({ tier }: { tier: Tier }) {
  const corners: [number, number, number][] = [
    [0, 0, 0],
    [300, 0, 90],
    [300, 400, 180],
    [0, 400, 270],
  ]
  return (
    <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden>
      {corners.map(([x, y, r]) => (
        <g key={r} transform={`translate(${x} ${y}) rotate(${r})`}>
          {tier >= 2 && (
            <path d="M7 19v44M19 7h44" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2" strokeLinecap="round" />
          )}
          {tier === 3 ? (
            <g transform="translate(9 9) rotate(45)">
              <rect x="-6.5" y="-6.5" width="13" height="13" fill="#dc2626" stroke="#fff7d1" strokeWidth="2" />
              <rect x="-3" y="-3" width="4.5" height="4.5" fill="#fecaca" />
            </g>
          ) : (
            <circle cx="7.5" cy="7.5" r="4" fill="rgba(255,255,255,.7)" stroke="rgba(0,0,0,.3)" strokeWidth="1" />
          )}
        </g>
      ))}
      {tier === 3 && (
        <g fill="#fff7d1" stroke="rgba(0,0,0,.25)" strokeWidth="1">
          <path d="M150 0.5 157 7 150 13.5 143 7z" />
          <path d="M150 386.5 157 393 150 399.5 143 393z" />
        </g>
      )}
    </svg>
  )
}
