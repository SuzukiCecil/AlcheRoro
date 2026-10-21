import { createDeck } from '../game/cards'
import { RecipeCardFace, TIER_STYLE } from './RecipeCardFace'

/** 全カードの確認用ページ（/?gallery）。イラスト差し替え時のチェックに使う */
export function CardGallery() {
  const deck = createDeck()
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-xl font-black">調合カード一覧（{deck.length}枚）</h1>
      <p className="mt-1 text-xs text-[var(--muted)]">
        イラストは <code>public/cards/&lt;ID&gt;.jpg</code> に置くと反映されます。仕様は <code>docs/card-spec.md</code>。
      </p>
      {([1, 2, 3] as const).map((pts) => (
        <section key={pts} className="mt-6">
          <h2 className="mb-2 text-sm font-bold">
            {pts}点（{TIER_STYLE[pts].label}枠）
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {deck
              .filter((c) => c.points === pts)
              .map((card) => (
                <figure key={card.id}>
                  <RecipeCardFace card={card} />
                  <figcaption className="mt-1 truncate text-center font-mono text-[10px] text-[var(--muted)]">{card.id}</figcaption>
                </figure>
              ))}
          </div>
        </section>
      ))}
      <h2 className="mb-2 mt-8 text-sm font-bold">サイズ違いでも配置比率は同じ</h2>
      <div className="flex items-end gap-3">
        {[96, 140, 220].map((w) => (
          <div key={w} style={{ width: w }}>
            <RecipeCardFace card={deck[deck.length - 1]} />
            <div className="mt-1 text-center text-[10px] text-[var(--muted)]">{w}px</div>
          </div>
        ))}
      </div>
    </div>
  )
}
