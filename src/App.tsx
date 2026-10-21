import { AnimatePresence, motion } from 'framer-motion'
import { CircleHelp, FlaskConical, RotateCcw, SkipForward, Sparkles, Undo2, LayoutGrid } from 'lucide-react'
import { HUB_URL } from './hub'
import { useEffect, useState } from 'react'
import { Board } from './components/Board'
import { FlyingGems } from './components/FlyingGems'
import { Market } from './components/Market'
import { ResultModal, RulesModal, StartModal } from './components/Modals'
import { PlayerPanel } from './components/PlayerPanel'
import { canCraft, craftableIndexes } from './game/engine'
import { DEBUG } from './debug'
import { useGame } from './game/store'

export default function App() {
  const game = useGame((s) => s.game)
  const lastCraft = useGame((s) => s.lastCraft)
  const craftCard = useGame((s) => s.craftCard)
  const endTurn = useGame((s) => s.endTurn)
  const reset = useGame((s) => s.reset)
  const undo = useGame((s) => s.undo)
  const canUndo = useGame((s) => !s.setup && s.history.length > 0)
  const setup = useGame((s) => s.setup)
  const autoConvert = useGame((s) => s.autoConvert)
  const [selected, setSelected] = useState<number | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [toast, setToast] = useState<{ key: number; text: string; cpu: boolean } | null>(null)

  const myTurn = !setup && game.current === 'p1' && game.phase !== 'gameover'
  const myCraft = myTurn && game.phase === 'craft'
  const craftable = myCraft ? craftableIndexes(game, autoConvert) : []
  // 自動変換オフのとき、手動で変換すれば作れるカードがあるか
  const convertible = myCraft && !autoConvert && !craftable.length && craftableIndexes(game).length > 0
  const selectedOk = selected !== null && myCraft && !!canCraft(game, selected, autoConvert)

  // 選択が無効になったら解除・候補が1枚なら自動選択
  useEffect(() => {
    if (!myCraft) setSelected(null)
    else if (selected === null || !canCraft(game, selected, autoConvert)) setSelected(craftable.length === 1 ? craftable[0] : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, autoConvert])

  useEffect(() => {
    if (!lastCraft) return
    const card = game.players[lastCraft.player].crafted.at(-1)
    if (!card) return
    setToast({ key: lastCraft.key, text: `${lastCraft.player === 'cpu' ? 'CPU' : 'あなた'}が「${card.name}」を調合！ +${card.points}点`, cpu: lastCraft.player === 'cpu' })
    const t = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCraft])

  const status = setup
    ? '手番を選んでください'
    : game.phase === 'gameover'
      ? 'ゲーム終了'
      : game.current === 'cpu'
        ? 'CPUの手番'
        : game.phase === 'pick'
          ? 'ライン上の素材を1つ選んでください'
          : craftable.length
            ? '調合するカードを選ぶか、手番を終了'
            : convertible
              ? '素材を変換すれば調合できるカードがあります'
              : '調合できるカードはありません'

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pb-6">
      <header className="sticky top-0 z-30 -mx-4 mb-2 flex md:mb-3 items-center justify-between gap-2 bg-[var(--bg)]/90 px-4 py-1.5 backdrop-blur md:py-2.5">
        <div className="flex min-w-0 items-center gap-1">
          <HubLink />
          <h1 className="flex items-center gap-1.5 text-base font-black tracking-tight sm:text-xl">
            <FlaskConical className="text-[var(--accent)]" size={22} />
            <span className="flex flex-col leading-none">
              <span className="flex items-baseline gap-1.5">
                AlcheRoro
                <span className="hidden text-xs font-bold text-[var(--muted)] sm:inline">アルケロロ</span>
              </span>
              <span className="mt-0.5 text-[10px] font-bold tracking-normal text-[var(--muted)]">inspired by COLORO</span>
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1.5">
          <span
            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold text-white ${game.current === 'cpu' ? 'bg-rose-500' : 'bg-[var(--accent)]'}`}
          >
            {setup ? (
              '準備中'
            ) : game.phase === 'gameover' ? (
              '終了'
            ) : (
              <>
                <span className="hidden sm:inline">ターン</span>
                <span className="sm:hidden">T</span>
                {game.turn}・{game.current === 'cpu' ? 'CPU' : 'あなた'}
              </>
            )}
          </span>
          {DEBUG && (
            <button
              type="button"
              aria-label="一手戻る（デバッグ用）"
              title="一手戻る（デバッグ用）"
              disabled={!canUndo}
              onClick={undo}
              className="rounded-full p-1.5 hover:bg-[var(--panel)] sm:p-2 disabled:opacity-30"
            >
              <Undo2 size={20} />
            </button>
          )}
          <button type="button" aria-label="ルール" onClick={() => setRulesOpen(true)} className="rounded-full p-1.5 hover:bg-[var(--panel)] sm:p-2">
            <CircleHelp size={20} />
          </button>
          <button
            type="button"
            aria-label="リセット"
            onClick={() => {
              if (setup || game.log.every((e) => e.turn === 0) || confirm('ゲームをリセットしますか？')) reset()
            }}
            className="rounded-full p-1.5 hover:bg-[var(--panel)] sm:p-2"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </header>

      {/*
        PC：左＝盤面と行動ログ、右＝CPU・調合カード・自分の情報・調合ボタンを上から並べる。
        スマホ：なるべくスクロールせずに済むよう詰めて、1列で CPU → 盤面 → 調合カード → 自分 → ボタン → ログ の順（列のラッパーを contents にして order で並べ替える）。
      */}
      <main className="flex flex-1 flex-col gap-1.5 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-6">
        <div className="contents md:sticky md:top-16 md:flex md:flex-col md:gap-3">
          <div className="order-2 md:order-none">
            <Board />
          </div>
          <p className="order-3 text-center text-xs font-bold md:text-sm text-[var(--muted)] md:order-none">{status}</p>
          <div className="order-7 md:order-none">
            <Log />
          </div>
        </div>

        <div className="contents md:flex md:flex-col md:gap-3">
          <div className="order-1 md:order-none">
            <PlayerPanel id="cpu" />
          </div>
          <div className="order-4 md:order-none">
            <Market selected={selected} onSelect={setSelected} />
          </div>
          <div className="order-5 md:order-none">
            <PlayerPanel id="p1" />
          </div>
          <div className="order-6 md:order-none">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!selectedOk}
                onClick={() => selected !== null && craftCard(selected)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2 font-bold md:py-3 text-white shadow transition enabled:hover:brightness-110 disabled:opacity-35"
              >
                <Sparkles size={18} /> 調合する
              </button>
              <button
                type="button"
                disabled={!myCraft}
                onClick={endTurn}
                className={`flex items-center justify-center gap-1.5 rounded-xl bg-slate-700 py-2 font-bold md:py-3 text-white shadow transition enabled:hover:brightness-110 disabled:opacity-35 dark:bg-slate-600 ${myCraft && !craftable.length && !convertible ? 'tile-pulse' : ''}`}
              >
                <SkipForward size={18} /> 手番終了
              </button>
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-xl ${toast.cpu ? 'bg-rose-500' : 'bg-emerald-500'}`}
          >
            <Sparkles size={16} /> {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      <FlyingGems />
      <StartModal onRules={() => setRulesOpen(true)} />
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <ResultModal />
    </div>
  )
}

function Log() {
  const log = useGame((s) => s.game.log)
  return (
    <details className="rounded-xl bg-[var(--panel)] p-2.5 text-xs">
      <summary className="cursor-pointer font-bold text-[var(--muted)]">行動ログ（{log.length}）</summary>
      <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto">
        {[...log].reverse().map((e, i) => (
          <li key={i}>
            <span className="text-[var(--muted)]">T{e.turn}</span>{' '}
            <b className={e.player === 'cpu' ? 'text-rose-500' : 'text-[var(--accent)]'}>{e.player === 'cpu' ? 'CPU' : 'あなた'}</b> {e.text}
          </li>
        ))}
      </ul>
    </details>
  )
}

/** ゲーム集の入口へ戻る */
function HubLink() {
  return (
    <a href={HUB_URL} aria-label="ゲーム一覧へ" title="ゲーム一覧へ" className="-ml-1.5 shrink-0 rounded-full p-1.5 text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--text)]">
      <LayoutGrid size={18} />
    </a>
  )
}
