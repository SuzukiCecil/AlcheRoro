import { shortfall } from './ai'
import { canCraft, craft, endTurn, legalMoves, opponent, pickTile } from './engine'
import { COLORS, type GameState, type Inventory, type PlayerId, type Pos, type RecipeCard } from './types'

/**
 * 先読み型CPU（つよい）。
 * 「タイル取得＋その手番の調合の組み合わせ」を1手として、自分と相手の手番を交互に depth 手先まで
 * アルファベータ法で読み、盤面評価が最も高くなる手を選ぶ。
 * 山札の中身は見ない：読みの中で調合したカードの跡は空き（補充不明）として扱う。
 */

export interface TurnPlan {
  move: Pos
  /** この手番で調合する場のカードの位置（順番どおり） */
  crafts: number[]
}

interface Option {
  plan: TurnPlan
  state: GameState
}

const WIN = 1_000_000

/** 手番の終わりの補充も、山札の中身を使わず空きのままにする */
function endTurnHidden(state: GameState): GameState {
  return { ...endTurn({ ...state, deck: [] }), deck: state.deck }
}

/** 調合して空いた場所は補充せず空きにする（読みの中で山札の中身を使わない） */
function craftHidden(state: GameState, index: number): GameState {
  const next = craft(state, index)
  if (next === state || next.phase === 'gameover') return next
  const market = [...next.market]
  market[index] = null
  return { ...next, market, deck: state.deck }
}

/** 調合のあらゆる順番で到達できる局面（同じ結果は1つにまとめる） */
function craftOptions(state: GameState, crafts: number[], out: Map<string, { crafts: number[]; state: GameState }>, hidden: boolean) {
  const key = `${state.players[state.current].score}|${COLORS.map((c) => state.players[state.current].inventory[c]).join(',')}|${state.market.map((c) => c?.id ?? '-').join(',')}`
  if (out.has(key)) return
  out.set(key, { crafts, state })
  if (state.phase === 'gameover') return
  state.market.forEach((card, i) => {
    if (card && canCraft(state, i)) craftOptions(hidden ? craftHidden(state, i) : craft(state, i), [...crafts, i], out, hidden)
  })
}

function turnOptions(state: GameState, hidden: boolean): Option[] {
  const options: Option[] = []
  for (const move of legalMoves(state)) {
    const out = new Map<string, { crafts: number[]; state: GameState }>()
    craftOptions(pickTile(state, move), [], out, hidden)
    for (const { crafts, state: s } of out.values()) options.push({ plan: { move, crafts }, state: s })
  }
  return options
}

/** 評価の重み（調整用に公開） */
export const WEIGHTS = {
  /** カードへの近さ：不足0,1,2,…個のときの価値の割合 */
  near: [0.85, 0.5, 0.25, 0.1, 0.04],
  /** 2番目に近いカードの割合 */
  second: 0.3,
  /** 手番側／非手番側の見込みの重み */
  toMove: 60,
  waiting: 40,
  /** 素材1個あたり */
  material: 4,
}
function potential(inv: Inventory, market: (RecipeCard | null)[]): number {
  const values = market
    .filter((c): c is RecipeCard => !!c)
    .map((c) => c.points * (WEIGHTS.near[shortfall(inv, c)] ?? 0))
    .sort((a, b) => b - a)
  return (values[0] ?? 0) + WEIGHTS.second * (values[1] ?? 0)
}

const materials = (inv: Inventory) => COLORS.reduce((t, c) => t + inv[c], 0)

/** player から見た局面の評価（手番は state.current） */
function evaluate(state: GameState, player: PlayerId): number {
  const foe = opponent(player)
  const me = state.players[player]
  const op = state.players[foe]
  let v = (me.score - op.score) * 100
  // 次に動けるのは state.current。カードは早い者勝ちなので手番側の見込みを高めに見る
  const pm = potential(me.inventory, state.market) * (state.current === player ? WEIGHTS.toMove : WEIGHTS.waiting)
  const po = potential(op.inventory, state.market) * (state.current === foe ? WEIGHTS.toMove : WEIGHTS.waiting)
  v += pm - po
  v += (materials(me.inventory) - materials(op.inventory)) * WEIGHTS.material
  return v
}

