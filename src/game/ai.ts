import { applyPayment, canCraft, craft, legalMoves, opponent, pickTile, type Rng } from './engine'
import { COLORS, CONVERSION_RATE, WIN_SCORE, type GameState, type Inventory, type Pos, type RecipeCard } from './types'

/** カード達成までに足りない素材数（3:1変換で埋められる分を差し引く） */
export function shortfall(inv: Inventory, card: RecipeCard): number {
  let deficit = 0
  let convertible = 0
  for (const c of COLORS) {
    const need = card.cost[c] ?? 0
    deficit += Math.max(0, need - inv[c])
    convertible += Math.floor(Math.max(0, inv[c] - need) / CONVERSION_RATE)
  }
  return Math.max(0, deficit - convertible)
}

/**
 * CPUの戦略。タイル選択の評価（どのカードを狙うか）と、調合の判断（今作るか温存するか）を決める。
 */
export interface Strategy {
  id: string
  label: string
  description: string
  /** 場のカードを狙う重み（リーチ価値の倍率） */
  cardWeight: (card: RecipeCard) => number
  /** 調合可能なカードのうち、どれから作るか（小さいほど先） */
  craftOrder: (card: RecipeCard) => number
  /** そのカードを今調合してよいか（false なら温存） */
  shouldCraft: (state: GameState, index: number) => boolean
}

const always = () => true

/**
 * 高得点カード温存型：場に「あと range 個以内で作れる target 点カード」があれば、
 * その不足数を増やしてしまう安いカードの調合を見送る。勝利点に届く調合は常に行う。
 */
function saveForHigh(range: number, target = 3) {
  return (state: GameState, index: number): boolean => {
    const me = state.players[state.current]
    const card = state.market[index]!
    if (card.points >= target || me.score + card.points >= WIN_SCORE) return true
    const targets = state.market
      .filter((c, j): c is RecipeCard => !!c && j !== index && c.points === target)
      .map((c) => ({ c, sf: shortfall(me.inventory, c) }))
      .filter(({ sf }) => sf <= range)
      .sort((a, b) => a.sf - b.sf)
    if (!targets.length) return true
    const payment = canCraft(state, index)!
    const after = applyPayment(me.inventory, payment)
    return shortfall(after, targets[0].c) <= targets[0].sf
  }
}

export const STRATEGIES = {
  greedy: {
    id: 'greedy',
    label: '即調合',
    description: '作れるカードは得点の高い順にすぐ作る（ゲーム内CPUの標準）',
    cardWeight: () => 1,
    craftOrder: (c) => -c.points,
    shouldCraft: always,
  },
  cheap: {
    id: 'cheap',
    label: '小刻み',
    description: '安いカードを優先して狙い、すぐ作る',
    cardWeight: (c) => [0, 1.5, 1, 0.5][c.points],
    craftOrder: (c) => c.points,
    shouldCraft: always,
  },
  aim2: {
    id: 'aim2',
    label: '2点狙い',
    description: '2点カードを重視。あと2個以内で作れる2点カードがあれば、それを邪魔する1点カードの調合は見送る',
    cardWeight: (c) => [0, 0.5, 2, 0.8][c.points],
    craftOrder: (c) => -c.points,
    shouldCraft: saveForHigh(2, 2),
  },
  aimNear: {
    id: 'aimNear',
    label: '3点狙い（近ければ温存）',
    description: '3点カードを重視。あと2個以内で作れる3点カードがあれば、それを邪魔する調合は見送る',
    cardWeight: (c) => [0, 0.5, 1, 2][c.points],
    craftOrder: (c) => -c.points,
    shouldCraft: saveForHigh(2),
  },
  aimAlways: {
    id: 'aimAlways',
    label: '3点最優先（常に温存）',
    description: '場に3点カードがある限り、それを邪魔する調合はしない',
    cardWeight: (c) => [0, 0.3, 0.8, 2.5][c.points],
    craftOrder: (c) => -c.points,
    shouldCraft: saveForHigh(Infinity),
  },
} satisfies Record<string, Strategy>

export type StrategyId = keyof typeof STRATEGIES
export const DEFAULT_STRATEGY: Strategy = STRATEGIES.greedy

