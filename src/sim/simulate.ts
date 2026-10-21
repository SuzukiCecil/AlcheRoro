import { chooseCraft, chooseMove, type Strategy } from '../game/ai'
import { createDeck } from '../game/cards'
import { craft, createGame, endTurn, pickTile, shuffle, type Rng } from '../game/engine'
import { SECOND_PLAYER_BONUS, type GameState, type RecipeCard } from '../game/types'

/** 1点/2点/3点カードの枚数 */
export type DeckMix = [number, number, number]

export const mixLabel = (m: DeckMix) => m.join('/')

/** ゲーム本体の山札構成 */
export const GAME_MIX = [1, 2, 3].map((p) => createDeck().filter((c) => c.points === p).length) as DeckMix

/** 指定枚数の山札を作る。各ランクのレシピが足りない分は同じレシピを繰り返す */
export function makeDeck([n1, n2, n3]: DeckMix): RecipeCard[] {
  const base = createDeck()
  return ([[1, n1], [2, n2], [3, n3]] as const).flatMap(([points, n]) => {
    const tier = base.filter((c) => c.points === points)
    return Array.from({ length: n }, (_, i) => ({ ...tier[i % tier.length], id: `${tier[i % tier.length].id}#${i}` }))
  })
}

/** 再現可能な乱数（mulberry32） */
export function seeded(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface GameResult {
  /** 先手・後手・引き分け */
  winner: 'first' | 'second' | 'draw'
  turns: number
  stalemate: boolean
  scores: [number, number]
  /** [先手, 後手] それぞれが調合したカードの点数別枚数（index 1〜3） */
  crafted: [number[], number[]]
}

export interface GameOptions {
  mix: DeckMix
  first: Strategy
  second: Strategy
  seed: number
  /** 後手が最初に持つランダム素材の数（省略時はゲーム本体の値） */
  secondBonus?: number
}

/** 1ゲームを最後まで自動で進める（先手 = p1, 後手 = cpu） */
export function playGame({ mix, first, second, seed, secondBonus = SECOND_PLAYER_BONUS }: GameOptions): GameResult {
  const rng = seeded(seed)
  let g: GameState = createGame(rng, { secondBonus })
  const deck = shuffle(makeDeck(mix), rng)
  g = { ...g, market: deck.slice(0, 3), deck: deck.slice(3) }
  const strategyOf = (s: GameState) => (s.current === 'p1' ? first : second)
  const crafted: [number[], number[]] = [[0, 0, 0, 0], [0, 0, 0, 0]]

  for (let guard = 0; g.phase !== 'gameover' && guard < 100; guard++) {
    const strategy = strategyOf(g)
    g = pickTile(g, chooseMove(g, strategy, rng)!)
    for (let i = chooseCraft(g, strategy); i !== null; i = chooseCraft(g, strategy)) {
      crafted[g.current === 'p1' ? 0 : 1][g.market[i]!.points]++
      g = craft(g, i)
    }
    if (g.phase !== 'gameover') g = endTurn(g)
  }
  return {
    winner: g.winner === 'p1' ? 'first' : g.winner === 'cpu' ? 'second' : 'draw',
    turns: g.turn,
    stalemate: g.overReason === 'stalemate',
    scores: [g.players.p1.score, g.players.cpu.score],
    crafted,
  }
}

export interface PairStats {
  first: string
  second: string
  games: number
  firstWins: number
  secondWins: number
  draws: number
  turns: number
  stalemates: number
  /** 先手・後手それぞれの調合内訳 */
  crafted: [number[], number[]]
}

/** 先手 A × 後手 B を games 局（同じシード列で）対戦させる */
export function playPair(mix: DeckMix, first: Strategy, second: Strategy, games: number, secondBonus = SECOND_PLAYER_BONUS, seedBase = 1): PairStats {
  const s: PairStats = {
    first: first.id,
    second: second.id,
    games,
    firstWins: 0,
    secondWins: 0,
    draws: 0,
    turns: 0,
    stalemates: 0,
    crafted: [[0, 0, 0, 0], [0, 0, 0, 0]],
  }
  for (let k = 0; k < games; k++) {
    const r = playGame({ mix, first, second, seed: seedBase + k * 7919, secondBonus })
    if (r.winner === 'first') s.firstWins++
    else if (r.winner === 'second') s.secondWins++
    else s.draws++
    s.turns += r.turns
    if (r.stalemate) s.stalemates++
    for (const side of [0, 1] as const) for (let t = 1; t <= 3; t++) s.crafted[side][t] += r.crafted[side][t]
  }
  return s
}
