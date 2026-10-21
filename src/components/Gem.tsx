import type { Color } from '../game/types'

export const GEM_STYLE: Record<Color, { bg: string; ring: string; text: string; hex: string }> = {
  red: { bg: 'bg-rose-500', ring: 'ring-rose-300', text: 'text-rose-500', hex: '#f43f5e' },
  blue: { bg: 'bg-sky-500', ring: 'ring-sky-300', text: 'text-sky-500', hex: '#0ea5e9' },
  green: { bg: 'bg-emerald-500', ring: 'ring-emerald-300', text: 'text-emerald-500', hex: '#10b981' },
  yellow: { bg: 'bg-amber-400', ring: 'ring-amber-200', text: 'text-amber-500', hex: '#fbbf24' },
  purple: { bg: 'bg-violet-500', ring: 'ring-violet-300', text: 'text-violet-500', hex: '#8b5cf6' },
}

/** 素材アイコン（素材ごとに形を変えて色覚に依存しない。細部は evenodd の切り抜きで表現） */
export function Gem({ color, size = 18 }: { color: Color; size?: number }) {
  const fill = GEM_STYLE[color].hex
  const shapes: Record<Color, string> = {
    // 火トカゲの鱗：縁取りのある鱗片
    red: 'M12 2c4.5 0 8 2.2 8 5.5 0 5.5-3.6 10.6-8 14.5C7.6 18.1 4 13 4 7.5 4 4.2 7.5 2 12 2zM12 6.5c-2.8 0-5 1.2-5.4 3 .9 3.4 2.9 6.4 5.4 8.9 2.5-2.5 4.5-5.5 5.4-8.9-.4-1.8-2.6-3-5.4-3z',
    // 人魚の涙：しずくと光の反射
    blue: 'M12 2c4 5 7 8.5 7 12a7 7 0 0 1-14 0c0-3.5 3-7 7-12zM9.2 12.5c-.8 1.2-1.1 2.3-.8 3.6.2.7 1.2.6 1.2-.1 0-1 .2-1.9.8-2.8.4-.6-.7-1.3-1.2-.7z',
    // マンドラゴラ：2枚の葉と根
    green: 'M11 9C9 4.5 5.5 3.5 4.5 5.5 5.5 8 8.5 9 11 9zM13 9c2-4.5 5.5-5.5 6.5-3.5-1 2.5-4 3.5-6.5 3.5zM7.5 10h9c0 4.5-1.8 8.5-4.5 12-2.7-3.5-4.5-7.5-4.5-12z',
    // 硫黄：六角柱の結晶
    yellow: 'M12 2 19 6v12l-7 4-7-4V6zM12 5.5 8 7.8v8.4l4 2.3z',
    // 夜光キノコ：斑点のある傘と柄
    purple: 'M2.5 13C3 7.5 7 4 12 4s9 3.5 9.5 9zM8 8.2a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zM14.5 7a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM9 14.5h6v4.5a3 3 0 0 1-6 0z',
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} fillRule="evenodd" stroke="rgba(0,0,0,.25)" strokeWidth={1}>
      <path d={shapes[color]} />
    </svg>
  )
}
