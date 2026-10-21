import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeftRight, ArrowUpDown } from 'lucide-react'
import { legalMoves } from '../game/engine'
import { useGame } from '../game/store'
import { BOARD_SIZE, MATERIAL } from '../game/types'
import { GEM_STYLE, Gem } from './Gem'

const pct = (n: number) => `${(n * 100) / BOARD_SIZE}%`

export function Board() {
  const game = useGame((s) => s.game)
  const shake = useGame((s) => s.shake)
  const selectTile = useGame((s) => s.selectTile)
  const { board, arrow } = game
  const waiting = useGame((s) => s.setup || s.intro)
  const myPick = !waiting && game.current === 'p1' && game.phase === 'pick'
  const legal = new Set(legalMoves(game).map((m) => `${m.row},${m.col}`))
  const horizontal = arrow.dir === 'HORIZONTAL'

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[min(100%,460px,max(280px,100dvh_-_375px))] md:max-w-[min(92vw,460px)] rounded-2xl bg-[var(--board)] p-1.5 shadow-inner">
      <div className="relative h-full w-full">
        {/* 参照ラインの半透明ハイライト */}
        <motion.div
          className="pointer-events-none absolute rounded-xl bg-[var(--line)]"
          initial={false}
          animate={
            horizontal
              ? { top: pct(arrow.row), left: 0, width: '100%', height: pct(1) }
              : { left: pct(arrow.col), top: 0, height: '100%', width: pct(1) }
          }
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        />

        <div className="grid h-full w-full grid-cols-6 grid-rows-6">
          {board.map((row, r) =>
            row.map((cell, c) => {
              const key = `${r},${c}`
              const selectable = myPick && legal.has(key)
              const shaking = shake && shake.row === r && shake.col === c
              return (
                <div key={key} data-cell={key} className="p-[3px] sm:p-1">
                  {cell ? (
                    <motion.button
                      key={shaking ? shake.key : 'tile'}
                      type="button"
                      aria-label={`${r + 1}行${c + 1}列 ${MATERIAL[cell].name}`}
                      onClick={() => selectTile({ row: r, col: c })}
                      animate={shaking ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                      transition={{ duration: 0.35 }}
                      whileHover={selectable ? { scale: 1.08 } : undefined}
                      whileTap={selectable ? { scale: 0.92 } : undefined}
                      className={[
                        'relative flex h-full w-full items-center justify-center rounded-lg shadow-[0_3px_0_rgba(0,0,0,.25)] transition-opacity',
                        GEM_STYLE[cell].bg,
                        selectable ? 'tile-pulse cursor-pointer' : '',
                        myPick && !selectable ? 'opacity-55' : '',
                        !myPick ? 'cursor-default' : '',
                      ].join(' ')}
                    >
                      <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,.35)] [&_svg]:fill-white/90 [&_svg]:stroke-transparent">
                        <Gem color={cell} size={30} />
                      </span>
                    </motion.button>
                  ) : (
                    <div className="h-full w-full rounded-lg bg-[var(--hole)] shadow-[inset_0_3px_6px_rgba(0,0,0,.35)]" />
                  )}
                </div>
              )
            }),
          )}
        </div>

        {/* 矢印トークン */}
        <motion.div
          className="pointer-events-none absolute flex items-center justify-center p-[3px] sm:p-1"
          style={{ width: pct(1), height: pct(1) }}
          initial={false}
          animate={{ top: pct(arrow.row), left: pct(arrow.col) }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        >
          <motion.div
            className="flex h-full w-full items-center justify-center rounded-full border-4 border-white bg-slate-900 text-white shadow-lg"
            initial={false}
            animate={{ rotate: horizontal ? 0 : 90 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
          >
            <ArrowLeftRight size={24} strokeWidth={3} />
          </motion.div>
        </motion.div>
      </div>

      <AnimatePresence>
        {game.phase === 'pick' && legal.size > 0 && (
          <motion.div
            key={arrow.dir}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -top-3 right-3 flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white shadow"
          >
            {horizontal ? <ArrowLeftRight size={12} /> : <ArrowUpDown size={12} />}
            {horizontal ? '横ライン' : '縦ライン'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
