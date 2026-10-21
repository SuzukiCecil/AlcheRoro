import { create } from 'zustand'
import { cpuCraft, cpuMove, LEVELS, type Level } from './cpu'
import { convert, craft, createGame, endTurn, isLegal, opponent, pickTile } from './engine'
import { COLORS, SECOND_PLAYER_BONUS, type Color, type GameState, type PlayerId, type Pos } from './types'

/** 素材が所持欄へ飛ぶ時間 */
export const FLIGHT_MS = 650

export type TurnOrder = 'first' | 'second' | 'random'

/** 所持欄へ飛んでいる途中の素材。着地するまで所持数の表示には加算しない */
export interface Flight {
  key: number
  player: PlayerId
  color: Color
  /** 盤面のマスから / 後手ボーナス（画面中央で見せ、OK で飛ぶ） */
  from: Pos | 'bonus'
}

interface Store {
  game: GameState
  /** 先手・後手の選択画面を表示中 */
  setup: boolean
  /** 開始時の後手ボーナス表示中（OK を押すまで進行しない） */
  intro: boolean
  /** リセット時に進行中のCPU処理を無効化するための世代番号 */
  epoch: number
  shake: { row: number; col: number; key: number } | null
  lastCraft: { cardId: string; player: PlayerId; key: number } | null
  flights: Flight[]
  /** CPUの強さ（選択画面で選ぶ。次回のために保存） */
  level: Level
  setLevel: (level: Level) => void
  /** 後手ボーナスの素材数（0〜MAX_BONUS。選択画面で選ぶ。次回のために保存） */
  bonus: number
  setBonus: (bonus: number) => void
  /** オンなら調合時に不足分を3:1で自動変換する（現在は画面に切り替えがなく、AUTO_CONVERT の値で固定） */
  autoConvert: boolean
  setAutoConvert: (on: boolean) => void
  /** 手動変換（自分の手番中いつでも） */
  convert: (from: Color, to: Color) => void
  start: (order: TurnOrder) => void
  dismissIntro: () => void
  selectTile: (pos: Pos) => void
  craftCard: (index: number) => void
  endTurn: () => void
  reset: () => void
  landFlight: (key: number) => void
  /** デバッグ用：自分の操作の直前の局面（新しいものが末尾） */
  history: GameState[]
  /** デバッグ用：自分の操作を1つ取り消す（その後のCPUの手番も取り消される） */
  undo: () => void
}

const HISTORY_LIMIT = 200
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** CPUの考える演出の時間。先読みにかかった時間はここから差し引く */
const thinkMs = () => 600 + Math.random() * 400
let flightSeq = 0
const pickFlight = (game: GameState, pos: Pos): Flight => ({
  key: ++flightSeq,
  player: game.current,
  color: game.board[pos.row][pos.col] as Color,
  from: pos,
})
const LEVEL_KEY = 'alcheroro.level'
const BONUS_KEY = 'alcheroro.bonus'
export const MAX_BONUS = 2
/**
 * 調合時の自動変換。わかりにくいため切り替えスイッチは外し、手動変換のみにしている。
 * 戻すときは true にするか、setAutoConvert を呼ぶUI（PlayerPanel の ConvertBar）を復活させる。
 */
const AUTO_CONVERT = false
/** 設定の読み書き。保存領域が使えない環境では既定値で動かす */
function load(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 保存できなくても今回のゲームには反映する
  }
}
function savedLevel(): Level {
  const v = load(LEVEL_KEY)
  return v && v in LEVELS ? (v as Level) : 'normal'
}

function savedBonus(): number {
  const v = Number(load(BONUS_KEY) ?? NaN)
  return Number.isInteger(v) && v >= 0 && v <= MAX_BONUS ? v : SECOND_PLAYER_BONUS
}

/** 選択画面の背景に出す盤面（ボーナスなし） */
const previewGame = () => createGame(Math.random, { secondBonus: 0 })

