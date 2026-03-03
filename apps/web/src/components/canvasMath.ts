export function clampScale(scale: number, min = 0.45, max = 2.8): number {
  return Math.min(max, Math.max(min, scale));
}

export function nextScaleFromWheel(currentScale: number, deltaY: number): number {
  const delta = deltaY > 0 ? -0.1 : 0.1;
  return Number(clampScale(currentScale + delta).toFixed(2));
}
