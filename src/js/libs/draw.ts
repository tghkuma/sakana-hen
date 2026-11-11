/**
 * 和風パーツの描画ヘルパー
 */

/** 木の色 */
export type WoodColor = {
  /** 上側の色 */
  top: string
  /** 下側の色 */
  bottom: string
  /** 枠線の色 */
  border: string
  /** 木目の色 */
  grain: string
}

/** 白木 (品書き・木札) */
export const WOOD_LIGHT: WoodColor = { top: '#fbf1dc', bottom: '#efdcb4', border: '#6b4423', grain: '#c9a46a' }
/** 白木 (選択中) */
export const WOOD_SELECTED: WoodColor = { top: '#fff1e2', bottom: '#f9d9bd', border: '#c8381e', grain: '#d9a07a' }
/** 白木 (マウスオーバー) */
export const WOOD_HOVER: WoodColor = { top: '#fffaf0', bottom: '#f5e6c6', border: '#9a5a2a', grain: '#c9a46a' }
/** 黒板 (ステータス表示) */
export const WOOD_DARK: WoodColor = { top: '#4a3220', bottom: '#33210f', border: '#1f1308', grain: '#5c4029' }

/**
 * 角丸矩形のパスを作成
 */
export const roundRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

/**
 * 木の板を描画 (影・木目・枠線付き)
 *
 * @param ctx コンテキスト
 * @param x X座標
 * @param y Y座標
 * @param w 幅
 * @param h 高さ
 * @param color 木の色
 * @param options.radius 角丸半径
 * @param options.shadow 影の大きさ (0で影なし)
 * @param options.borderWidth 枠線の太さ
 * @param options.vertical 木目を縦にする (縦長の木札用)
 */
export const drawWoodBoard = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: WoodColor,
  options: { radius?: number; shadow?: number; borderWidth?: number; vertical?: boolean } = {},
) => {
  const { radius = 5, shadow = 4, borderWidth = 2.5, vertical = false } = options
  ctx.save()

  // 影付きで板を塗る
  if (0 < shadow) {
    ctx.shadowColor = 'rgba(70, 35, 5, 0.4)'
    ctx.shadowBlur = shadow * 1.5
    ctx.shadowOffsetY = shadow
  }
  const grad = ctx.createLinearGradient(x, y, x, y + h)
  grad.addColorStop(0, color.top)
  grad.addColorStop(1, color.bottom)
  roundRectPath(ctx, x, y, w, h, radius)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.shadowColor = 'transparent'

  // 木目 (位置は板のサイズから決まるので毎フレーム同じ模様になる)
  ctx.clip()
  ctx.strokeStyle = color.grain
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.45
  const lines = 5
  for (let i = 1; i <= lines; i++) {
    const t = i / (lines + 1)
    const wave = (i % 2 === 0 ? 1 : -1) * 2
    ctx.beginPath()
    if (vertical) {
      const gx = x + w * t
      ctx.moveTo(gx, y)
      ctx.bezierCurveTo(gx + wave, y + h * 0.3, gx - wave, y + h * 0.7, gx, y + h)
    } else {
      const gy = y + h * t
      ctx.moveTo(x, gy)
      ctx.bezierCurveTo(x + w * 0.3, gy + wave, x + w * 0.7, gy - wave, x + w, gy)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // 枠線
  roundRectPath(ctx, x, y, w, h, radius)
  ctx.lineWidth = borderWidth * 2 // clip されているので内側半分だけ見える
  ctx.strokeStyle = color.border
  ctx.stroke()

  ctx.restore()
}

/**
 * 縦書きテキストを描画 (1文字ずつ中央揃えで縦に並べる)
 *
 * @param ctx コンテキスト
 * @param text テキスト
 * @param cx 中心X座標
 * @param y 1文字目の上端Y座標
 * @param size フォントサイズ
 * @param lineHeight 行送り (フォントサイズに対する倍率)
 * @returns 描画した高さ
 */
export const drawVerticalText = (ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, size: number, lineHeight = 1.05) => {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const chars = [...text]
  chars.forEach((char, idx) => {
    ctx.fillText(char, cx, y + idx * size * lineHeight)
  })
  ctx.restore()
  return chars.length * size * lineHeight
}

/**
 * 指定幅に収まるフォントサイズを求める
 *
 * @param ctx コンテキスト
 * @param text テキスト
 * @param maxWidth 最大幅
 * @param size 基本フォントサイズ
 * @param family フォント
 * @param weight フォントの太さ
 */
export const fitFontSize = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, family: string, weight = '') => {
  ctx.font = `${weight} ${size}px ${family}`
  const width = ctx.measureText(text).width
  return width <= maxWidth ? size : Math.floor((size * maxWidth) / width)
}

/** 皿の縁取りの色 (のれんと同じ藍) */
export const PLATE_RIM = '#22386b'

/**
 * 回転寿司の皿を描画 (白磁に藍の二重線)
 *
 * @param ctx コンテキスト
 * @param cx 中心X座標
 * @param bottom 皿の底 (高台の下端) のY座標
 * @param rx 皿の横半径
 * @param shadow 落ち影を描くか (積み重ねた皿の2枚目以降は不要)
 * @returns 皿の上面の中心Y座標 (皿に物を載せる位置)
 */
export const drawSushiPlate = (ctx: CanvasRenderingContext2D, cx: number, bottom: number, rx = 46, shadow = true): number => {
  const ry = rx * 0.2
  const cy = bottom - ry - 3
  ctx.save()
  // 落ち影
  if (shadow) {
    ctx.fillStyle = 'rgba(40, 20, 0, 0.18)'
    ctx.beginPath()
    ctx.ellipse(cx + 2, bottom - 1, rx * 0.8, ry * 0.45, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // 高台
  ctx.fillStyle = '#d6dad8'
  ctx.strokeStyle = '#8f9ba3'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(cx, bottom - ry * 0.4, rx * 0.55, ry * 0.4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // 皿の側面 (厚み)
  ctx.fillStyle = '#e6eaea'
  ctx.beginPath()
  ctx.ellipse(cx, cy + 2.5, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // 皿の上面
  const grad = ctx.createLinearGradient(0, cy - ry, 0, cy + ry)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(1, '#eef1f1')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // 藍の二重線
  ctx.strokeStyle = PLATE_RIM
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx - 4, ry - 1.6, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx - 8.5, ry - 3, 0, 0, Math.PI * 2)
  ctx.stroke()
  // 見込み (中央のくぼみ)
  ctx.strokeStyle = 'rgba(120, 135, 145, 0.45)'
  ctx.beginPath()
  ctx.ellipse(cx, cy + 0.5, rx * 0.5, ry * 0.42, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
  return cy
}
