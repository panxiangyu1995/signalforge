import type { Canvas, CanvasKit } from 'canvaskit-wasm'

import type { Vector } from '@signal-forge/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'

import type { PortPosition } from './ports'

const BEZIER_TENSION = 0.4

export function paintBezierArc(
  ck: CanvasKit,
  canvas: Canvas,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  sourcePort: PortPosition | undefined,
  targetPort: PortPosition | undefined,
  bendPoints: Vector[] | undefined,
  r: SkiaRenderer
): void {
  if (bendPoints && bendPoints.length > 0) {
    paintBezierWithBends(ck, canvas, sx, sy, tx, ty, bendPoints, r)
    return
  }

  const cp1 = computeControlPoint(sx, sy, sourcePort, tx, ty, BEZIER_TENSION)
  const cp2 = computeControlPoint(tx, ty, targetPort, sx, sy, BEZIER_TENSION)

  const path = new ck.Path()
  try {
    path.moveTo(sx, sy)
    path.cubicTo(cp1.x, cp1.y, cp2.x, cp2.y, tx, ty)
    canvas.drawPath(path, r.strokePaint)
  } finally {
    path.delete()
  }
}

function computeControlPoint(
  fromX: number,
  fromY: number,
  fromPort: PortPosition | undefined,
  toX: number,
  toY: number,
  tension: number
): Vector {
  const dx = toX - fromX
  const dy = toY - fromY
  const dist = Math.hypot(dx, dy)

  if (dist === 0) return { x: fromX, y: fromY }

  let dirX: number
  let dirY: number

  if (fromPort) {
    const side = fromPort.side
    if (side === 'top') { dirX = 0; dirY = -1 }
    else if (side === 'bottom') { dirX = 0; dirY = 1 }
    else if (side === 'left') { dirX = -1; dirY = 0 }
    else if (side === 'right') { dirX = 1; dirY = 0 }
    else if (side === 'top-left') { dirX = -0.707; dirY = -0.707 }
    else if (side === 'top-right') { dirX = 0.707; dirY = -0.707 }
    else if (side === 'bottom-left') { dirX = -0.707; dirY = 0.707 }
    else { dirX = 0.707; dirY = 0.707 }
  } else {
    dirX = dx / dist
    dirY = dy / dist
  }

  const offset = dist * tension
  return { x: fromX + dirX * offset, y: fromY + dirY * offset }
}

function paintBezierWithBends(
  ck: CanvasKit,
  canvas: Canvas,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  bendPoints: Vector[],
  r: SkiaRenderer
): void {
  const points = [
    { x: sx, y: sy },
    ...bendPoints,
    { x: tx, y: ty }
  ]

  const path = new ck.Path()
  try {
    path.moveTo(points[0].x, points[0].y)

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[Math.min(points.length - 1, i + 2)]

      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6

      path.cubicTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
    }

    canvas.drawPath(path, r.strokePaint)
  } finally {
    path.delete()
  }
}
