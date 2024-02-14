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
