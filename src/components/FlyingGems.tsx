import { AnimatePresence, motion } from 'framer-motion'
import { Gift } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { FLIGHT_MS, useGame, type Flight } from '../game/store'
import { MATERIAL, type Color } from '../game/types'
import { GEM_STYLE, Gem } from './Gem'

interface Active {
  key: number
  color: Color
  from: DOMRect
  to: DOMRect
}

const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
const playerName = (p: Flight['player']) => (p === 'p1' ? 'あなた' : 'CPU')

/** 所持欄へ飛ぶ素材の演出。盤面から取ったタイルと、後手ボーナスの素材の両方を扱う */
export function FlyingGems() {
  const flights = useGame((s) => s.flights)
  const land = useGame((s) => s.landFlight)
  const [active, setActive] = useState<Active[]>([])
  const launched = useRef(new Set<number>())

  const launch = useCallback(
    (f: Flight, from: DOMRect) => {
      launched.current.add(f.key)
      const toEl = document.querySelector(`[data-inv="${f.player}-${f.color}"]`)
      if (!toEl) return land(f.key)
      setActive((a) => [...a, { key: f.key, color: f.color, from, to: toEl.getBoundingClientRect() }])
      setTimeout(() => {
        setActive((a) => a.filter((x) => x.key !== f.key))
        land(f.key)
      }, FLIGHT_MS)
    },
    [land],
  )

  useLayoutEffect(() => {
    for (const f of flights) {
      if (f.from === 'bonus' || launched.current.has(f.key)) continue
      const el = document.querySelector(`[data-cell="${f.from.row},${f.from.col}"]`)
      if (el) launch(f, el.getBoundingClientRect())
      else land(f.key)
    }
  }, [flights, launch, land])

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <BonusReveal flights={flights.filter((f) => f.from === 'bonus' && !launched.current.has(f.key))} onLaunch={launch} />
      <AnimatePresence>
        {active.map(({ key, color, from, to }) => {
          const a = center(from)
          const b = center(to)
          const size = Math.max(28, Math.min(from.width, from.height) - 8)
          const lift = Math.min(120, Math.abs(b.y - a.y) * 0.35 + 40)
          return (
            <motion.div
              key={key}
              className={`absolute z-10 flex items-center justify-center rounded-lg shadow-xl ${GEM_STYLE[color].bg}`}
              style={{ width: size, height: size, left: -size / 2, top: -size / 2 }}
              initial={{ x: a.x, y: a.y, scale: 1 }}
              animate={{
                x: [a.x, (a.x + b.x) / 2, b.x],
                y: [a.y, Math.min(a.y, b.y) - lift, b.y],
                scale: [1, 1.2, 28 / size],
                rotate: [0, 12, 0],
              }}
              exit={{ opacity: 0, scale: 0.2 }}
              transition={{ duration: FLIGHT_MS / 1000, ease: 'easeInOut' }}
            >
              <span className="[&_svg]:fill-white/90 [&_svg]:stroke-transparent">
                <Gem color={color} size={Math.round(size * 0.55)} />
              </span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

/** 後手ボーナス：画面中央で「誰が何を得たか」を見せ、OK で所持欄へ飛ばす */
function BonusReveal({ flights, onLaunch }: { flights: Flight[]; onLaunch: (f: Flight, from: DOMRect) => void }) {
  const first = useGame((s) => s.game.first)
  const dismissIntro = useGame((s) => s.dismissIntro)
  const refs = useRef(new Map<number, HTMLDivElement>())
  const keys = flights.map((f) => f.key).join(',')

  const ok = () => {
    for (const f of flights) {
      const el = refs.current.get(f.key)
      if (el) onLaunch(f, el.getBoundingClientRect())
    }
    dismissIntro()
  }

  const receiver = flights[0]?.player
  return (
    <AnimatePresence>
      {flights.length > 0 && (
        <motion.div
          key={keys}
          className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
        >
          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="mx-4 flex flex-col items-center gap-3 rounded-2xl bg-[var(--panel)] px-8 py-6 text-center shadow-2xl"
          >
            <div className="text-2xl font-black">{first === 'p1' ? 'あなたが先手' : 'CPUが先手'}</div>
            <div className="flex items-center gap-1.5 text-sm font-bold text-[var(--muted)]">
              <Gift size={16} /> 後手の{playerName(receiver)}に初期素材
            </div>
            <div className="flex gap-3">
              {flights.map((f) => (
                <div key={f.key} className="flex flex-col items-center gap-1.5">
                  <motion.div
                    ref={(el) => {
                      if (el) refs.current.set(f.key, el)
                    }}
                    initial={{ rotateY: 180, scale: 0.4 }}
                    animate={{ rotateY: 0, scale: 1 }}
                    transition={{ delay: 0.25, type: 'spring', stiffness: 180, damping: 14 }}
                    className={`flex h-16 w-16 items-center justify-center rounded-xl shadow-lg ${GEM_STYLE[f.color].bg}`}
                  >
                    <span className="[&_svg]:fill-white/90 [&_svg]:stroke-transparent">
                      <Gem color={f.color} size={36} />
                    </span>
                  </motion.div>
                  <span className="text-sm font-bold">{MATERIAL[f.color].name}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              autoFocus
              onClick={ok}
              className="mt-1 w-full rounded-full bg-[var(--accent)] px-8 py-2.5 font-bold text-white shadow hover:brightness-110"
            >
              OK
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
