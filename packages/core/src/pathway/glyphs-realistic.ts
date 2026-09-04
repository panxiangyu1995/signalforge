import type { Canvas, CanvasKit, Shader } from 'canvaskit-wasm'

import type {
  SceneNode,
  PathwayNodeData,
  PathwayGlyphType,
  Vector
} from '@signal-forge/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'

import { SBGN_STYLE, REALISTIC_STYLE } from './constants'
import { isReceptorName, paintDoubleHelix } from './glyphs-decor'
import { pickEntityColors, type EntityColorSpec } from './palette'
import { hexToCKColor, buildRoundedRectPath } from './utils'

function buildRoundedPolygonPath(
  ck: CanvasKit,
  points: ReadonlyArray<Vector>,
  radius: number
): InstanceType<CanvasKit['Path']> {
  const path = new ck.Path()
  const n = points.length
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]
    const cur = points[i]
    const next = points[(i + 1) % n]
    const toPrevX = prev.x - cur.x
    const toPrevY = prev.y - cur.y
    const toNextX = next.x - cur.x
    const toNextY = next.y - cur.y
    const lenPrev = Math.hypot(toPrevX, toPrevY)
    const lenNext = Math.hypot(toNextX, toNextY)
    if (lenPrev === 0 || lenNext === 0) continue
    const r = Math.min(radius, lenPrev / 2, lenNext / 2)
    const ax = cur.x + (toPrevX / lenPrev) * r
    const ay = cur.y + (toPrevY / lenPrev) * r
    const bx = cur.x + (toNextX / lenNext) * r
    const by = cur.y + (toNextY / lenNext) * r
    if (i === 0) path.moveTo(ax, ay)
    else path.lineTo(ax, ay)
    path.quadTo(cur.x, cur.y, bx, by)
  }
  path.close()
  return path
}

function radialGradientShader(
  ck: CanvasKit,
  glyphType: PathwayGlyphType | undefined,
  w: number,
  h: number,
  stops?: readonly [string, string, string, string]
): Shader | null {
  const gradientStops = stops ?? (glyphType ? REALISTIC_STYLE.entityRadialGradients[glyphType]?.stops : undefined)
  if (!gradientStops) return null
  const cx = w * 0.35
  const cy = h * 0.3
  const radius = Math.max(w, h) * 0.7
  const colors = gradientStops.map((c) => hexToCKColor(ck, c))
  const positions = gradientStops.map((_, i) => i / (gradientStops.length - 1))
  return ck.Shader.MakeRadialGradient([cx, cy], radius, colors, positions, ck.TileMode.Clamp)
}

function applyRealisticFill(
  ck: CanvasKit,
  canvas: Canvas,
  path: InstanceType<CanvasKit['Path']>,
  glyphType: PathwayGlyphType | undefined,
  w: number,
  h: number,
  r: SkiaRenderer,
  vivid: EntityColorSpec | null
): void {
  const shader = radialGradientShader(ck, glyphType, w, h, vivid?.stops)
  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  if (shader) {
    r.fillPaint.setShader(shader)
    canvas.drawPath(path, r.fillPaint)
    r.fillPaint.setShader(null)
    shader.delete()
  } else {
    const fill = glyphType ? REALISTIC_STYLE.entityFills[glyphType] : undefined
    r.fillPaint.setColor(hexToCKColor(ck, fill ?? '#D5D8DC'))
    canvas.drawPath(path, r.fillPaint)
  }
}

