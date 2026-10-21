/**
 * 戦略別CPU同士の総当たりシミュレーション。
 *
 *   npm run sim -- [--games 1000] [--mix 10/8/6,12/8/4] [--strategies greedy,cheap,aim2,aimNear,aimAlways]
 *                  [--bonus 1] [--out docs/balance-report.md]
 *
 * --games      先手×後手の組み合わせごとの対局数（全組み合わせで同じシード列を使う）
 * --mix        山札の 1点/2点/3点 枚数（カンマ区切りで複数。省略時はゲーム本体の構成）
 * --strategies 対戦させる戦略（src/game/ai.ts の STRATEGIES）
 * --bonus      後手が最初に持つランダム素材の数（省略時はゲーム本体の値）
 * --out        Markdown レポートの出力先（省略時は標準出力のみ）
 */
import { writeFileSync } from 'node:fs'
import { STRATEGIES, type Strategy, type StrategyId } from '../src/game/ai'
import { SECOND_PLAYER_BONUS } from '../src/game/types'
import { GAME_MIX, mixLabel, playPair, type DeckMix, type PairStats } from '../src/sim/simulate'

const args = new Map<string, string>()
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1])

const games = Number(args.get('games') ?? 1000)
const bonus = Number(args.get('bonus') ?? SECOND_PLAYER_BONUS)
const mixes = (args.get('mix') ?? mixLabel(GAME_MIX)).split(',').map((m) => m.split('/').map(Number) as DeckMix)
const strategies: Strategy[] = (args.get('strategies') ?? Object.keys(STRATEGIES).join(','))
  .split(',')
  .map((id) => {
    const s = STRATEGIES[id as StrategyId]
    if (!s) throw new Error(`未知の戦略: ${id}（${Object.keys(STRATEGIES).join(', ')}）`)
    return s
  })

const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : '-')
const table = (head: string[], rows: string[][]) =>
  [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n')

interface MixSummary {
  mix: DeckMix
  firstRate: number
  mirrorFirstRate: number
  best: string
  spread: number
  turns: number
  stalemate: number
}

const out: string[] = []
const summaries: MixSummary[] = []
const started = Date.now()

out.push('# 戦略別シミュレーション結果', '')
out.push(`- 対局数：先手×後手の組み合わせごとに ${games} 局（全組み合わせで同じ初期配置を使用）`)
out.push(`- 後手の初期素材：${bonus} 個`)
out.push(`- 生成日時：${new Date().toLocaleString('ja-JP')}`, '')
out.push('## 戦略', '', table(['ID', '名前', '内容'], strategies.map((s) => [s.id, s.label, s.description])), '')

for (const mix of mixes) {
  const pairs = new Map<string, PairStats>()
  for (const a of strategies) {
    for (const b of strategies) {
      process.stderr.write(`\r配分 ${mixLabel(mix)}：先手 ${a.id} × 後手 ${b.id}`.padEnd(60))
      pairs.set(`${a.id}>${b.id}`, playPair(mix, a, b, games, bonus))
    }
  }
  const all = [...pairs.values()]
  const get = (a: Strategy, b: Strategy) => pairs.get(`${a.id}>${b.id}`)!

  // 戦略別成績
  const perStrategy = strategies.map((s) => {
    const asFirst = strategies.map((o) => get(s, o))
    const asSecond = strategies.map((o) => get(o, s))
    const n = games * strategies.length
    const fw = asFirst.reduce((t, p) => t + p.firstWins, 0)
    const sw = asSecond.reduce((t, p) => t + p.secondWins, 0)
    const dr = asFirst.reduce((t, p) => t + p.draws, 0) + asSecond.reduce((t, p) => t + p.draws, 0)
    const tiers = [1, 2, 3].map((t) => asFirst.reduce((x, p) => x + p.crafted[0][t], 0) + asSecond.reduce((x, p) => x + p.crafted[1][t], 0))
    const tierSum = tiers.reduce((a, b) => a + b, 0)
    return { s, firstRate: fw / n, secondRate: sw / n, overall: (fw + sw + dr / 2) / (2 * n), tiers: tiers.map((t) => pct(t, tierSum)).join(' / ') }
  })

  const totalGames = all.reduce((t, p) => t + p.games, 0)
  const mirror = strategies.map((s) => get(s, s))
  const sorted = [...perStrategy].sort((a, b) => b.overall - a.overall)
  summaries.push({
    mix,
    firstRate: all.reduce((t, p) => t + p.firstWins, 0) / totalGames,
    mirrorFirstRate: mirror.reduce((t, p) => t + p.firstWins, 0) / mirror.reduce((t, p) => t + p.games, 0),
    best: sorted[0].s.label,
    spread: sorted[0].overall - sorted[sorted.length - 1].overall,
    turns: all.reduce((t, p) => t + p.turns, 0) / totalGames,
    stalemate: all.reduce((t, p) => t + p.stalemates, 0) / totalGames,
  })

  out.push(`## 配分 ${mixLabel(mix)}（1点/2点/3点）`, '')
  out.push('### 戦略別成績', '')
  out.push(
    table(
      ['戦略', '先手時の勝率', '後手時の勝率', '総合勝率（引分=0.5）', '調合の内訳 1/2/3点'],
      perStrategy.map((r) => [r.s.label, pct(r.firstRate, 1), pct(r.secondRate, 1), pct(r.overall, 1), r.tiers]),
    ),
    '',
  )
  out.push('### 直接対決（先手・後手を入れ替えた合計での、行の戦略の勝率）', '')
  out.push(
    table(
      ['', ...strategies.map((s) => s.label)],
      strategies.map((a) => [
        `**${a.label}**`,
        ...strategies.map((b) => {
          if (a === b) return '-'
          const ab = get(a, b)
          const ba = get(b, a)
          return pct(ab.firstWins + ba.secondWins + (ab.draws + ba.draws) / 2, ab.games + ba.games)
        }),
      ]),
    ),
    '',
  )
  out.push('### 先手勝率（行＝先手、列＝後手）', '')
  out.push(
    table(
      ['先手＼後手', ...strategies.map((s) => s.label)],
      strategies.map((a) => [`**${a.label}**`, ...strategies.map((b) => pct(get(a, b).firstWins, games))]),
    ),
    '',
  )
}

out.push('## 配分の比較', '')
out.push(
  table(
    ['配分', '先手勝率（全対戦）', '先手勝率（同じ戦略同士）', '最も強い戦略', '総合勝率の最大差', '平均ターン', '手詰まり終了'],
    summaries.map((m) => [
      mixLabel(m.mix),
      pct(m.firstRate, 1),
      pct(m.mirrorFirstRate, 1),
      m.best,
      `${(m.spread * 100).toFixed(1)}pt`,
      m.turns.toFixed(1),
      pct(m.stalemate, 1),
    ]),
  ),
  '',
  '- 先手勝率：50% に近いほど先手・後手が公平',
  '- 総合勝率の最大差：小さいほど「これだけやれば勝てる」戦略がなく、戦略の選択に意味がある',
  '',
)

process.stderr.write(`\r完了（${((Date.now() - started) / 1000).toFixed(1)}秒）                                \n`)
const report = out.join('\n')
const outPath = args.get('out')
if (outPath) {
  writeFileSync(outPath, report)
  process.stderr.write(`レポートを ${outPath} に出力しました\n`)
} else {
  console.log(report)
}
