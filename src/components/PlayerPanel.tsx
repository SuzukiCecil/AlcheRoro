import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Bot, Star, User, X } from 'lucide-react'
import { COLORS, CONVERSION_RATE, MATERIAL, WIN_SCORE, type Color, type PlayerId, type RecipeCard } from '../game/types'
import { LEVELS } from '../game/cpu'
import { useGame } from '../game/store'
import { Gem } from './Gem'
import { RecipeCardFace } from './RecipeCardFace'

export function PlayerPanel({ id }: { id: PlayerId }) {
  const game = useGame((s) => s.game)
  const p = game.players[id]
  const waiting = useGame((s) => s.setup || s.intro)
  const active = !waiting && game.current === id && game.phase !== 'gameover'
  const isCpu = id === 'cpu'
  const level = useGame((s) => s.level)
  // 手動変換：変換元の素材を選ぶと、変換先の選択欄が開く
  const [from, setFrom] = useState<Color | null>(null)
  const canConvert = !isCpu && active
  const picking = from && canConvert && p.inventory[from] >= CONVERSION_RATE ? from : null

  return (
    <section
      className={[
        'rounded-2xl border-2 bg-[var(--panel)] p-2 transition-colors md:p-2.5',
        active ? (isCpu ? 'border-rose-400' : 'border-[var(--accent)]') : 'border-transparent',
      ].join(' ')}
    >
      {/* スマホ：名前・所持素材・得点を1行に。PC：1行目に名前と得点、2行目に所持素材 */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 md:grid-cols-[minmax(0,1fr)_auto] md:gap-y-2">
        <div className="flex items-center gap-1.5 text-sm font-bold">
          {isCpu ? <Bot size={18} /> : <User size={18} />}
          {isCpu ? 'CPU' : 'あなた'}
          {isCpu && <span className="hidden text-xs font-bold text-[var(--muted)] md:inline">（{LEVELS[level].label}）</span>}
          {active && (
            <span className={`hidden rounded-full px-1.5 text-[10px] text-white md:inline ${isCpu ? 'bg-rose-500' : 'bg-[var(--accent)]'}`}>
              {isCpu ? '思考中…' : '手番'}
            </span>
          )}
        </div>
        <div className="grid grid-cols-5 gap-1 md:col-span-2 md:row-start-2">
          {COLORS.map((c) => (
            <InventorySlot
              key={c}
              player={id}
              color={c}
              count={p.inventory[c]}
              selected={picking === c}
              onConvert={canConvert ? () => setFrom(picking === c ? null : c) : undefined}
            />
          ))}
        </div>
        <div className="flex items-center gap-1 md:col-start-2 md:row-start-1">
          <span className="hidden items-center gap-1 md:flex">
            {Array.from({ length: WIN_SCORE }, (_, i) => (
              <Star
                key={i}
                size={14}
                className={i < p.score ? 'text-amber-400' : 'text-[var(--border)]'}
                fill="currentColor"
              />
            ))}
          </span>
          <motion.span key={p.score} initial={{ scale: 1.8 }} animate={{ scale: 1 }} className="w-5 text-right text-lg font-black tabular-nums md:ml-1 md:w-6">
            {p.score}
          </motion.span>
          <span className="text-xs font-bold text-[var(--muted)] md:hidden">/{WIN_SCORE}</span>
        </div>
      </div>
      {/* スマホでは調合済みカードは1枚以上あるときだけ小さく並べる */}
      {p.crafted.length > 0 && (
        <div className="mt-1.5 md:hidden">
          <CraftedCards cards={p.crafted} popDown={isCpu} compact />
        </div>
      )}
      {!isCpu && (
        <ConvertBar
          picking={picking}
          hasConvertible={canConvert && COLORS.some((c) => p.inventory[c] >= CONVERSION_RATE)}
          onClose={() => setFrom(null)}
        />
      )}
      <div className="hidden md:block">
        <CraftedCards cards={p.crafted} popDown={isCpu} />
      </div>
    </section>
  )
}

/** 調合済みのカード。小さく並べ、ホバー・タップで拡大表示する（CPU側は画面上端で切れないよう下に出す）（6点で勝利なので最大6枚） */
function CraftedCards({ cards, popDown, compact = false }: { cards: RecipeCard[]; popDown: boolean; compact?: boolean }) {
  return (
    <div className={compact ? 'flex items-center gap-0.5' : 'mt-2 flex min-h-16 items-center gap-1.5'}>
      {cards.length === 0 && !compact && <span className="w-full text-center text-xs text-[var(--muted)]">調合したカードがここに並びます</span>}
      <AnimatePresence>
        {cards.map((card, i) => (
          <motion.button
            key={`${card.id}-${i}`}
            type="button"
            aria-label={`${card.name}（${card.points}点）`}
            initial={{ opacity: 0, scale: 1.6, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className={`group relative shrink-0 focus:outline-none ${compact ? 'w-6' : 'w-12'}`}
          >
            <RecipeCardFace card={card} />
            <span className={`pointer-events-none absolute z-30 hidden w-36 ${popDown ? 'top-full mt-2' : 'bottom-full mb-2'} ${compact ? 'left-1/2 -translate-x-1/2' : i < 3 ? 'left-0' : 'right-0'} drop-shadow-xl group-hover:block group-focus:block`}>
              <RecipeCardFace card={card} />
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}

/** 手動変換の操作欄（自動変換のスイッチは外した。store.ts の AUTO_CONVERT を参照） */
function ConvertBar({ picking, hasConvertible, onClose }: { picking: Color | null; hasConvertible: boolean; onClose: () => void }) {
  const convert = useGame((s) => s.convert)
  return (
    <>
      <AnimatePresence initial={false}>
        {picking && (
          <motion.div
            key="picker"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg bg-[var(--card)] p-1.5 text-xs font-bold">
              <span className="flex items-center gap-0.5">
                <Gem color={picking} size={16} />×{CONVERSION_RATE}
              </span>
              <ArrowRight size={14} className="text-[var(--muted)]" />
              {COLORS.filter((c) => c !== picking).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    convert(picking, c)
                    onClose()
                  }}
                  className="flex items-center gap-1 rounded-md bg-[var(--panel)] px-2 py-1 shadow-sm transition hover:-translate-y-0.5 hover:ring-2 hover:ring-[var(--accent)]"
                >
                  <Gem color={c} size={16} />
                  {MATERIAL[c].short}
                </button>
              ))}
              <button type="button" aria-label="変換をやめる" onClick={onClose} className="ml-auto rounded-md p-1 text-[var(--muted)] hover:text-[var(--text)]">
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* スマホでは変換先を選ぶとき以外は案内文を省く（所持欄の枠の色で変換できる素材がわかる） */}
      <div className={`mt-2 items-center justify-between gap-2 text-xs ${picking ? 'flex' : 'hidden md:flex'}`}>
        <span className="text-[var(--muted)]">
          {picking
            ? '何に変換しますか？'
            : hasConvertible
              ? `${CONVERSION_RATE}個以上ある素材をタップして変換`
              : `同じ素材${CONVERSION_RATE}個 → 好きな素材1個に変換できます`}
        </span>
      </div>
    </>
  )
}

/**
 * 所持数スロット。飛んでいる途中の素材は着地するまで数えず、着地したら跳ねさせる。
 * onConvert があり3個以上あれば、タップで手動変換の変換元に選べる。
 */
function InventorySlot({
  player,
  color,
  count,
  selected = false,
  onConvert,
}: {
  player: PlayerId
  color: Color
  count: number
  selected?: boolean
  onConvert?: () => void
}) {
  const pending = useGame((s) => s.flights.filter((f) => f.player === player && f.color === color).length)
  const shown = Math.max(0, count - pending)
  const prev = useRef(shown)
  const controls = useAnimationControls()

  useEffect(() => {
    if (shown > prev.current) void controls.start({ scale: [1, 1.35, 1], transition: { duration: 0.35 } })
    prev.current = shown
  }, [shown, controls])

  const convertible = !!onConvert && shown >= CONVERSION_RATE
  return (
    <motion.button
      type="button"
      data-inv={`${player}-${color}`}
      animate={controls}
      disabled={!convertible}
      onClick={onConvert}
      aria-label={`${MATERIAL[color].name} ${count}個${convertible ? '（タップで変換）' : ''}`}
      title={convertible ? `${MATERIAL[color].name}を${CONVERSION_RATE}個使って変換` : MATERIAL[color].name}
      className={[
        'flex items-center justify-center gap-1 rounded-lg bg-[var(--card)] py-1 text-sm font-bold tabular-nums transition',
        shown === 0 ? 'opacity-40' : '',
        selected ? 'ring-2 ring-[var(--accent)]' : shown >= CONVERSION_RATE ? 'ring-2 ring-amber-400' : '',
        convertible ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-default',
      ].join(' ')}
    >
      <Gem color={color} size={16} />
      <motion.span key={shown} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        {shown}
      </motion.span>
    </motion.button>
  )
}