function paintHighlight(
  ck: CanvasKit,
  canvas: Canvas,
  path: InstanceType<CanvasKit['Path']>,
  w: number,
  h: number,
  r: SkiaRenderer
): void {
  const shader = ck.Shader.MakeLinearGradient(
    [0, 0],
    [0, h * 0.6],
    [hexToCKColor(ck, REALISTIC_STYLE.highlightColor), ck.Color4f(1, 1, 1, 0)],
    [0, 1],
    ck.TileMode.Clamp
  )
  canvas.save()
  const clipPath = new ck.Path()
  clipPath.moveTo(0, 0)
  clipPath.lineTo(w, 0)
  clipPath.lineTo(w, h * 0.55)
  clipPath.quadTo(w * 0.5, h * 0.65, 0, h * 0.55)
  clipPath.close()
  canvas.clipPath(clipPath, ck.ClipOp.Intersect, true)
  clipPath.delete()
  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.fillPaint.setShader(shader)
  canvas.drawPath(path, r.fillPaint)
  r.fillPaint.setShader(null)
  shader.delete()
  canvas.restore()

  // Specular hotspot: a small bright spot on the upper-left curvature.
  const hotspotShader = ck.Shader.MakeRadialGradient(
    [w * 0.3, h * 0.24],
    Math.min(w, h) * 0.32,
    [ck.Color4f(1, 1, 1, 0.6), ck.Color4f(1, 1, 1, 0)],
    [0, 1],
    ck.TileMode.Clamp
  )
  canvas.save()
  canvas.clipPath(path, ck.ClipOp.Intersect, false)
  r.fillPaint.setShader(hotspotShader)
  canvas.drawPaint(r.fillPaint)
  r.fillPaint.setShader(null)
  hotspotShader.delete()
  canvas.restore()

  // Ambient reflection band along the bottom edge.
  const reflShader = ck.Shader.MakeLinearGradient(
    [0, h * 0.74],
    [0, h],
    [ck.Color4f(1, 1, 1, 0), ck.Color4f(1, 1, 1, 0.22)],
    [0, 1],
    ck.TileMode.Clamp
  )
  canvas.save()
  canvas.clipPath(path, ck.ClipOp.Intersect, false)
  r.fillPaint.setShader(reflShader)
  canvas.drawPaint(r.fillPaint)
  r.fillPaint.setShader(null)
  reflShader.delete()
  canvas.restore()
}

function paintInnerShadow(
  ck: CanvasKit,
  canvas: Canvas,
  path: InstanceType<CanvasKit['Path']>,
  w: number,
  h: number,
  r: SkiaRenderer
): void {
  const spec = REALISTIC_STYLE.innerShadow
  const shadowColor = hexToCKColor(ck, spec.color)
  canvas.save()
  canvas.clipPath(path, ck.ClipOp.Intersect, true)
  const shadowPath = new ck.Path()
  shadowPath.moveTo(0, h * 0.5)
  shadowPath.quadTo(w * 0.5, h * 0.35, w, h * 0.5)
  shadowPath.lineTo(w, h)
  shadowPath.lineTo(0, h)
  shadowPath.close()
  const filter = ck.ImageFilter.MakeDropShadowOnly(
    spec.offsetX,
    spec.offsetY,
    spec.blur,
    spec.blur,
    shadowColor,
    null
  )
  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.fillPaint.setColor(ck.Color4f(0, 0, 0, 1))
  r.fillPaint.setImageFilter(filter)
  canvas.drawPath(shadowPath, r.fillPaint)
  r.fillPaint.setImageFilter(null)
  filter.delete()
  shadowPath.delete()
  canvas.restore()
}

function paintBevelEdges(
  ck: CanvasKit,
  canvas: Canvas,
  w: number,
  h: number,
  r: SkiaRenderer
): void {
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setStrokeWidth(1)
  r.strokePaint.setColor(hexToCKColor(ck, REALISTIC_STYLE.bevelTopColor))
  canvas.drawLine(1, 0.5, w - 1, 0.5, r.strokePaint)

  r.strokePaint.setColor(hexToCKColor(ck, REALISTIC_STYLE.bevelBottomColor))
  canvas.drawLine(1, h - 0.5, w - 1, h - 0.5, r.strokePaint)
}

function applyRealisticStroke(
  ck: CanvasKit,
  canvas: Canvas,
  path: InstanceType<CanvasKit['Path']>,
  glyphType: PathwayGlyphType | undefined,
  r: SkiaRenderer,
  vivid: EntityColorSpec | null
): void {
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  const border =
    vivid?.border ??
    (glyphType
      ? (REALISTIC_STYLE.entityBorders[glyphType] ?? REALISTIC_STYLE.entityBorders.default)
      : REALISTIC_STYLE.entityBorders.default)
  r.strokePaint.setColor(hexToCKColor(ck, border))
  r.strokePaint.setStrokeWidth(REALISTIC_STYLE.borderWidth)
  canvas.drawPath(path, r.strokePaint)
}

function paintRealisticLayers(
  ck: CanvasKit,
  canvas: Canvas,
  path: InstanceType<CanvasKit['Path']>,
  glyphType: PathwayGlyphType | undefined,
  w: number,
  h: number,
  r: SkiaRenderer,
  vivid: EntityColorSpec | null,
  skipBevel = false
): void {
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

  applyRealisticFill(ck, canvas, path, glyphType, w, h, r, vivid)

  r.fillPaint.setImageFilter(null)
  shadowFilter.delete()

  paintHighlight(ck, canvas, path, w, h, r)
  paintInnerShadow(ck, canvas, path, w, h, r)
  if (!skipBevel) paintBevelEdges(ck, canvas, w, h, r)
  applyRealisticStroke(ck, canvas, path, glyphType, r, vivid)
}

