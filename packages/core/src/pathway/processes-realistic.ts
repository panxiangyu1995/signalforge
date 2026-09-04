import type { Canvas, CanvasKit, Shader } from 'canvaskit-wasm'

import type { SceneNode, PathwayNodeData, PathwayProcessType } from '@signal-forge/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'

import { REALISTIC_STYLE } from './constants'
import { hexToCKColor, paintProcessSymbol, buildRoundedRectPath } from './utils'

const PROCESS_PEARL_STOPS = ['#FFFFFF', '#D6E4EC', '#9FB8C6', '#7391A3'] as const
const PROCESS_PEARL_FILL = '#EAF1F5'
const PROCESS_PEARL_BORDER = '#5E7D8C'

function pearlRadialShader(ck: CanvasKit, cx: number, cy: number, radius: number): Shader | null {
  return ck.Shader.MakeRadialGradient(
    [cx, cy],
    radius,
    PROCESS_PEARL_STOPS.map((c) => hexToCKColor(ck, c)),
    [0, 0.35, 0.7, 1],
    ck.TileMode.Clamp
  )
}

function paintRealistic3DProcessRect(
  ck: CanvasKit,
  canvas: Canvas,
  w: number,
  h: number,
  r: SkiaRenderer
): void {
  if (w <= 0 || h <= 0) return
  const cr = Math.min(w, h) * 0.3
  const path = buildRoundedRectPath(ck, w, h, cr)
  try {
    const ds = REALISTIC_STYLE.dropShadow
    const shadowFilter = ck.ImageFilter.MakeDropShadow(
      ds.offsetX,
      ds.offsetY,
      ds.blur,
      ds.blur,
      hexToCKColor(ck, ds.color),
      null
    )
    r.fillPaint.setImageFilter(shadowFilter)

    const shader = pearlRadialShader(ck, w * 0.35, h * 0.3, Math.max(w, h) * 0.8)
    r.fillPaint.setStyle(ck.PaintStyle.Fill)
    if (shader) {
      r.fillPaint.setShader(shader)
      canvas.drawPath(path, r.fillPaint)
      r.fillPaint.setShader(null)
      shader.delete()
    } else {
      r.fillPaint.setColor(hexToCKColor(ck, PROCESS_PEARL_FILL))
      canvas.drawPath(path, r.fillPaint)
    }

    r.fillPaint.setImageFilter(null)
    shadowFilter.delete()

    const highlightShader = ck.Shader.MakeLinearGradient(
      [0, 0],
      [0, h * 0.5],
      [hexToCKColor(ck, 'rgba(255,255,255,0.5)'), ck.Color4f(1, 1, 1, 0)],
      [0, 1],
      ck.TileMode.Clamp
    )
    canvas.save()
    canvas.clipPath(path, ck.ClipOp.Intersect, true)
    r.fillPaint.setStyle(ck.PaintStyle.Fill)
    r.fillPaint.setShader(highlightShader)
    canvas.drawPath(path, r.fillPaint)
    r.fillPaint.setShader(null)
    highlightShader.delete()
    canvas.restore()

    r.strokePaint.setStyle(ck.PaintStyle.Stroke)
    r.strokePaint.setStrokeWidth(REALISTIC_STYLE.borderWidth)
    r.strokePaint.setColor(hexToCKColor(ck, PROCESS_PEARL_BORDER))
    canvas.drawPath(path, r.strokePaint)
  } finally {
    path.delete()
  }
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
  const innerCr = Math.max(0, Math.min(w, h) * 0.3 - inset)
  const inner = buildRoundedRectPath(
    ck,
    Math.max(0, w - inset * 2),
    Math.max(0, h - inset * 2),
    innerCr
  )
  try {
    canvas.save()
    canvas.translate(inset, inset)
    r.strokePaint.setStyle(ck.PaintStyle.Stroke)
    r.strokePaint.setColor(hexToCKColor(ck, PROCESS_PEARL_BORDER))
    r.strokePaint.setStrokeWidth(REALISTIC_STYLE.borderWidth)
    canvas.drawPath(inner, r.strokePaint)
    canvas.restore()
  } finally {
    inner.delete()
  }
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

  // SBGN association: two interlocking pearls.
  const r2 = radius * 0.85
  const offset = radius * 0.42
  const centers: ReadonlyArray<readonly [number, number]> = [
    [cx - offset, cy],
    [cx + offset, cy]
  ]

  const ds = REALISTIC_STYLE.dropShadow
  const shadowFilter = ck.ImageFilter.MakeDropShadow(
    ds.offsetX,
    ds.offsetY,
    ds.blur,
    ds.blur,
    hexToCKColor(ck, ds.color),
    null
  )
  r.fillPaint.setImageFilter(shadowFilter)

  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  for (const [px, py] of centers) {
    const shader = pearlRadialShader(ck, px - r2 * 0.35, py - r2 * 0.4, r2)
    if (shader) {
      r.fillPaint.setShader(shader)
      canvas.drawCircle(px, py, r2, r.fillPaint)
      r.fillPaint.setShader(null)
      shader.delete()
    } else {
      r.fillPaint.setColor(hexToCKColor(ck, PROCESS_PEARL_FILL))
      canvas.drawCircle(px, py, r2, r.fillPaint)
    }
  }

  r.fillPaint.setImageFilter(null)
  shadowFilter.delete()

  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, PROCESS_PEARL_BORDER))
  r.strokePaint.setStrokeWidth(REALISTIC_STYLE.borderWidth)
  for (const [px, py] of centers) {
    canvas.drawCircle(px, py, r2, r.strokePaint)
  }
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
    ds.offsetX,
    ds.offsetY,
    ds.blur,
    ds.blur,
    hexToCKColor(ck, ds.color),
    null
  )
  r.fillPaint.setImageFilter(shadowFilter)

  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.fillPaint.setColor(hexToCKColor(ck, PROCESS_PEARL_FILL))
  canvas.drawCircle(cx, cy, outerR, r.fillPaint)

  r.fillPaint.setImageFilter(null)
  shadowFilter.delete()

  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, PROCESS_PEARL_BORDER))
  r.strokePaint.setStrokeWidth(REALISTIC_STYLE.borderWidth)
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
    ds.offsetX,
    ds.offsetY,
    ds.blur,
    ds.blur,
    hexToCKColor(ck, ds.color),
    null
  )
  r.fillPaint.setImageFilter(shadowFilter)

  const path = buildRoundedRectPath(ck, w, h, Math.min(w, h) * 0.3)
  try {
    r.fillPaint.setStyle(ck.PaintStyle.Fill)
    r.fillPaint.setColor(hexToCKColor(ck, PROCESS_PEARL_FILL))
    canvas.drawPath(path, r.fillPaint)

    r.fillPaint.setImageFilter(null)
    shadowFilter.delete()

    const dashEffect = ck.PathEffect.MakeDash([3, 3], 0)
    r.strokePaint.setStyle(ck.PaintStyle.Stroke)
    r.strokePaint.setColor(hexToCKColor(ck, PROCESS_PEARL_BORDER))
    r.strokePaint.setStrokeWidth(REALISTIC_STYLE.borderWidth)
    r.strokePaint.setPathEffect(dashEffect)
    canvas.drawPath(path, r.strokePaint)
    r.strokePaint.setPathEffect(null)
    dashEffect.delete()
  } finally {
    path.delete()
  }

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
    ds.offsetX,
    ds.offsetY,
    ds.blur,
    ds.blur,
    hexToCKColor(ck, ds.color),
    null
  )
  r.fillPaint.setImageFilter(shadowFilter)

  const path = buildRoundedRectPath(ck, w, h, Math.min(w, h) * 0.3)
  try {
    r.fillPaint.setStyle(ck.PaintStyle.Fill)
    r.fillPaint.setColor(hexToCKColor(ck, PROCESS_PEARL_FILL))
    canvas.drawPath(path, r.fillPaint)

    r.fillPaint.setImageFilter(null)
    shadowFilter.delete()

    const dashEffect = ck.PathEffect.MakeDash([4, 2], 0)
    r.strokePaint.setStyle(ck.PaintStyle.Stroke)
    r.strokePaint.setColor(hexToCKColor(ck, PROCESS_PEARL_BORDER))
    r.strokePaint.setStrokeWidth(REALISTIC_STYLE.borderWidth)
    r.strokePaint.setPathEffect(dashEffect)
    canvas.drawPath(path, r.strokePaint)
    r.strokePaint.setPathEffect(null)
    dashEffect.delete()
  } finally {
    path.delete()
  }

  paintProcessSymbol(ck, canvas, node, '?', r)
}

const REALISTIC_PROCESS_PAINTERS: Partial<
  Record<PathwayProcessType, typeof paintRealisticGenericProcess>
> = {
  process: paintRealisticGenericProcess,
  transport: paintRealisticTransport,
  association: paintRealisticAssociation,
  dissociation: paintRealisticDissociation,
  omitted_process: paintRealisticOmittedProcess,
  uncertain_process: paintRealisticUncertainProcess
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
  if (!painter) {
    paintRealisticGenericProcess(ck, canvas, node, data, r)
    return
  }
  painter(ck, canvas, node, data, r)
}
