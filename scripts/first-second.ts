// 同じ強さ同士で対戦させ、先手・後手の勝率を出す： npx tsx scripts/first-second.ts <強さ> <局数> [シード開始]
import { craft, createGame, endTurn, pickTile } from '../src/game/engine'
import { cpuCraft, cpuMove, type Level } from '../src/game/cpu'
import { seeded } from '../src/sim/simulate'
const [lv, n, from] = [process.argv[2] as Level, Number(process.argv[3] ?? 100), Number(process.argv[4] ?? 1)]
let first = 0, second = 0, draw = 0
for (let s = from; s < from + n; s++) {
  const rng = seeded(s * 31); let g = createGame(rng)
  for (let k = 0; g.phase !== 'gameover' && k < 100; k++) {
    g = pickTile(g, cpuMove(g, lv, rng)!)
    for (let i = cpuCraft(g, lv); i !== null; i = cpuCraft(g, lv)) g = craft(g, i)
    if (g.phase !== 'gameover') g = endTurn(g)
  }
  if (g.winner === 'p1') first++; else if (g.winner === 'cpu') second++; else draw++
}
console.log(JSON.stringify({ lv, n, first, second, draw }))
