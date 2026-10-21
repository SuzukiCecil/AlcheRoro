// CPUの強さ同士を対戦させる： npx tsx scripts/cpu-levels.ts <強さA> <強さB> [先手後手を入れ替えた組の数]
import { craft, createGame, endTurn, pickTile } from '../src/game/engine'
import { cpuCraft, cpuMove, type Level } from '../src/game/cpu'
import { seeded } from '../src/sim/simulate'
function play(a: Level, b: Level, seed: number) {
  const rng = seeded(seed); let g = createGame(rng)
  for (let k = 0; g.phase !== 'gameover' && k < 100; k++) {
    const lv = g.current === 'p1' ? a : b
    g = pickTile(g, cpuMove(g, lv, rng)!)
    for (let i = cpuCraft(g, lv); i !== null; i = cpuCraft(g, lv)) g = craft(g, i)
    if (g.phase !== 'gameover') g = endTurn(g)
  }
  return g.winner
}
const [a, b, n] = [process.argv[2] as Level, process.argv[3] as Level, Number(process.argv[4] ?? 200)]
let fw = 0, sw = 0
for (let s = 1; s <= n; s++) {
  const r1 = play(a, b, s * 31), r2 = play(b, a, s * 31)
  fw += r1 === 'p1' ? 1 : r1 === 'draw' ? .5 : 0; sw += r2 === 'cpu' ? 1 : r2 === 'draw' ? .5 : 0
}
console.log(`| ${a} | ${b} | ${((fw + sw) / n / 2 * 100).toFixed(1)}% | ${(fw / n * 100).toFixed(0)}% | ${(sw / n * 100).toFixed(0)}% | ${n * 2} |`)
