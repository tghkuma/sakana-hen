/**
 * @param t アニメーションの経過時間
 * @param b 始点
 * @param c 変化量
 * @param d 変化にかける時間
 */
export const easeInOutExpo = (t: number, b: number, c: number, d: number) => {
  if (t == 0) return b
  if (t == d) return b + c
  if ((t /= d / 2) < 1) return (c / 2) * Math.pow(2, 10 * (t - 1)) + b
  return (c / 2) * (-Math.pow(2, -10 * --t) + 2) + b
}

/**
 * @param t アニメーションの経過時間
 * @param b 始点
 * @param c 変化量
 * @param d 変化にかける時間
 */
export const easeOutExpo = (t: number, b: number, c: number, d: number) => {
  return t == d ? b + c : c * (-Math.pow(2, (-10 * t) / d) + 1) + b
}

/**
 * @param t アニメーションの経過時間
 * @param b 始点
 * @param c 変化量
 * @param d 変化にかける時間
 */
export const easeOutElastic = (t: number, b: number, c: number, d: number) => {
  let s = 1.70158
  let p = 0
  let a = c
  if (t == 0) return b
  if ((t /= d) == 1) return b + c
  if (!p) p = d * 0.3
  if (a < Math.abs(c)) {
    a = c
    s = p / 4
  } else {
    s = (p / (2 * Math.PI)) * Math.asin(c / a)
  }
  return a * Math.pow(2, -10 * t) * Math.sin(((t * d - s) * (2 * Math.PI)) / p) + c + b
}
