/** 屏幕像素 → NDC（-1..1，y 朝上），鼠标当手的坐标换算与单测都走这里 */
export function ndcFromClient(clientX: number, clientY: number, width: number, height: number): { nx: number; ny: number } {
  const w = width > 0 ? width : 1;
  const h = height > 0 ? height : 1;
  return {
    nx: Math.min(1, Math.max(-1, (clientX / w) * 2 - 1)),
    ny: Math.min(1, Math.max(-1, -(clientY / h) * 2 + 1))
  };
}

/** 滚轮增量 → 力场强度的步进，避免一次滚到底 */
export function stepPower(power: number, deltaY: number, step = 0.06): number {
  const dir = deltaY > 0 ? -1 : 1;
  return Math.min(2, Math.max(0, Number((power + dir * step).toFixed(2))));
}
