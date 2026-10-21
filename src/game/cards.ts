import type { Color, RecipeCard } from './types'

/** [id（画像ファイル名）, カード名, コスト] */
type Recipe = [id: string, name: string, cost: Partial<Record<Color, number>>]

/** コスト2（1点）× 10 */
const TIER1: Recipe[] = [
  ['spark-powder', '火花の粉', { red: 1, yellow: 1 }],
  ['healing-drop', '癒しの雫', { blue: 1, green: 1 }],
  ['sleep-incense', '眠りの香', { purple: 1, blue: 1 }],
  ['sprout-oil', '若葉の油', { green: 1, yellow: 1 }],
  ['ruby-shard', '紅玉の欠片', { red: 2 }],
  ['moonshadow-salt', '月影の塩', { purple: 1, yellow: 1 }],
  ['mist-vial', '霧の小瓶', { blue: 2 }],
  ['antidote-herb', '毒消し草', { green: 1, purple: 1 }],
  ['burn-salve', '火傷の膏薬', { red: 1, green: 1 }],
  ['will-o-wisp', '鬼火の種', { red: 1, purple: 1 }],
]

/** コスト3（2点）× 8 */
const TIER2: Recipe[] = [
  ['flame-elixir', '炎の霊薬', { red: 2, yellow: 1 }],
  ['frost-potion', '氷結の秘薬', { blue: 2, purple: 1 }],
  ['forest-blessing', '森の祝福', { green: 2, blue: 1 }],
  ['thunder-crystal', '雷光の結晶', { yellow: 2, purple: 1 }],
  ['rainbow-drop', '虹の雫', { red: 1, blue: 1, green: 1 }],
  ['dawn-balm', '夜明けの香油', { yellow: 1, red: 1, purple: 1 }],
  ['abyss-ink', '深淵のインク', { purple: 2, green: 1 }],
  ['golden-sand', '黄金の砂', { yellow: 3 }],
]

/** コスト5（3点）× 6 */
const TIER3: Recipe[] = [
  ['philosophers-stone', '賢者の石', { red: 1, blue: 1, green: 1, yellow: 1, purple: 1 }],
  ['elixir', 'エリクサー', { blue: 2, green: 2, yellow: 1 }],
  ['phoenix-feather', '不死鳥の羽', { red: 3, blue: 1, yellow: 1 }],
  ['stardust-essence', '星屑の霊液', { blue: 1, yellow: 2, purple: 2 }],
  ['dragon-blood', '竜の血', { red: 2, yellow: 1, purple: 2 }],
  ['earth-heart', '大地の心臓', { red: 1, blue: 1, green: 3 }],
]

export function createDeck(): RecipeCard[] {
  const build = (tier: Recipe[], points: number) =>
    tier.map(([id, name, cost]) => ({ id, name, cost, points }))
  return [...build(TIER1, 1), ...build(TIER2, 2), ...build(TIER3, 3)]
}