function paintReceptorChannel(
  ck: CanvasKit,
  canvas: Canvas,
  glyphType: PathwayGlyphType | undefined,
  w: number,
  h: number,
  r: SkiaRenderer,
  vivid: EntityColorSpec | null
): void {
  const cr = Math.min(w / 2, h / 2)
  const bodyPath = buildRoundedRectPath(ck, w, h, cr)
  try {
    paintRealisticLayers(ck, canvas, bodyPath, glyphType, w, h, r, vivid)
  } finally {
    bodyPath.delete()
  }

  // Multi-column transmembrane channel: pillars span the membrane,
  // extracellular loops sit above the top edge, stems below the bottom.
  const pillarColor = hexToCKColor(ck, vivid?.border ?? REALISTIC_STYLE.entityBorders.macromolecule)
  const count = Math.max(3, Math.min(7, Math.round(w / 22)))
  const inset = Math.max(9, w * 0.12)
  const step = count > 1 ? (w - inset * 2) / (count - 1) : 0
  const loopR = 3
  const topY = -loopR
  const bottomY = h + 2

  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setStrokeWidth(2.2)
  r.strokePaint.setColor(pillarColor)
  for (let i = 0; i < count; i++) {
    const x = inset + step * i
    canvas.drawLine(x, topY, x, bottomY, r.strokePaint)
  }

  r.strokePaint.setStrokeWidth(1.8)
  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.fillPaint.setColor(hexToCKColor(ck, '#F4F7FB'))
  for (let i = 0; i < count; i++) {
    const x = inset + step * i
    canvas.drawCircle(x, topY, loopR, r.fillPaint)
    canvas.drawCircle(x, topY, loopR, r.strokePaint)
  }

  r.strokePaint.setStrokeWidth(2)
  for (let i = 0; i < count; i++) {
    const x = inset + step * i
    canvas.drawLine(x, bottomY, x, bottomY + 3.5, r.strokePaint)
  }
}

export function paintRealisticMacromolecule(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height
  if (w <= 0 || h <= 0) return
  const vivid = pickEntityColors(node.name)
  if (isReceptorName(node.name)) {
    paintReceptorChannel(ck, canvas, data.glyphType, w, h, r, vivid)
    return
  }
  const cr = Math.min(w / 2, h / 2)
  const path = buildRoundedRectPath(ck, w, h, cr)
  try {
    paintRealisticLayers(ck, canvas, path, data.glyphType, w, h, r, vivid)
  } finally {
    path.delete()
  }
}

export function paintRealisticSimpleChemical(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height
  if (w <= 0 || h <= 0) return
  const cr = Math.min(w / 2, h / 2)
  const path = buildRoundedRectPath(ck, w, h, cr)
  try {
    paintRealisticLayers(ck, canvas, path, data.glyphType, w, h, r, pickEntityColors(node.name))
  } finally {
    path.delete()
  }
}

export function paintRealisticComplex(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height
  if (w <= 0 || h <= 0) return
  const cut = Math.min(SBGN_STYLE.complexCornerCutLength, w / 2, h / 2)
  const points = [
    { x: cut, y: 0 },
    { x: w - cut, y: 0 },
    { x: w, y: cut },
    { x: w, y: h - cut },
    { x: w - cut, y: h },
    { x: cut, y: h },
    { x: 0, y: h - cut },
    { x: 0, y: cut }
  ]
  const path = buildRoundedPolygonPath(ck, points, cut * 0.5)
  try {
    paintRealisticLayers(ck, canvas, path, data.glyphType, w, h, r, pickEntityColors(node.name))
  } finally {
    path.delete()
  }
}

export function paintRealisticNucleicAcidFeature(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height
  const br = SBGN_STYLE.nucleicAcidBottomCornerRadius * h
  const tr = Math.min(h * 0.18, br)
  const path = new ck.Path()
  try {
    path.moveTo(tr, 0)
    path.lineTo(w - tr, 0)
    path.quadTo(w, 0, w, tr)
    path.lineTo(w, h - br)
    path.quadTo(w, h, w - br, h)
    path.lineTo(br, h)
    path.quadTo(0, h, 0, h - br)
    path.lineTo(0, tr)
    path.quadTo(0, 0, tr, 0)
    path.close()
    paintRealisticLayers(ck, canvas, path, data.glyphType, w, h, r, pickEntityColors(node.name))
    paintDoubleHelix(ck, canvas, w, h, r)
  } finally {
    path.delete()
  }
}

