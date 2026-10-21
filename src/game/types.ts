export const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'] as const
export type Color = (typeof COLORS)[number]

export const BOARD_SIZE = 6
export const TILES_PER_COLOR = 7
export const DECK_SIZE = 24
export const MARKET_SIZE = 3
export const WIN_SCORE = 6
export const CONVERSION_RATE = 3
/** 先手有利の補正：後手が最初に持つランダム素材の数 */
export const SECOND_PLAYER_BONUS = 1

export type Direction = 'VERTICAL' | 'HORIZONTAL'
export type PlayerId = 'p1' | 'cpu'

export interface Pos {
  row: number
  col: number
}

/** null = 取得済み（または初期位置の予備マス） */
export type Cell = Color | null
export type Board = Cell[][]

export type Inventory = Record<Color, number>

export interface RecipeCard {
  id: string
  name: string
  cost: Partial<Record<Color, number>>
  points: number
}

export interface PlayerState {
  score: number
  inventory: Inventory
  crafted: RecipeCard[]
}

export type Phase = 'pick' | 'craft' | 'gameover'

export type GameOverReason = 'score' | 'stalemate'

export interface LogEntry {
  turn: number
  player: PlayerId
  text: string
}

export interface GameState {
  board: Board
  arrow: Pos & { dir: Direction }
  deck: RecipeCard[]
  market: (RecipeCard | null)[]
  players: Record<PlayerId, PlayerState>
  /** 先手のプレイヤー */
  first: PlayerId
  current: PlayerId
  phase: Phase
  turn: number
  winner: PlayerId | 'draw' | null
  overReason: GameOverReason | null
  log: LogEntry[]
}

/** 支払い内訳：通常支払い + 3:1変換 */
export interface Payment {
  direct: Partial<Record<Color, number>>
  conversions: { from: Color; to: Color }[]
}

export const emptyInventory = (): Inventory => ({ red: 0, blue: 0, green: 0, yellow: 0, purple: 0 })

/** 素材のモチーフ（内部IDは色名のまま） */
export const MATERIAL: Record<Color, { name: string; short: string }> = {
  red: { name: '火トカゲの鱗', short: '鱗' },
  blue: { name: '人魚の涙', short: '涙' },
  green: { name: 'マンドラゴラ', short: 'マンドラ' },
  yellow: { name: '硫黄', short: '硫黄' },
  purple: { name: '夜光キノコ', short: 'キノコ' },
}
