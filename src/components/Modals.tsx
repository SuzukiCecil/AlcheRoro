import { AnimatePresence, motion } from 'framer-motion'
import { CircleHelp, Gift, RotateCcw, Shuffle, Trophy, Undo2, X, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { LEVELS, type Level } from '../game/cpu'
import { DEBUG } from '../debug'
import { MAX_BONUS, useGame, type TurnOrder } from '../game/store'
import { COLORS, MATERIAL, WIN_SCORE } from '../game/types'
import { Gem } from './Gem'

function Modal({ open, onClose, children }: { open: boolean; onClose?: () => void; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl bg-[var(--panel)] p-5 shadow-2xl"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {onClose && (
              <button type="button" aria-label="閉じる" onClick={onClose} className="absolute right-3 top-3 rounded-full p-1 hover:bg-[var(--card)]">
                <X size={18} />
              </button>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const orderOptions = (bonus: number): { order: TurnOrder; label: string; desc: string; icon: ReactNode }[] => [
  { order: 'first', label: '先手', desc: '先に素材を選べる', icon: <Zap size={22} /> },
  { order: 'second', label: '後手', desc: bonus ? `最初に素材を${bonus}個もらえる` : 'ボーナスなし', icon: <Gift size={22} /> },
  { order: 'random', label: 'ランダム', desc: 'どちらになるかはお楽しみ', icon: <Shuffle size={22} /> },
]

/** 選択肢の並び（ラジオボタン風） */
function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-xl bg-[var(--card)] p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={[
            'rounded-lg py-2 text-sm font-bold transition',
            value === o.value ? 'bg-[var(--accent)] text-white shadow' : 'text-[var(--muted)] hover:text-[var(--text)]',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** ゲーム開始時の先手・後手の選択 */
export function StartModal({ onRules }: { onRules: () => void }) {
  const setup = useGame((s) => s.setup)
  const start = useGame((s) => s.start)
  const level = useGame((s) => s.level)
  const setLevel = useGame((s) => s.setLevel)
  const bonus = useGame((s) => s.bonus)
  const setBonus = useGame((s) => s.setBonus)
  return (
    <Modal open={setup}>
      <div className="text-center">
        <h2 className="text-xl font-black">AlcheRoro をはじめる</h2>
        <p className="mt-0.5 text-xs font-bold text-[var(--muted)]">inspired by COLORO</p>
      </div>
      <p className="mt-4 mb-1.5 text-xs font-bold text-[var(--muted)]">CPUの強さ</p>
      <Segmented
        label="CPUの強さ"
        value={level}
        options={(Object.keys(LEVELS) as Level[]).map((lv) => ({ value: lv, label: LEVELS[lv].label }))}
        onChange={setLevel}
      />
      <p className="mt-4 mb-1.5 text-xs font-bold text-[var(--muted)]">後手ボーナス（最初にもらえる素材）</p>
      <Segmented
        label="後手ボーナス"
        value={bonus}
        options={Array.from({ length: MAX_BONUS + 1 }, (_, n) => ({ value: n, label: n ? `${n}個` : 'なし' }))}
        onChange={setBonus}
      />
      <p className="mt-4 mb-1.5 text-xs font-bold text-[var(--muted)]">手番を選んではじめる</p>
      <div className="grid gap-2">
        {orderOptions(bonus).map((o) => (
          <button
            key={o.order}
            type="button"
            onClick={() => start(o.order)}
            className="flex items-center gap-3 rounded-xl border-2 border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--accent)]"
          >
            <span className="text-[var(--accent)]">{o.icon}</span>
            <span className="flex-1">
              <span className="block font-black">{o.label}</span>
              <span className="block text-xs text-[var(--muted)]">{o.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <button type="button" onClick={onRules} className="mx-auto mt-4 flex items-center gap-1 text-sm font-bold text-[var(--muted)] hover:text-[var(--text)]">
        <CircleHelp size={16} /> 遊び方
      </button>
    </Modal>
  )
}

export function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="mb-3 text-lg font-black">遊び方</h2>
      <div className="space-y-3 text-sm leading-relaxed">
        <p>
          錬金術師となって素材を集め、調合カードを達成しよう。<b>先に{WIN_SCORE}点</b>を獲得した方の勝ち！
        </p>
        <div>
          <p className="mb-1 font-bold">素材（各7個）</p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
            {COLORS.map((c) => (
              <li key={c} className="flex items-center gap-1.5">
                <Gem color={c} size={16} /> {MATERIAL[c].name}
              </li>
            ))}
          </ul>
        </div>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <b>素材を取る</b>：黒い矢印トークンが指すライン（ハイライト部分）から、好きなタイルを1枚取ります。矢印はそのマスへ移動し、<b>向きが90度回転</b>します。
          </li>
          <li>
            <b>調合する（任意）</b>：場の3枚のカードのうち「達成可能」なものを選び「調合する」。素材を消費して得点を獲得します。1手番に何枚でも調合できます。
          </li>
          <li>
            <b>手番終了</b>：相手の手番へ。矢印の新しい向きが相手の取れるラインになります。
          </li>
        </ol>
        <div className="rounded-xl bg-[var(--card)] p-3">
          <p className="font-bold">3:1 変換</p>
          <p>
            <b>同じ素材3個</b>を好きな素材1個に変換できます。自分の手番中なら、所持欄の3個以上ある素材をタップしていつでも変換できます。
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">
            例：要求 <Gem color="red" size={14} />
            <Gem color="blue" size={14} />（鱗・涙）に対し、手持ち <Gem color="red" size={14} />
            <Gem color="green" size={14} />
            <Gem color="green" size={14} />
            <Gem color="green" size={14} />（鱗・マンドラゴラ3）で達成可能
          </p>
        </div>
        <div className="rounded-xl bg-[var(--card)] p-3">
          <p className="font-bold">調合カード</p>
          <p>銅枠＝1点（素材2個）、銀枠＝2点（素材3個）、金枠＝3点（素材5個）。</p>
        </div>
        <p>
          <b>先手・後手</b>：開始時に先手・後手・ランダムから選べます。後手は最初にランダムな素材を持って始めます（0〜{MAX_BONUS}個、開始時に選択）。
        </p>
        <p>
          <b>手詰まり</b>：次の手番の人が取れるタイルがラインに1枚もなければゲーム終了。得点の高い方が勝ち（同点は引き分け）。
        </p>
        <p className="text-xs text-[var(--muted)]">戦略のヒント：自分が取ったマスが相手の次のラインになります。相手に欲しい素材を渡さないように！</p>
      </div>
    </Modal>
  )
}

export function ResultModal() {
  const game = useGame((s) => s.game)
  const reset = useGame((s) => s.reset)
  const undo = useGame((s) => s.undo)
  const canUndo = useGame((s) => s.history.length > 0)
  const open = game.phase === 'gameover'
  const { p1, cpu } = game.players
  const title = game.winner === 'p1' ? 'あなたの勝利！' : game.winner === 'cpu' ? 'CPUの勝利…' : '引き分け'
  const reason = game.overReason === 'score' ? `${WIN_SCORE}点に到達` : '取れるタイルがなくなりました（手詰まり）'

  return (
    <Modal open={open}>
      <div className="text-center">
        <motion.div initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', delay: 0.15 }} className="mx-auto mb-2 w-fit">
          <Trophy size={48} className={game.winner === 'p1' ? 'text-amber-400' : 'text-[var(--muted)]'} />
        </motion.div>
        <h2 className="text-2xl font-black">{title}</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">{reason}</p>
        <div className="my-4 grid grid-cols-2 gap-2">
          {[
            ['あなた', p1],
            ['CPU', cpu],
          ].map(([name, p]) => {
            const ps = p as typeof p1
            return (
              <div key={name as string} className="rounded-xl bg-[var(--card)] p-3">
                <div className="text-xs font-bold text-[var(--muted)]">{name as string}</div>
                <div className="text-3xl font-black tabular-nums">{ps.score}</div>
                <div className="mt-1 space-y-0.5 text-[11px] text-[var(--muted)]">
                  {ps.crafted.length ? ps.crafted.map((c) => <div key={c.id}>{c.name}（{c.points}点）</div>) : <div>調合なし</div>}
                </div>
              </div>
            )
          })}
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-2.5 font-bold text-white shadow hover:brightness-110"
        >
          <RotateCcw size={18} /> もう一度遊ぶ
        </button>
        {DEBUG && (
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="mx-auto mt-3 flex items-center gap-1 text-sm font-bold text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30"
          >
            <Undo2 size={16} /> 一手戻る（デバッグ用）
          </button>
        )}
      </div>
    </Modal>
  )
}