/** CPUが調合すべきカードのインデックス（なければ null） */
export function chooseCraft(state: GameState, strategy: Strategy = DEFAULT_STRATEGY): number | null {
  if (state.phase !== 'craft') return null
  const options = state.market
    .map((card, i) => ({ card, i }))
    .filter(({ card, i }) => card && canCraft(state, i) && strategy.shouldCraft(state, i))
    .sort((a, b) => strategy.craftOrder(a.card!) - strategy.craftOrder(b.card!))
  return options[0]?.i ?? null
}

/** 戦略に従って、作れる限り調合を続ける */
export function craftAll(state: GameState, strategy: Strategy = DEFAULT_STRATEGY): GameState {
  let s = state
  for (let i = chooseCraft(s, strategy); i !== null; i = chooseCraft(s, strategy)) s = craft(s, i)
  return s
}

/** 調合の順番をすべて試し、この手番で得られる最大得点（勝利点に届くなら Infinity） */
function maxCraftGain(state: GameState): number {
  if (state.phase === 'gameover') return Infinity
  let best = 0
  state.market.forEach((card, i) => {
    if (card && canCraft(state, i)) best = Math.max(best, card.points + maxCraftGain(craft(state, i)))
  })
  return best
}

/**
 * 自分の手番を終えた局面 after から、相手の次の手番を全探索する。
 * 相手が勝利点に届く、または相手リードのまま手詰まりにできるなら wins = true。
 */
function foeOutlook(after: GameState): { wins: boolean; gain: number } {
  const me = after.current
  const foe = opponent(me)
  const state: GameState = { ...after, current: foe, phase: 'pick' }
  let gain = 0
  for (const m of legalMoves(state)) {
    const picked = pickTile(state, m)
    const g = maxCraftGain(picked)
    const foeScore = state.players[foe].score + g
    if (foeScore >= WIN_SCORE) return { wins: true, gain: g }
    // 相手の取得後に置ける場所がなければ、その手番の終わりに手詰まりで決着する
    if (legalMoves(picked).length === 0 && foeScore > state.players[me].score) return { wins: true, gain: g }
    gain = Math.max(gain, g)
  }
  return { wins: false, gain }
}

export function evaluateMove(state: GameState, pos: Pos, strategy: Strategy = DEFAULT_STRATEGY): number {
  const me = state.current
  const foe = me === 'p1' ? 'cpu' : 'p1'
  const color = state.board[pos.row][pos.col]!
  const before = state.players[me].inventory
  const picked = pickTile(state, pos)
  const after = craftAll(picked, strategy)
  let score = 0

  // 即時達成価値（+50〜100）
  const gained = after.players[me].score - state.players[me].score
  if (after.phase === 'gameover') return 10_000
  if (gained > 0) score += 50 + (Math.min(gained, 3) - 1) * 25

  // リーチ価値（+20 × 戦略の重み）：場のカードの不足数が減るか
  if (gained === 0) {
    const inv = picked.players[me].inventory
    let reach = 0
    for (const card of state.market) {
      if (!card) continue
      const gain = shortfall(before, card) - shortfall(inv, card)
      if (gain > 0) reach = Math.max(reach, gain * strategy.cardWeight(card))
    }
    score += reach * 20
  }

  // 同種3個シナジー（+10）
  if (before[color] === CONVERSION_RATE - 1) score += 10

  // 相手への妨害（+15）／手詰まり時の勝敗
  if (legalMoves(after).length === 0) {
    const diff = after.players[me].score - after.players[foe].score
    score += diff > 0 ? 5_000 : diff < 0 ? -5_000 : -100
  } else {
    // 相手の勝ちが確定する手は、他に選べる手がない場合を除いて選ばない
    const outlook = foeOutlook(after)
    if (outlook.wins) score -= 1_000
    else if (outlook.gain === 0) score += 15
    else score -= outlook.gain * 5
  }
  return score
}

/** 最高評価の手を選択（同点はランダム） */
export function chooseMove(state: GameState, strategy: Strategy = DEFAULT_STRATEGY, rng: Rng = Math.random): Pos | null {
  const moves = legalMoves(state)
  if (!moves.length) return null
  const scored = moves.map((m) => ({ m, s: evaluateMove(state, m, strategy) + rng() }))
  scored.sort((a, b) => b.s - a.s)
  return scored[0].m
}

