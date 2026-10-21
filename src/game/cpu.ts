import { chooseCraft, chooseMove, STRATEGIES, type Strategy } from './ai'
import { legalMoves, type Rng } from './engine'
import { searchCraft, searchTurnTimed } from './search'
import type { GameState, Pos } from './types'

export type Level = 'easy' | 'normal' | 'hard'

interface LevelSpec {
  label: string
  description: string
  /** ルールベースの戦略（やさしい・ふつう） */
  strategy: Strategy
  /** この確率で、評価を無視してライン上のランダムなマスを取る */
  randomRate: number
  /** 先読み（つよい）：1手番に使う思考時間の目安 */
  searchMs?: number
}

/**
 * CPUの強さ。CPU同士の勝率（docs/balance-cpu.md）：
 * ふつう対やさしい 約78%、つよい対ふつう 約80%。
 */
export const LEVELS: Record<Level, LevelSpec> = {
  easy: { label: 'やさしい', description: 'ときどき気まぐれに素材を選ぶ', strategy: STRATEGIES.cheap, randomRate: 0.5 },
  normal: { label: 'ふつう', description: '2点カードを計画的に狙う', strategy: STRATEGIES.aim2, randomRate: 0 },
  hard: { label: 'つよい', description: '数手先まで読んで、相手の動きも予測する', strategy: STRATEGIES.aim2, randomRate: 0, searchMs: 400 },
}

/** 先読みした深さ。取得の判断と同じ深さで調合も判断する */
let lastDepth = 4

/** 強さに応じたCPUの取得マス */
export function cpuMove(state: GameState, level: Level, rng: Rng = Math.random): Pos | null {
  const { strategy, randomRate, searchMs } = LEVELS[level]
  if (searchMs) {
    const r = searchTurnTimed(state, searchMs, 12, rng)
    if (!r) return null
    lastDepth = r.depth
    return r.plan.move
  }
  if (randomRate && rng() < randomRate) {
    const moves = legalMoves(state)
    return moves[Math.floor(rng() * moves.length)] ?? null
  }
  return chooseMove(state, strategy, rng)
}

/** 強さに応じて、次に調合する場のカード（しないなら null） */
export function cpuCraft(state: GameState, level: Level): number | null {
  const { strategy, searchMs } = LEVELS[level]
  return searchMs ? searchCraft(state, lastDepth) : chooseCraft(state, strategy)
}
