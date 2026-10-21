import { AnimatePresence, motion } from 'framer-motion'
import { FlaskConical, Repeat, Sparkles } from 'lucide-react'
import { computePayment, describePayment } from '../game/engine'
import { useGame } from '../game/store'
import { COLORS, MATERIAL, type Inventory, type RecipeCard } from '../game/types'
import { Gem } from './Gem'
import { RecipeCardFace } from './RecipeCardFace'

interface Props {
  selected: number | null
  onSelect: (i: number | null) => void
}

export function Market({ selected, onSelect }: Props) {
  const game = useGame((s) => s.game)
  const setup = useGame((s) => s.setup)
  const autoConvert = useGame((s) => s.autoConvert)
  const inv = game.players.p1.inventory
  const myCraft = game.current === 'p1' && game.phase === 'craft'

  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-[var(--muted)]">
        <span className="flex items-center gap-1">
          <FlaskConical size={14} /> 調合カード
        </span>
        <span className="flex items-center gap-2">
          <span className="font-normal">上：CPU／下：あなた</span>
          <span>山札 {game.deck.length}枚</span>
        </span>
      </div>
      <div className="grid grid-cols-3 grid-rows-[auto_auto_auto] gap-x-2 sm:gap-x-3">
        {game.market.map((card, i) => (
          <div key={i} className="row-span-3 grid grid-rows-subgrid">
            <AnimatePresence mode="wait">
              {setup ? (
                <CardBack key="back" />
              ) : card ? (
                <MarketCard
                  key={card.id}
                  card={card}
                  inv={inv}
                  cpuInv={game.players.cpu.inventory}
                  autoConvert={autoConvert}
                  active={myCraft}
                  selected={selected === i}
                  onClick={() => onSelect(selected === i ? null : i)}
                />
              ) : (
                <div className="row-start-2 flex aspect-[2/1] md:aspect-[3/4] items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] text-xs text-[var(--muted)]">
                  山札切れ
                </div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  )
}

/** 手番を選ぶまでは場のカードを伏せておく */
function CardBack() {
  return (
    <motion.div exit={{ opacity: 0, rotateY: -90 }} transition={{ duration: 0.2 }} className="row-span-3 grid grid-rows-subgrid">
      <div className="mb-1 min-h-5 md:mb-1.5 md:min-h-[2.25rem]" />
      <div className="flex aspect-[2/1] items-center justify-center rounded-[7%] md:aspect-[3/4] border-4 border-[var(--border)] bg-[radial-gradient(circle_at_50%_45%,color-mix(in_srgb,var(--accent)_35%,transparent),transparent_70%),linear-gradient(135deg,var(--panel),var(--card))]">
        <FlaskConical className="h-1/4 w-1/4 text-[var(--accent)] opacity-50" strokeWidth={1.5} />
      </div>
      <div className="mt-1 min-h-5 md:mt-1.5 md:min-h-[2.25rem]" />
    </motion.div>
  )
}

/** カード本体 ＋ 上にCPU・下に自分の状態表示（達成可能・変換で達成可能・不足） */
function MarketCard({
  card,
  inv,
  cpuInv,
  autoConvert,
  active,
  selected,
  onClick,
}: {
  card: RecipeCard
  inv: Inventory
  cpuInv: Inventory
  autoConvert: boolean
  active: boolean
  selected: boolean
  onClick: () => void
}) {
  const payment = computePayment(inv, card.cost, autoConvert)
  const usable = active && !!payment
  const breakdown = payment ? describePayment(payment) : ''
  return (
    <motion.div
      initial={{ opacity: 0, y: -16, rotateY: 90 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      exit={{ opacity: 0, scale: 1.25, filter: 'brightness(2)' }}
      transition={{ duration: 0.35 }}
      className="group relative row-span-3 grid grid-rows-subgrid"
    >
      <CardStatus inv={cpuInv} card={card} autoConvert={autoConvert} cpu />
      <button
        type="button"
        disabled={!usable}
        onClick={onClick}
        title={payment ? `消費: ${breakdown}` : card.name}
        className={[
          'block w-full rounded-[7%] transition',
          selected ? 'ring-4 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]' : payment ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-[var(--bg)]' : '',
          usable ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default',
        ].join(' ')}
      >
        <RecipeCardFace card={card} compact />
      </button>
      <CardStatus inv={inv} card={card} autoConvert={autoConvert} />

      {payment && (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white shadow-lg group-hover:block">
          消費: {breakdown}
        </span>
      )}
    </motion.div>
  )
}

/** あるプレイヤーから見たカードの状態。CPU分はカードの上に、枠線つきのバッジで出す */
function CardStatus({ inv, card, autoConvert, cpu = false }: { inv: Inventory; card: RecipeCard; autoConvert: boolean; cpu?: boolean }) {
  const payment = computePayment(inv, card.cost, autoConvert)
  // 自動変換オフのとき：手動で変換すれば払えるなら、その内訳を案内する
  const convertHint = payment || autoConvert ? null : computePayment(inv, card.cost)
  const conversions = (payment ?? convertHint)?.conversions ?? []
  const badge = (color: string) =>
    cpu
      ? `inline-flex items-center gap-0.5 rounded-full border-2 px-1.5 text-xs font-bold ${color}`
      : `inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-bold text-white ${color}`
  return (
    <div className={`flex min-h-5 flex-col items-center gap-0.5 text-center md:min-h-[2.25rem] ${cpu ? 'mb-1 justify-end md:mb-1.5' : 'mt-1 md:mt-1.5'}`}>
      {payment && (
        <span className={badge(cpu ? 'border-emerald-500 text-emerald-600' : 'bg-emerald-500')}>
          <Sparkles size={12} /> 達成可能
        </span>
      )}
      {!payment && <Missing inv={inv} card={card} />}
      {convertHint && (
        <span className={badge(cpu ? 'border-amber-500 text-amber-600' : 'bg-amber-500')}>
          <Repeat size={12} /> 変換で達成可能
        </span>
      )}
      {conversions.length > 0 && (
        <span className="flex items-center gap-0.5 text-xs leading-tight text-[var(--muted)]">
          {payment && <Repeat size={12} className="shrink-0" />}
          {conversions.map(({ from, to }) => `${MATERIAL[from].short}3→${MATERIAL[to].short}`).join(', ')}
        </span>
      )}
    </div>
  )
}

/** 手持ちに足りない素材（変換前の不足数） */
function Missing({ inv, card }: { inv: Inventory; card: RecipeCard }) {
  const lack = COLORS.map((c) => [c, Math.max(0, (card.cost[c] ?? 0) - inv[c])] as const).filter(([, n]) => n > 0)
  if (!lack.length) return null
  return (
    <span
      className="inline-flex flex-wrap items-center justify-center gap-x-1 text-xs font-bold leading-tight text-[var(--muted)]"
      aria-label={`不足：${lack.map(([c, n]) => `${MATERIAL[c].name}${n}個`).join('、')}`}
    >
      不足
      {lack.map(([c, n]) => (
        <span key={c} className="inline-flex items-center">
          <Gem color={c} size={16} />
          <span className="hidden md:inline">×</span>
          {n}
        </span>
      ))}
    </span>
  )
}
