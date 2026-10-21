import { describe, expect, it } from 'vitest'
import { chooseCraft, chooseMove } from './ai'
import { createDeck } from './cards'
import { canCraft, computePayment, convert, createGame, craft, endTurn, legalMoves, pickTile } from './engine'
import { searchCraft, searchTurn } from './search'
import { emptyInventory, type GameState } from './types'

const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

describe('変換', () => {
  it('自動変換オフでは、変換が必要な支払いはできない', () => {
    const inv = { ...emptyInventory(), red: 1, green: 3 }
    expect(computePayment(inv, { red: 1, blue: 1 }, false)).toBeNull()
    expect(computePayment({ ...inv, blue: 1 }, { red: 1, blue: 1 }, false)).toEqual({ direct: { red: 1, blue: 1 }, conversions: [] })
  })
  it('手動変換で同じ素材3個を好きな素材1個にできる', () => {
    const g = createGame(seeded(3), { secondBonus: 0 })
    const s = { ...g, players: { ...g.players, p1: { ...g.players.p1, inventory: { ...emptyInventory(), green: 4 } } } }
    const n = convert(s, 'green', 'blue')
    expect(n.players.p1.inventory).toEqual({ ...emptyInventory(), green: 1, blue: 1 })
    expect(convert(n, 'green', 'red')).toBe(n) // 3個未満は変換できない
    expect(convert(s, 'green', 'green')).toBe(s)
  })
})

describe('computePayment', () => {
  it('鱗1・マンドラ3 で 鱗1・涙1 を払える（マンドラ3→涙1）', () => {
    const inv = { ...emptyInventory(), red: 1, green: 3 }
    expect(computePayment(inv, { red: 1, blue: 1 })).toEqual({
      direct: { red: 1 },
      conversions: [{ from: 'green', to: 'blue' }],
    })
  })
  it('要求に使う素材は変換に回さない', () => {
    expect(computePayment({ ...emptyInventory(), red: 3 }, { red: 1, blue: 1 })).toBeNull()
    expect(computePayment({ ...emptyInventory(), red: 4 }, { red: 1, blue: 1 })).not.toBeNull()
  })
})