export const useGame = create<Store>((set, get) => {
  /** 自分の操作の直前の局面を記録する（一手戻る用） */
  const remember = (game: GameState) => ({ history: [...get().history, game].slice(-HISTORY_LIMIT) })

  async function runCpu(epoch: number, delay = 0) {
    const alive = () => get().epoch === epoch && get().game.current === 'cpu' && get().game.phase !== 'gameover'
    await wait(delay)
    if (!alive()) return
    const started = performance.now()
    const game = get().game
    const { level } = get()
    const move = cpuMove(game, level)
    await wait(Math.max(0, thinkMs() - (performance.now() - started)))
    if (!alive() || !move) return
    set((s) => ({ game: pickTile(game, move), flights: [...s.flights, pickFlight(game, move)] }))
    for (;;) {
      // 取った素材が所持欄に届いてから調合する
      await wait(FLIGHT_MS + 150)
      if (!alive()) return
      const i = cpuCraft(get().game, level)
      if (i === null) break
      const card = get().game.market[i]!
      set({ game: craft(get().game, i), lastCraft: { cardId: card.id, player: 'cpu', key: Date.now() } })
    }
    if (!alive()) return
    afterTurn(endTurn(get().game))
  }

  function afterTurn(game: GameState) {
    set({ game })
    if (game.phase !== 'gameover' && game.current === 'cpu') void runCpu(get().epoch)
  }

  return {
    game: previewGame(),
    setup: true,
    intro: false,
    epoch: 0,
    shake: null,
    lastCraft: null,
    flights: [],
    level: savedLevel(),
    setLevel: (level) => {
      save(LEVEL_KEY, level)
      set({ level })
    },
    bonus: savedBonus(),
    setBonus: (bonus) => {
      save(BONUS_KEY, String(bonus))
      set({ bonus })
    },
    autoConvert: AUTO_CONVERT,
    setAutoConvert: (on) => set({ autoConvert: on }),
    convert: (from, to) => {
      const { game, setup, intro } = get()
      if (setup || intro || game.current !== 'p1') return
      const next = convert(game, from, to)
      if (next !== game) set({ game: next, ...remember(game) })
    },
    start: (order) => {
      const first: PlayerId = order === 'first' ? 'p1' : order === 'second' ? 'cpu' : Math.random() < 0.5 ? 'p1' : 'cpu'
      // 選択画面の背景に見えていた盤面をそのまま使う（山札・ボーナスだけ新しく決める）
      const preview = get().game
      const game = { ...createGame(Math.random, { first, secondBonus: get().bonus }), board: preview.board, arrow: preview.arrow }
      const second = opponent(first)
      const inv = game.players[second].inventory
      const bonus: Flight[] = COLORS.flatMap((color) =>
        Array.from({ length: inv[color] }, () => ({ key: ++flightSeq, player: second, color, from: 'bonus' as const })),
      )
      const epoch = get().epoch + 1
      set({ game, setup: false, intro: bonus.length > 0, epoch, flights: bonus, shake: null, lastCraft: null, history: [] })
      if (!bonus.length && first === 'cpu') void runCpu(epoch)
    },
    dismissIntro: () => {
      const { intro, game, epoch } = get()
      if (!intro) return
      set({ intro: false })
      // ボーナス素材が所持欄に届いてからCPUが動き出す
      if (game.current === 'cpu') void runCpu(epoch, FLIGHT_MS)
    },
    selectTile: (pos) => {
      const { game, setup, intro } = get()
      if (setup || intro || game.current !== 'p1' || game.phase !== 'pick') return
      if (!isLegal(game, pos)) {
        set({ shake: { ...pos, key: Date.now() } })
        return
      }
      set((s) => ({ game: pickTile(game, pos), flights: [...s.flights, pickFlight(game, pos)], ...remember(game) }))
    },
    craftCard: (index) => {
      const { game, autoConvert } = get()
      if (game.current !== 'p1') return
      const card = game.market[index]
      const next = craft(game, index, autoConvert)
      if (next !== game && card) set({ game: next, lastCraft: { cardId: card.id, player: 'p1', key: Date.now() }, ...remember(game) })
    },
    endTurn: () => {
      const { game } = get()
      if (game.current !== 'p1' || game.phase !== 'craft') return
      set(remember(game))
      afterTurn(endTurn(game))
    },
    reset: () =>
      set((s) => ({ game: previewGame(), setup: true, intro: false, epoch: s.epoch + 1, shake: null, lastCraft: null, flights: [], history: [] })),
    landFlight: (key) => set((s) => ({ flights: s.flights.filter((f) => f.key !== key) })),
    history: [],
    undo: () => {
      const { history, setup } = get()
      const prev = history.at(-1)
      if (setup || !prev) return
      // 進行中のCPU処理と飛行中の演出は捨てる
      set((s) => ({ game: prev, history: history.slice(0, -1), epoch: s.epoch + 1, intro: false, flights: [], shake: null, lastCraft: null }))
    },
  }
})
