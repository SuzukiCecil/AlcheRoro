import { createDeck } from './cards'
import {
  BOARD_SIZE,
  COLORS,
  CONVERSION_RATE,
  MATERIAL,
  MARKET_SIZE,
  SECOND_PLAYER_BONUS,
  TILES_PER_COLOR,
  WIN_SCORE,
  emptyInventory,
  type Board,
  type Cell,
  type Color,
  type GameState,
  type Inventory,
  type Payment,
  type PlayerId,
  type Pos,
  type RecipeCard,
} from './types'

export type Rng = () => number

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const opponent = (p: PlayerId): PlayerId => (p === 'p1' ? 'cpu' : 'p1')

/**
 * 初期化：36マスのうち1マスを「予備」として空け、そこに矢印を置く。
 * 残り35マスに5種×7枚の素材タイルをランダム配置。
 * 後手は先手有利の補正としてランダム素材を secondBonus 個持って始める（盤面とは別枠）。
 */
export function createGame(
  rng: Rng = Math.random,
  { secondBonus = SECOND_PLAYER_BONUS, first = 'p1' as PlayerId } = {},
): GameState {
  const second = opponent(first)
  const tiles = shuffle(
    COLORS.flatMap((c) => Array<Color>(TILES_PER_COLOR).fill(c)),
    rng,
  )
  const start = Math.floor(rng() * BOARD_SIZE * BOARD_SIZE)
  const board: Board = []
  let k = 0
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: Cell[] = []
    for (let c = 0; c < BOARD_SIZE; c++) {
      row.push(r * BOARD_SIZE + c === start ? null : tiles[k++])
    }
    board.push(row)
  }
  const deck = shuffle(createDeck(), rng)
  const market = deck.splice(0, MARKET_SIZE)
  const bonus = emptyInventory()
  for (let i = 0; i < secondBonus; i++) bonus[COLORS[Math.floor(rng() * COLORS.length)]]++
  const bonusText = COLORS.filter((c) => bonus[c]).map((c) => `${MATERIAL[c].name}${bonus[c] > 1 ? `×${bonus[c]}` : ''}`).join('・')
  return {
    board,
    arrow: {
      row: Math.floor(start / BOARD_SIZE),
      col: start % BOARD_SIZE,
      dir: rng() < 0.5 ? 'VERTICAL' : 'HORIZONTAL',
    },
    deck,
    market,
    players: {
      p1: { score: 0, inventory: second === 'p1' ? bonus : emptyInventory(), crafted: [] },
      cpu: { score: 0, inventory: second === 'cpu' ? bonus : emptyInventory(), crafted: [] },
    },
    first,
    current: first,
    phase: 'pick',
    turn: 1,
    winner: null,
    overReason: null,
    log: secondBonus ? [{ turn: 0, player: second, text: `後手ボーナスとして${bonusText}を所持` }] : [],
  }
}

/** 矢印が指すライン上（矢印位置を除く）にある未取得タイル */
export function legalMoves(state: Pick<GameState, 'board' | 'arrow'>): Pos[] {
  const { board, arrow } = state
  const moves: Pos[] = []
  for (let i = 0; i < BOARD_SIZE; i++) {
    const pos = arrow.dir === 'HORIZONTAL' ? { row: arrow.row, col: i } : { row: i, col: arrow.col }
    if (pos.row === arrow.row && pos.col === arrow.col) continue
    if (board[pos.row][pos.col]) moves.push(pos)
  }
  return moves
}

export const isOnLine = (arrow: GameState['arrow'], pos: Pos) =>
  arrow.dir === 'HORIZONTAL' ? pos.row === arrow.row : pos.col === arrow.col

export function isLegal(state: GameState, pos: Pos): boolean {
  return legalMoves(state).some((m) => m.row === pos.row && m.col === pos.col)
}

/**
 * 支払い計算。不足1個につき、要求に使わない同一素材3個で代替できる（autoConvert = false なら代替しない）。
 * 払えない場合は null。
 */
export function computePayment(inv: Inventory, cost: RecipeCard['cost'], autoConvert = true): Payment | null {
  const direct: Partial<Record<Color, number>> = {}
  const surplus = { ...inv }
  const deficits: Color[] = []
  for (const c of COLORS) {
    const need = cost[c] ?? 0
    if (!need) continue
    const pay = Math.min(inv[c], need)
    if (pay) direct[c] = pay
    surplus[c] -= pay
    for (let i = 0; i < need - pay; i++) deficits.push(c)
  }
  if (deficits.length && !autoConvert) return null
  const conversions: Payment['conversions'] = []
  for (const to of deficits) {
    // 余剰の最も多い素材から変換（どれを選んでも変換可能回数は変わらない）
    const from = [...COLORS].sort((a, b) => surplus[b] - surplus[a])[0]
    if (surplus[from] < CONVERSION_RATE) return null
    surplus[from] -= CONVERSION_RATE
    conversions.push({ from, to })
  }
  return { direct, conversions }
}