function terminal(state: GameState, player: PlayerId, depthLeft: number): number {
  if (state.winner === 'draw') return 0
  // 早く勝つ・遅く負けるほうを選ぶ
  return state.winner === player ? WIN + depthLeft : -WIN - depthLeft
}

function negamax(state: GameState, depth: number, alpha: number, beta: number): number {
  const player = state.current
  if (depth === 0) return evaluate(state, player)
  const options = turnOptions(state, true)
  // 得点の高い手から読むと枝刈りが効く
  options.sort((a, b) => b.state.players[player].score - a.state.players[player].score)
  let best = -Infinity
  for (const { state: s } of options) {
    let v: number
    if (s.phase === 'gameover') v = terminal(s, player, depth)
    else {
      const next = endTurnHidden(s)
      v = next.phase === 'gameover' ? terminal(next, player, depth) : -negamax(next, depth - 1, -beta, -alpha)
    }
    if (v > best) best = v
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

/** depth 手先（自分と相手の手番の合計）まで読んで、この手番の最善手を返す */
export function searchTurn(state: GameState, depth = 4, rng: () => number = Math.random): TurnPlan | null {
  const player = state.current
  const options = turnOptions(state, true)
  if (!options.length) return null
  let best: Option | null = null
  let bestV = -Infinity
  let alpha = -Infinity
  for (const o of options) {
    let v: number
    if (o.state.phase === 'gameover') v = terminal(o.state, player, depth)
    else {
      const next = endTurnHidden(o.state)
      v = next.phase === 'gameover' ? terminal(next, player, depth) : -negamax(next, depth - 1, -Infinity, -alpha)
    }
    v += rng() * 0.5 // 同評価の手はランダムに
    if (v > bestV) {
      bestV = v
      best = o
      alpha = Math.max(alpha, v)
    }
  }
  return best!.plan
}

/**
 * 調合フェーズで、次に調合するカードの位置（調合しないなら null）。
 * 1枚作るごとに呼び直して判断する。
 */
export function searchCraft(state: GameState, depth = 4): number | null {
  if (state.phase !== 'craft') return null
  const player = state.current
  const out = new Map<string, { crafts: number[]; state: GameState }>()
  craftOptions(state, [], out, true)
  let best: number | null = null
  let bestV = -Infinity
  for (const { crafts, state: s } of out.values()) {
    let v: number
    if (s.phase === 'gameover') v = terminal(s, player, depth)
    else {
      const next = endTurnHidden(s)
      v = next.phase === 'gameover' ? terminal(next, player, depth) : -negamax(next, depth - 1, -Infinity, Infinity)
    }
    if (v > bestV) {
      bestV = v
      best = crafts[0] ?? null
    }
  }
  return best
}

/**
 * 時間制限つきの読み：2手先から2手ずつ深くして、次の深さが budgetMs に収まりそうな間だけ続ける。
 * 返す depth は調合の判断（searchCraft）にも使う。
 */
export function searchTurnTimed(
  state: GameState,
  budgetMs = 400,
  maxDepth = 12,
  rng: () => number = Math.random,
): { plan: TurnPlan; depth: number } | null {
  const started = performance.now()
  let result: { plan: TurnPlan; depth: number } | null = null
  for (let depth = 2; depth <= maxDepth; depth += 2) {
    const t = performance.now()
    const plan = searchTurn(state, depth, rng)
    if (!plan) return null
    result = { plan, depth }
    const took = performance.now() - t
    // 2手深くすると時間はおよそ5倍になる
    if (performance.now() - started + took * 5 > budgetMs) break
  }
  return result
}
