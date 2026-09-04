import type { Canvas, CanvasKit } from 'canvaskit-wasm'

import type { SceneNode, PathwayNodeData, PathwayProcessType } from '@signal-forge/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'

import { SBGN_STYLE, type PathwayStyle } from './constants'
import { paintRealisticProcess as paintRealisticProcessEntry } from './processes-realistic'
import { hexToCKColor, paintProcessSymbol } from './utils'

export function paintProcess(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  _data: PathwayNodeData,
  _style: PathwayStyle,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height

  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.fillPaint.setColor(hexToCKColor(ck, SBGN_STYLE.nodeBackgroundColor))
  canvas.drawRect(ck.LTRBRect(0, 0, w, h), r.fillPaint)

  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, SBGN_STYLE.nodeBorderColor))
  r.strokePaint.setStrokeWidth(SBGN_STYLE.defaultBorderWidth)
  canvas.drawRect(ck.LTRBRect(0, 0, w, h), r.strokePaint)
}

export function paintTransport(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  _data: PathwayNodeData,
  _style: PathwayStyle,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height

  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.fillPaint.setColor(hexToCKColor(ck, SBGN_STYLE.nodeBackgroundColor))
  canvas.drawRect(ck.LTRBRect(0, 0, w, h), r.fillPaint)

  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, SBGN_STYLE.nodeBorderColor))
  r.strokePaint.setStrokeWidth(SBGN_STYLE.defaultBorderWidth)
  canvas.drawRect(ck.LTRBRect(0, 0, w, h), r.strokePaint)

  const inset = SBGN_STYLE.defaultBorderWidth + 2
  r.strokePaint.setStrokeWidth(SBGN_STYLE.defaultBorderWidth)
  canvas.drawRect(ck.LTRBRect(inset, inset, w - inset, h - inset), r.strokePaint)
}

export function paintAssociation(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  _data: PathwayNodeData,
  _style: PathwayStyle,
  r: SkiaRenderer
): void {
  const radius = Math.min(node.width, node.height) / 2
  if (radius <= 0) return

  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.fillPaint.setColor(hexToCKColor(ck, SBGN_STYLE.associationFill))
  canvas.drawCircle(node.width / 2, node.height / 2, radius, r.fillPaint)
}

export function paintDissociation(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  _data: PathwayNodeData,
  _style: PathwayStyle,
  r: SkiaRenderer
): void {
  const cx = node.width / 2
  const cy = node.height / 2
  const outerR = (Math.min(node.width, node.height) - 2) / 2
  const innerR = (Math.min(node.width, node.height) - 2) / 3
  if (outerR <= 0) return

  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.fillPaint.setColor(hexToCKColor(ck, SBGN_STYLE.nodeBackgroundColor))
  canvas.drawCircle(cx, cy, outerR, r.fillPaint)

  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, SBGN_STYLE.dissociationStroke))
  r.strokePaint.setStrokeWidth(2)
  canvas.drawCircle(cx, cy, outerR, r.strokePaint)
  canvas.drawCircle(cx, cy, innerR, r.strokePaint)
}

export function paintOmittedProcess(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  _data: PathwayNodeData,
  _style: PathwayStyle,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height

  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.fillPaint.setColor(hexToCKColor(ck, SBGN_STYLE.nodeBackgroundColor))
  canvas.drawRect(ck.LTRBRect(0, 0, w, h), r.fillPaint)

  const dashEffect = ck.PathEffect.MakeDash([3, 3], 0)
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, SBGN_STYLE.nodeBorderColor))
  r.strokePaint.setStrokeWidth(SBGN_STYLE.defaultBorderWidth)
  r.strokePaint.setPathEffect(dashEffect)
  canvas.drawRect(ck.LTRBRect(0, 0, w, h), r.strokePaint)
  r.strokePaint.setPathEffect(null)
  dashEffect.delete()

  paintProcessSymbol(ck, canvas, node, '\\', r)
}

export function paintUncertainProcess(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  _data: PathwayNodeData,
  _style: PathwayStyle,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height

  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.fillPaint.setColor(hexToCKColor(ck, SBGN_STYLE.nodeBackgroundColor))
  canvas.drawRect(ck.LTRBRect(0, 0, w, h), r.fillPaint)

  const dashEffect = ck.PathEffect.MakeDash([4, 2], 0)
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, SBGN_STYLE.nodeBorderColor))
  r.strokePaint.setStrokeWidth(SBGN_STYLE.defaultBorderWidth)
  r.strokePaint.setPathEffect(dashEffect)
  canvas.drawRect(ck.LTRBRect(0, 0, w, h), r.strokePaint)
  r.strokePaint.setPathEffect(null)
  dashEffect.delete()

  paintProcessSymbol(ck, canvas, node, '?', r)
}

const PROCESS_PAINTERS: Record<PathwayProcessType, typeof paintProcess> = {
  process: paintProcess,
  transport: paintTransport,
  association: paintAssociation,
  dissociation: paintDissociation,
  omitted_process: paintOmittedProcess,
  uncertain_process: paintUncertainProcess,
}

export function paintPathwayProcess(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  style: PathwayStyle,
  r: SkiaRenderer
): void {
  if (style === 'realistic') {
    paintRealisticProcessEntry(ck, canvas, node, data, r)
    return
  }
  const processType = data.processType
  if (!processType) {
    paintProcess(ck, canvas, node, data, style, r)
    return
  }
  // PRD vocabulary admits process types this renderer does not specialize yet
  // (e.g. 'biochemical_reaction' renders identically to 'process'), so fall
  // back to the plain process painter instead of crashing on unknown keys.
  const painter = PROCESS_PAINTERS[processType] ?? paintProcess
  painter(ck, canvas, node, data, style, r)
}