export function applyPayment(inv: Inventory, payment: Payment): Inventory {
  const next = { ...inv }
  for (const c of COLORS) next[c] -= payment.direct[c] ?? 0
  for (const { from } of payment.conversions) next[from] -= CONVERSION_RATE
  return next
}

export function describePayment(payment: Payment): string {
  const parts = COLORS.filter((c) => payment.direct[c]).map((c) => `${MATERIAL[c].short}${payment.direct[c]}`)
  const conv = payment.conversions.map(({ from, to }) => `${MATERIAL[from].short}3→${MATERIAL[to].short}1`)
  return [...parts, ...conv].join(' / ')
}

const log = (state: GameState, text: string): GameState['log'] => [
  ...state.log,
  { turn: state.turn, player: state.current, text },
]

/** 1. タイル選択：取得 → 矢印移動 → 90度回転 */
export function pickTile(state: GameState, pos: Pos): GameState {
  if (state.phase !== 'pick' || !isLegal(state, pos)) return state
  const color = state.board[pos.row][pos.col] as Color
  const board = state.board.map((row) => [...row])
  board[pos.row][pos.col] = null
  const me = state.players[state.current]
  return {
    ...state,
    board,
    arrow: { ...pos, dir: state.arrow.dir === 'VERTICAL' ? 'HORIZONTAL' : 'VERTICAL' },
    players: {
      ...state.players,
      [state.current]: { ...me, inventory: { ...me.inventory, [color]: me.inventory[color] + 1 } },
    },
    phase: 'craft',
    log: log(state, `${MATERIAL[color].name}を取得`),
  }
}

export function canCraft(state: GameState, index: number, autoConvert = true): Payment | null {
  const card = state.market[index]
  if (!card || state.phase !== 'craft') return null
  return computePayment(state.players[state.current].inventory, card.cost, autoConvert)
}

/** 手動変換：同じ素材3個 → 好きな素材1個。自分の手番中ならいつでも行える */
export function convert(state: GameState, from: Color, to: Color): GameState {
  const me = state.players[state.current]
  if (state.phase === 'gameover' || from === to || me.inventory[from] < CONVERSION_RATE) return state
  const inventory = { ...me.inventory, [from]: me.inventory[from] - CONVERSION_RATE, [to]: me.inventory[to] + 1 }
  return {
    ...state,
    players: { ...state.players, [state.current]: { ...me, inventory } },
    log: log(state, `${MATERIAL[from].name}${CONVERSION_RATE}個を${MATERIAL[to].name}1個に変換`),
  }
}

/**
 * 場のカードを補充するタイミング。
 * - turnEnd：手番の終わりにまとめて補充（調合で空いた場所は、その手番の間は空きのまま）
 * - craft：調合するたびにすぐ補充（旧ルール。シミュレーションの比較用）
 */
export const RULES: { refill: 'turnEnd' | 'craft' } = { refill: 'turnEnd' }

/** 場の空きを山札から埋める */
export function refillMarket(state: GameState): GameState {
  if (!state.market.includes(null) || state.deck.length === 0) return state
  const deck = [...state.deck]
  const market = state.market.map((c) => c ?? deck.shift() ?? null)
  return { ...state, deck, market }
}

/** 2. 調合：コスト消費 → 得点加算 → 6点で即勝利（補充は手番の終わり） */
export function craft(state: GameState, index: number, autoConvert = true): GameState {
  const payment = canCraft(state, index, autoConvert)
  const card = state.market[index]
  if (!payment || !card) return state
  const me = state.players[state.current]
  const deck = [...state.deck]
  const market = [...state.market]
  market[index] = RULES.refill === 'craft' ? (deck.shift() ?? null) : null
  const score = me.score + card.points
  const next: GameState = {
    ...state,
    deck,
    market,
    players: {
      ...state.players,
      [state.current]: {
        score,
        inventory: applyPayment(me.inventory, payment),
        crafted: [...me.crafted, card],
      },
    },
    log: log(state, `「${card.name}」を調合（+${card.points}点）`),
  }
  if (score >= WIN_SCORE) {
    return { ...next, phase: 'gameover', winner: state.current, overReason: 'score' }
  }
  return next
}

/** 3. 場の補充 → 終了判定 & ターン交代 */
export function endTurn(current: GameState): GameState {
  if (current.phase !== 'craft') return current
  const state = refillMarket(current)
  const nextPlayer = opponent(state.current)
  if (legalMoves(state).length === 0) {
    const { p1, cpu } = state.players
    const winner = p1.score === cpu.score ? 'draw' : p1.score > cpu.score ? 'p1' : 'cpu'
    return { ...state, phase: 'gameover', winner, overReason: 'stalemate' }
  }
  return {
    ...state,
    current: nextPlayer,
    phase: 'pick',
    turn: nextPlayer === state.first ? state.turn + 1 : state.turn,
  }
}

export const craftableIndexes = (state: GameState, autoConvert = true): number[] =>
  state.market.flatMap((_, i) => (canCraft(state, i, autoConvert) ? [i] : []))
