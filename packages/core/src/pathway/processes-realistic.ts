import type { Canvas, CanvasKit } from 'canvaskit-wasm'

import type { SceneNode, PathwayNodeData, PathwayProcessType } from '@signal-forge/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'

import { REALISTIC_STYLE } from './constants'
import { hexToCKColor, paintProcessSymbol } from './utils'

function paintRealistic3DProcessRect(
  ck: CanvasKit,
  canvas: Canvas,
  w: number,
  h: number,
  r: SkiaRenderer
): void {
  const ds = REALISTIC_STYLE.dropShadow
  const shadowFilter = ck.ImageFilter.MakeDropShadow(
    ds.offsetX, ds.offsetY,
    ds.blur, ds.blur,
    hexToCKColor(ck, ds.color),
    null
  )
  if (shadowFilter) r.fillPaint.setImageFilter(shadowFilter)

  const shader = ck.Shader.MakeRadialGradient(
    [w * 0.35, h * 0.3],
    Math.max(w, h) * 0.7,
    [hexToCKColor(ck, '#E8E8E8'), hexToCKColor(ck, '#C0C0C0'), hexToCKColor(ck, '#909090'), hexToCKColor(ck, '#707070')],
    [0, 0.3, 0.7, 1],
    ck.TileMode.Clamp
  )
  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  if (shader) {
    r.fillPaint.setShader(shader)
    canvas.drawRect(ck.LTRBRect(0, 0, w, h), r.fillPaint)
    r.fillPaint.setShader(null)
    shader.delete()
  } else {
    r.fillPaint.setColor(hexToCKColor(ck, '#C0C0C0'))
    canvas.drawRect(ck.LTRBRect(0, 0, w, h), r.fillPaint)
  }

  if (shadowFilter) {
    r.fillPaint.setImageFilter(null)
    shadowFilter.delete()
  }

  const highlightShader = ck.Shader.MakeLinearGradient(
    [0, 0], [0, h * 0.5],
    [hexToCKColor(ck, 'rgba(255,255,255,0.35)'), ck.Color4f(1, 1, 1, 0)],
    [0, 1],
    ck.TileMode.Clamp
  )
  if (highlightShader) {
    canvas.save()
    const clipPath = new ck.Path()
    clipPath.moveTo(0, 0)
    clipPath.lineTo(w, 0)
    clipPath.lineTo(w, h * 0.5)
    clipPath.lineTo(0, h * 0.5)
    clipPath.close()
    canvas.clipPath(clipPath, ck.ClipOp.Intersect, true)
    clipPath.delete()
    r.fillPaint.setStyle(ck.PaintStyle.Fill)
    r.fillPaint.setShader(highlightShader)
    canvas.drawRect(ck.LTRBRect(0, 0, w, h), r.fillPaint)
    r.fillPaint.setShader(null)
    highlightShader.delete()
    canvas.restore()
  }

  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setStrokeWidth(1)
  r.strokePaint.setColor(hexToCKColor(ck, REALISTIC_STYLE.bevelTopColor))
  canvas.drawLine(0.5, 0.5, w - 0.5, 0.5, r.strokePaint)
  r.strokePaint.setColor(hexToCKColor(ck, REALISTIC_STYLE.bevelBottomColor))
  canvas.drawLine(0.5, h - 0.5, w - 0.5, h - 0.5, r.strokePaint)

  r.strokePaint.setColor(hexToCKColor(ck, '#606060'))
  r.strokePaint.setStrokeWidth(REALISTIC_STYLE.borderWidth)
  canvas.drawRect(ck.LTRBRect(0, 0, w, h), r.strokePaint)
}

export function paintRealisticGenericProcess(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  _data: PathwayNodeData,
  r: SkiaRenderer
): void {
  paintRealistic3DProcessRect(ck, canvas, node.width, node.height, r)
}

export function paintRealisticTransport(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  _data: PathwayNodeData,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height
  paintRealistic3DProcessRect(ck, canvas, w, h, r)
  const inset = REALISTIC_STYLE.borderWidth + 2
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, '#606060'))
  r.strokePaint.setStrokeWidth(REALISTIC_STYLE.borderWidth)
  canvas.drawRect(ck.LTRBRect(inset, inset, w - inset, h - inset), r.strokePaint)
}

export function paintRealisticAssociation(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  _data: PathwayNodeData,
  r: SkiaRenderer
): void {
  const radius = Math.min(node.width, node.height) / 2
  if (radius <= 0) return
  const cx = node.width / 2
  const cy = node.height / 2

  const ds = REALISTIC_STYLE.dropShadow
  const shadowFilter = ck.ImageFilter.MakeDropShadow(
    ds.offsetX, ds.offsetY,
    ds.blur, ds.blur,
    hexToCKColor(ck, ds.color),
    null
  )
  if (shadowFilter) r.fillPaint.setImageFilter(shadowFilter)

  const shader = ck.Shader.MakeRadialGradient(
    [cx * 0.7, cy * 0.6],
    radius,
    [hexToCKColor(ck, '#A0A0A0'), hexToCKColor(ck, '#707070'), hexToCKColor(ck, '#505050')],
    [0, 0.6, 1],
    ck.TileMode.Clamp
  )
  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  if (shader) {
    r.fillPaint.setShader(shader)
    canvas.drawCircle(cx, cy, radius, r.fillPaint)
    r.fillPaint.setShader(null)
    shader.delete()
  } else {
    r.fillPaint.setColor(hexToCKColor(ck, '#6B6B6B'))
    canvas.drawCircle(cx, cy, radius, r.fillPaint)
  }

  if (shadowFilter) {
    r.fillPaint.setImageFilter(null)
    shadowFilter.delete()
  }

  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, '#505050'))
  r.strokePaint.setStrokeWidth(REALISTIC_STYLE.borderWidth)
  canvas.drawCircle(cx, cy, radius, r.strokePaint)
}