describe('game flow', () => {
  it('初期盤面は35枚・場3枚・山札21枚', () => {
    const g = createGame(seeded(1))
    expect(g.board.flat().filter(Boolean)).toHaveLength(35)
    expect(g.market).toHaveLength(3)
    expect(g.deck).toHaveLength(21)
  })
  it('山札は 1点10枚・2点8枚・3点6枚、コストは 2/3/5 個', () => {
    const deck = createDeck()
    const size = (c: (typeof deck)[number]) => Object.values(c.cost).reduce((a, b) => a + (b ?? 0), 0)
    for (const [points, count, cost] of [[1, 10, 2], [2, 8, 3], [3, 6, 5]]) {
      const tier = deck.filter((c) => c.points === points)
      expect(tier).toHaveLength(count)
      expect(tier.every((c) => size(c) === cost)).toBe(true)
    }
  })
  it('CPUが先手なら、あなたがボーナスを持ち、ターンはCPUの手番から数える', () => {
    const rng = seeded(4)
    let g = createGame(rng, { first: 'cpu' })
    const total = (inv: Record<string, number>) => Object.values(inv).reduce((a, b) => a + b, 0)
    expect(g.current).toBe('cpu')
    expect(total(g.players.p1.inventory)).toBe(1)
    expect(total(g.players.cpu.inventory)).toBe(0)
    g = endTurn(pickTile(g, legalMoves(g)[0]))
    expect([g.current, g.turn]).toEqual(['p1', 1])
    g = endTurn(pickTile(g, legalMoves(g)[0]))
    expect([g.current, g.turn]).toEqual(['cpu', 2])
  })
  it('後手（CPU）は素材1個を持って始める', () => {
    const g = createGame(seeded(3))
    const total = (inv: Record<string, number>) => Object.values(inv).reduce((a, b) => a + b, 0)
    expect(total(g.players.cpu.inventory)).toBe(1)
    expect(total(g.players.p1.inventory)).toBe(0)
  })
  it('タイル取得で矢印が移動・回転する', () => {
    const g = createGame(seeded(2))
    const m = legalMoves(g)[0]
    const n = pickTile(g, m)
    expect(n.arrow).toEqual({ ...m, dir: g.arrow.dir === 'VERTICAL' ? 'HORIZONTAL' : 'VERTICAL' })
    expect(n.board[m.row][m.col]).toBeNull()
  })
  it('CPU同士で最後まで遊べる', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = seeded(seed)
      let g = createGame(rng)
      let guard = 0
      while (g.phase !== 'gameover' && guard++ < 200) {
        const m = chooseMove(g, undefined, rng)!
        g = pickTile(g, m)
        let i
        while (g.phase === 'craft' && (i = chooseCraft(g)) !== null) g = craft(g, i)
        g = endTurn(g)
      }
      expect(g.phase).toBe('gameover')
      expect(g.winner).not.toBeNull()
    }
  })

  it('CPUは、相手の次の手番での勝ちが確定する手を、他に手がある限り選ばない', () => {
    const greedy = (s: GameState) => {
      for (let i = chooseCraft(s); i !== null; i = chooseCraft(s)) s = craft(s, i)
      return s
    }
    // 調合の順番をすべて試して勝利点に届くか
    const canWin = (s: GameState): boolean =>
      s.phase === 'gameover' || s.market.some((_, i) => !!canCraft(s, i) && canWin(craft(s, i)))
    const states = (s: GameState): GameState[] => [s, ...s.market.flatMap((_, i) => (canCraft(s, i) ? states(craft(s, i)) : []))]
    // 自分の手番を終えた結果：'lose'（自分のせいで手詰まり負け）／'foe-wins'／'ok'
    // 手番の終わりに補充されるカードは手番中には分からないので、補充なし（山札を伏せた）で判定する
    const outcome = (after: GameState) => {
      if (after.phase === 'gameover') return 'ok'
      const e = endTurn({ ...after, deck: [] })
      if (e.phase === 'gameover') return e.winner === after.current ? 'ok' : 'lose'
      const foe = e.current
      const foeWins = legalMoves(e).some((m) => {
        const p = pickTile(e, m)
        if (canWin(p)) return true
        return legalMoves(p).length === 0 && states(p).some((s) => s.players[foe].score > s.players[after.current].score)
      })
      return foeWins ? 'foe-wins' : 'ok'
    }
    for (let seed = 1; seed <= 60; seed++) {
      const rng = seeded(seed)
      let g = createGame(rng)
      for (let guard = 0; g.phase !== 'gameover' && guard < 100; guard++) {
        const m = chooseMove(g, undefined, rng)!
        const chosen = outcome(greedy(pickTile(g, m)))
        if (chosen === 'foe-wins') {
          expect(legalMoves(g).map((x) => outcome(greedy(pickTile(g, x))))).not.toContain('ok')
        }
        g = greedy(pickTile(g, m))
        if (g.phase !== 'gameover') g = endTurn(g)
      }
    }
  })

  it('先読みCPU（つよい）は、その手番で勝てるときは必ず勝ち、最後まで遊べる', () => {
    const greedy = (s: GameState) => {
      for (let i = chooseCraft(s); i !== null; i = chooseCraft(s)) s = craft(s, i)
      return s
    }
    for (let seed = 1; seed <= 12; seed++) {
      const rng = seeded(seed)
      let g = createGame(rng)
      for (let guard = 0; g.phase !== 'gameover' && guard < 100; guard++) {
        if (g.current === 'cpu') {
          // 山札の中身は見えないので、今の場のカードだけで勝てる場合に限る
          const open = { ...g, deck: [] }
          const canWinNow = legalMoves(open).some((m) => greedy(pickTile(open, m)).phase === 'gameover')
          g = pickTile(g, searchTurn(g, 4, rng)!.move)
          for (let i = searchCraft(g, 4); i !== null; i = searchCraft(g, 4)) g = craft(g, i)
          if (canWinNow) expect(g.winner).toBe('cpu')
        } else {
          g = greedy(pickTile(g, chooseMove(g, undefined, rng)!))
        }
        if (g.phase !== 'gameover') g = endTurn(g)
      }
      expect(g.phase).toBe('gameover')
    }
  })
})

describe('場の補充', () => {
  it('調合で空いた場所は手番の間は空きのままで、手番の終わりに山札から補充する', () => {
    const rng = seeded(3)
    let g = createGame(rng)
    for (let guard = 0; guard < 100 && g.phase !== 'gameover'; guard++) {
      g = pickTile(g, chooseMove(g, undefined, rng)!)
      const i = chooseCraft(g)
      if (i === null) {
        g = endTurn(g)
        continue
      }
      const deck = g.deck.length
      const crafted = craft(g, i)
      if (crafted.phase === 'gameover') break
      expect(crafted.market[i]).toBeNull()
      expect(crafted.deck).toHaveLength(deck)
      const ended = endTurn(crafted)
      expect(ended.market[i]).toEqual(g.deck[0])
      expect(ended.deck).toHaveLength(deck - 1)
      return
    }
    throw new Error('調合が起きなかった')
  })
})
