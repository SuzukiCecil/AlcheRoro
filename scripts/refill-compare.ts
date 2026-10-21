// 場の補充タイミングの比較： npx tsx scripts/refill-compare.ts <強さA> <強さB> [局数（先手後手入れ替えの組の数）]
// 旧ルール（調合するたびに補充）と新ルール（手番の終わりに補充）で、同じシードを対戦させる。
// つよいは時間制限なしの4手先読み（searchTurn / searchCraft）で代用する。
import { craft, createGame, endTurn, pickTile, RULES, type Rng } from '../src/game/engine'
import { cpuCraft, cpuMove, type Level } from '../src/game/cpu'
import { searchCraft, searchTurn } from '../src/game/search'
import { seeded } from '../src/sim/simulate'
import type { GameState } from '../src/game/types'

const move = (g: GameState, lv: Level, rng: Rng) => (lv === 'hard' ? searchTurn(g, 4, rng)!.move : cpuMove(g, lv, rng)!)
const pickCraft = (g: GameState, lv: Level) => (lv === 'hard' ? searchCraft(g, 4) : cpuCraft(g, lv))

function play(a: Level, b: Level, seed: number) {
  const rng = seeded(seed)
  let g = createGame(rng)
  let chains = 0
  let chainWin = false
  for (let k = 0; g.phase !== 'gameover' && k < 100; k++) {
    const lv = g.current === 'p1' ? a : b
    const opened = new Set(g.market.map((c) => c?.id))
    g = pickTile(g, move(g, lv, rng))
    let chained = false
    for (let i = pickCraft(g, lv); i !== null; i = pickCraft(g, lv)) {
      if (!opened.has(g.market[i]!.id)) chained = true
      g = craft(g, i)
    }
    if (chained) chains++
    if (g.phase === 'gameover' && chained) chainWin = true
    if (g.phase !== 'gameover') g = endTurn(g)
  }
  return { winner: g.winner, turns: g.turn, stalemate: g.overReason === 'stalemate', chains, chainWin }
}

const [a, b, n] = [process.argv[2] as Level, process.argv[3] as Level, Number(process.argv[4] ?? 200)]
const pct = (x: number, d: number) => `${((x / d) * 100).toFixed(1)}%`
console.log(`| 補充 | ${a}の勝率 | 先手の勝率 | 平均ターン | 手詰まり終了 | 補充されたカードを同じ手番で調合 | そのまま勝利 |`)
console.log('| --- | --- | --- | --- | --- | --- | --- |')
for (const refill of ['craft', 'turnEnd'] as const) {
  RULES.refill = refill
  let aw = 0, fw = 0, turns = 0, stale = 0, chains = 0, chainWins = 0
  for (let s = 1; s <= n; s++) {
    for (const [first, second, aFirst] of [[a, b, true], [b, a, false]] as const) {
      const r = play(first, second, s * 31)
      const firstScore = r.winner === 'p1' ? 1 : r.winner === 'draw' ? 0.5 : 0
      fw += firstScore
      aw += aFirst ? firstScore : 1 - firstScore
      turns += r.turns
      if (r.stalemate) stale++
      chains += r.chains
      if (r.chainWin) chainWins++
    }
  }
  const g = n * 2
  console.log(`| ${refill === 'craft' ? '調合のたび（旧）' : '手番の終わり（新）'} | ${pct(aw, g)} | ${pct(fw, g)} | ${(turns / g).toFixed(1)} | ${pct(stale, g)} | ${(chains / g).toFixed(2)}回/局 | ${pct(chainWins, g)} |`)
}