export function paintRealisticDissociation(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  _data: PathwayNodeData,
  r: SkiaRenderer
): void {
  const cx = node.width / 2
  const cy = node.height / 2
  const outerR = (Math.min(node.width, node.height) - 2) / 2
  const innerR = (Math.min(node.width, node.height) - 2) / 3
  if (outerR <= 0) return

  const ds = REALISTIC_STYLE.dropShadow
  const shadowFilter = ck.ImageFilter.MakeDropShadow(
    ds.offsetX, ds.offsetY,
    ds.blur, ds.blur,
    hexToCKColor(ck, ds.color),
    null
  )
  if (shadowFilter) r.fillPaint.setImageFilter(shadowFilter)

  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.fillPaint.setColor(hexToCKColor(ck, '#E8E8E8'))
  canvas.drawCircle(cx, cy, outerR, r.fillPaint)

  if (shadowFilter) {
    r.fillPaint.setImageFilter(null)
    shadowFilter.delete()
  }

  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, '#6A6A6A'))
  r.strokePaint.setStrokeWidth(2)
  canvas.drawCircle(cx, cy, outerR, r.strokePaint)
  canvas.drawCircle(cx, cy, innerR, r.strokePaint)
}

export function paintRealisticOmittedProcess(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  _data: PathwayNodeData,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height

  const ds = REALISTIC_STYLE.dropShadow
  const shadowFilter = ck.ImageFilter.MakeDropShadow(
    ds.offsetX, ds.offsetY,
    ds.blur, ds.blur,
    hexToCKColor(ck, ds.color),
    null
  )
  if (shadowFilter) r.fillPaint.setImageFilter(shadowFilter)

  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.fillPaint.setColor(hexToCKColor(ck, '#E8E8E8'))
  canvas.drawRect(ck.LTRBRect(0, 0, w, h), r.fillPaint)

  if (shadowFilter) {
    r.fillPaint.setImageFilter(null)
    shadowFilter.delete()
  }

  const dashEffect = ck.PathEffect.MakeDash([3, 3], 0)
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, '#606060'))
  r.strokePaint.setStrokeWidth(REALISTIC_STYLE.borderWidth)
  r.strokePaint.setPathEffect(dashEffect)
  canvas.drawRect(ck.LTRBRect(0, 0, w, h), r.strokePaint)
  r.strokePaint.setPathEffect(null)
  if (dashEffect) dashEffect.delete()

  paintProcessSymbol(ck, canvas, node, '\\', r)
}

export function paintRealisticUncertainProcess(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  _data: PathwayNodeData,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height

  const ds = REALISTIC_STYLE.dropShadow
  const shadowFilter = ck.ImageFilter.MakeDropShadow(
    ds.offsetX, ds.offsetY,
    ds.blur, ds.blur,
    hexToCKColor(ck, ds.color),
    null
  )
  if (shadowFilter) r.fillPaint.setImageFilter(shadowFilter)

  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.fillPaint.setColor(hexToCKColor(ck, '#E8E8E8'))
  canvas.drawRect(ck.LTRBRect(0, 0, w, h), r.fillPaint)

  if (shadowFilter) {
    r.fillPaint.setImageFilter(null)
    shadowFilter.delete()
  }

  const dashEffect = ck.PathEffect.MakeDash([4, 2], 0)
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, '#606060'))
  r.strokePaint.setStrokeWidth(REALISTIC_STYLE.borderWidth)
  r.strokePaint.setPathEffect(dashEffect)
  canvas.drawRect(ck.LTRBRect(0, 0, w, h), r.strokePaint)
  r.strokePaint.setPathEffect(null)
  if (dashEffect) dashEffect.delete()

  paintProcessSymbol(ck, canvas, node, '?', r)
}

const REALISTIC_PROCESS_PAINTERS: Record<PathwayProcessType, typeof paintRealisticGenericProcess> = {
  process: paintRealisticGenericProcess,
  transport: paintRealisticTransport,
  association: paintRealisticAssociation,
  dissociation: paintRealisticDissociation,
  omitted_process: paintRealisticOmittedProcess,
  uncertain_process: paintRealisticUncertainProcess,
}

export function paintRealisticProcess(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  r: SkiaRenderer
): void {
  const processType = data.processType
  if (!processType) {
    paintRealisticGenericProcess(ck, canvas, node, data, r)
    return
  }
  const painter = REALISTIC_PROCESS_PAINTERS[processType]
  if (painter) {
    painter(ck, canvas, node, data, r)
  } else {
    paintRealisticGenericProcess(ck, canvas, node, data, r)
  }
}
