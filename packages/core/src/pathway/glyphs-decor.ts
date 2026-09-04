import type { Canvas, CanvasKit } from 'canvaskit-wasm'

import type { SkiaRenderer } from '#core/canvas/renderer'

import { hexToCKColor } from './utils'

const RECEPTOR_NAME_PATTERN =
  /\b(receptors?|frizzled|fzd\d*|lrp\d*|notch\d*|gpcr|egfr|erbb\d?|her[1-4]|fgfr\d*|pdgfr[ab]?|vegfr\d?|igf1r|insr|tgfbr\d?|bmpr\d?|tnfrsf?\d*|ngfr|il\d+r[ab]?|cxcr\d|ccr\d|tlr\d|ret|alk)\b/i

export function isReceptorName(name: string | undefined): boolean {
  if (!name) return false
  if (/nuclear|cytosol|cytoplasmic/i.test(name)) return false
  return RECEPTOR_NAME_PATTERN.test(name)
}

/**
 * DNA double helix decoration: two phase-shifted strands with base-pair
 * rungs behind them, drawn across the middle of wide nucleic acid glyphs.
 */
export function paintDoubleHelix(
  ck: CanvasKit,
  canvas: Canvas,
  w: number,
  h: number,
  r: SkiaRenderer
): void {
  if (w < 64 || h < 22) return
  const pad = 6
  const cy = h / 2
  const amp = Math.min(h * 0.28, 13)
  const half = Math.max(10, (w - pad * 2) / 8)

  // Base-pair rungs behind the strands, at the strands' extremes.
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setStrokeWidth(1.4)
  r.strokePaint.setColor(ck.Color4f(0.29, 0.48, 0.71, 0.55))
  for (let x = pad + half / 2; x <= w - pad; x += half) {
    canvas.drawLine(x, cy - amp, x, cy + amp, r.strokePaint)
  }

  const strandPaths: Array<{ path: InstanceType<CanvasKit['Path']>; color: ReturnType<typeof hexToCKColor> }> = []
  for (let s = 0; s < 2; s++) {
    const path = new ck.Path()
    path.moveTo(pad, cy)
    let x = pad
    let dir = s === 0 ? 1 : -1
    while (x + half <= w - pad + 0.01) {
      path.quadTo(x + half / 2, cy + dir * 2 * amp, x + half, cy)
      x += half
      dir = -dir
    }
    strandPaths.push({ path, color: hexToCKColor(ck, s === 0 ? '#3A6EA5' : '#7A4FA0') })
  }
  try {
    r.strokePaint.setStyle(ck.PaintStyle.Stroke)
    r.strokePaint.setStrokeWidth(2.2)
    for (const { path, color } of strandPaths) {
      r.strokePaint.setColor(color)
      canvas.drawPath(path, r.strokePaint)
    }
  } finally {
    for (const { path } of strandPaths) path.delete()
  }
}