export function paintRealisticPhenotype(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height
  const points = [
    { x: w * 0.25, y: 0 },
    { x: w * 0.75, y: 0 },
    { x: w, y: h * 0.5 },
    { x: w * 0.75, y: h },
    { x: w * 0.25, y: h },
    { x: 0, y: h * 0.5 }
  ]
  const path = buildRoundedPolygonPath(ck, points, Math.min(w, h) * 0.14)
  try {
    paintRealisticLayers(ck, canvas, path, data.glyphType, w, h, r, pickEntityColors(node.name), true)
  } finally {
    path.delete()
  }
}

export function paintRealisticPerturbation(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height
  const points = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w * 0.85, y: h * 0.5 },
    { x: w, y: h },
    { x: 0, y: h },
    { x: w * 0.15, y: h * 0.5 }
  ]
  const path = buildRoundedPolygonPath(ck, points, Math.min(w, h) * 0.12)
  try {
    paintRealisticLayers(ck, canvas, path, data.glyphType, w, h, r, pickEntityColors(node.name), true)
  } finally {
    path.delete()
  }
}

export function paintRealisticSourceSink(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height
  const radius = Math.min(w, h) / 2
  const cx = w / 2
  const cy = h / 2

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

  const vivid = pickEntityColors(node.name)
  const shader = radialGradientShader(ck, data.glyphType, w, h, vivid?.stops)
  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  if (shader) {
    r.fillPaint.setShader(shader)
    canvas.drawCircle(cx, cy, radius, r.fillPaint)
    r.fillPaint.setShader(null)
    shader.delete()
  } else {
    r.fillPaint.setColor(hexToCKColor(ck, REALISTIC_STYLE.entityFills.source_sink))
    canvas.drawCircle(cx, cy, radius, r.fillPaint)
  }

  r.fillPaint.setImageFilter(null)
  shadowFilter.delete()

  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, vivid?.border ?? REALISTIC_STYLE.entityBorders.source_sink))
  r.strokePaint.setStrokeWidth(REALISTIC_STYLE.borderWidth)
  canvas.drawCircle(cx, cy, radius, r.strokePaint)

  const cos45 = Math.SQRT1_2
  const sin45 = Math.SQRT1_2
  const rx = w / 2
  const ry = h / 2
  r.strokePaint.setStrokeWidth(REALISTIC_STYLE.borderWidth)
  canvas.drawLine(cx - rx * cos45, cy + ry * sin45, cx + rx * cos45, cy - ry * sin45, r.strokePaint)
}

export function paintRealisticUnspecifiedEntity(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height
  const rect = ck.LTRBRect(0, 0, w, h)

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

  const vivid = pickEntityColors(node.name)
  const shader = radialGradientShader(ck, data.glyphType, w, h, vivid?.stops)
  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  if (shader) {
    r.fillPaint.setShader(shader)
    canvas.drawOval(rect, r.fillPaint)
    r.fillPaint.setShader(null)
    shader.delete()
  } else {
    r.fillPaint.setColor(hexToCKColor(ck, REALISTIC_STYLE.entityFills.unspecified_entity))
    canvas.drawOval(rect, r.fillPaint)
  }

  r.fillPaint.setImageFilter(null)
  shadowFilter.delete()

  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, vivid?.border ?? REALISTIC_STYLE.entityBorders.unspecified_entity))
  r.strokePaint.setStrokeWidth(REALISTIC_STYLE.borderWidth)
  canvas.drawOval(rect, r.strokePaint)
}

const REALISTIC_GLYPH_PAINTERS: Partial<
  Record<PathwayGlyphType, typeof paintRealisticMacromolecule>
> = {
  macromolecule: paintRealisticMacromolecule,
  simple_chemical: paintRealisticSimpleChemical,
  complex: paintRealisticComplex,
  nucleic_acid_feature: paintRealisticNucleicAcidFeature,
  phenotype: paintRealisticPhenotype,
  perturbation: paintRealisticPerturbation,
  source_sink: paintRealisticSourceSink,
  unspecified_entity: paintRealisticUnspecifiedEntity
}

export function paintRealisticGlyph(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  r: SkiaRenderer
): void {
  const glyphType = data.glyphType
  if (!glyphType) {
    paintRealisticUnspecifiedEntity(ck, canvas, node, data, r)
    return
  }
  const painter = REALISTIC_GLYPH_PAINTERS[glyphType]
  if (!painter) {
    paintRealisticUnspecifiedEntity(ck, canvas, node, data, r)
    return
  }
  painter(ck, canvas, node, data, r)
}
