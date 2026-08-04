import type { Canvas, CanvasKit } from 'canvaskit-wasm'

import type { SceneNode } from '@signal-forge/scene-graph'
import type { PathwayNodeData } from '@signal-forge/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'

import { SBGN_STYLE, type PathwayStyle } from './constants'
import { hexToCKColor } from './utils'

export type AFLanguageArcType =
  | 'positive_influence'
  | 'negative_influence'
  | 'unknown_influence'

export function paintAFMacromolecule(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  _data: PathwayNodeData,
  _style: PathwayStyle,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height
  const cr = Math.min(w, h) * 0.12

  r.fillPaint.setColor(hexToCKColor(ck, SBGN_STYLE.nodeBackgroundColor))
  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  canvas.drawRRect(ck.RRectXY(ck.LTRBRect(0, 0, w, h), cr, cr), r.fillPaint)

  r.strokePaint.setColor(hexToCKColor(ck, SBGN_STYLE.nodeBorderColor))
  r.strokePaint.setStrokeWidth(SBGN_STYLE.defaultBorderWidth)
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  canvas.drawRRect(ck.RRectXY(ck.LTRBRect(0, 0, w, h), cr, cr), r.strokePaint)
}

export function paintAFSimpleChemical(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  _data: PathwayNodeData,
  _style: PathwayStyle,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height
  const cr = Math.min(w / 2, h / 2)

  r.fillPaint.setColor(hexToCKColor(ck, SBGN_STYLE.nodeBackgroundColor))
  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  canvas.drawRRect(ck.RRectXY(ck.LTRBRect(0, 0, w, h), cr, cr), r.fillPaint)

  r.strokePaint.setColor(hexToCKColor(ck, SBGN_STYLE.nodeBorderColor))
  r.strokePaint.setStrokeWidth(SBGN_STYLE.entityBorderWidth)
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  canvas.drawRRect(ck.RRectXY(ck.LTRBRect(0, 0, w, h), cr, cr), r.strokePaint)
}

export function paintAFPositiveInfluence(
  ck: CanvasKit,
  canvas: Canvas,
  tipX: number,
  tipY: number,
  dirX: number,
  dirY: number,
  size: number,
  r: SkiaRenderer
): void {
  const perpX = -dirY
  const perpY = dirX
  const baseX = tipX - dirX * size
  const baseY = tipY - dirY * size

  const path = new ck.Path()
  try {
    path.moveTo(tipX, tipY)
    path.lineTo(baseX + perpX * size * 0.5, baseY + perpY * size * 0.5)
    path.lineTo(baseX - perpX * size * 0.5, baseY - perpY * size * 0.5)
    path.close()

    r.fillPaint.setColor(hexToCKColor(ck, SBGN_STYLE.nodeBorderColor))
    r.fillPaint.setStyle(ck.PaintStyle.Fill)
    canvas.drawPath(path, r.fillPaint)
  } finally {
    path.delete()
  }
}

export function paintAFNegativeInfluence(
  ck: CanvasKit,
  canvas: Canvas,
  tipX: number,
  tipY: number,
  dirX: number,
  dirY: number,
  size: number,
  r: SkiaRenderer
): void {
  const perpX = -dirY
  const perpY = dirX
  const halfW = size * 0.5

  r.strokePaint.setColor(hexToCKColor(ck, SBGN_STYLE.nodeBorderColor))
  r.strokePaint.setStrokeWidth(2)
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  canvas.drawLine(
    tipX + perpX * halfW,
    tipY + perpY * halfW,
    tipX - perpX * halfW,
    tipY - perpY * halfW,
    r.strokePaint
  )
}

export function paintAFUnknownInfluence(
  ck: CanvasKit,
  canvas: Canvas,
  tipX: number,
  tipY: number,
  size: number,
  r: SkiaRenderer
): void {
  r.strokePaint.setColor(hexToCKColor(ck, SBGN_STYLE.nodeBorderColor))
  r.strokePaint.setStrokeWidth(SBGN_STYLE.edgeLineWidth)
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  canvas.drawCircle(tipX, tipY, size * 0.5, r.strokePaint)
}
