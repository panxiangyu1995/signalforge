import type { Canvas, CanvasKit, Shader } from 'canvaskit-wasm'

import type { SceneNode, PathwayNodeData, PathwayGlyphType } from '@signal-forge/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'

import { SBGN_STYLE, REALISTIC_STYLE } from './constants'
import { hexToCKColor, buildRoundedRectPath } from './utils'

function radialGradientShader(
  ck: CanvasKit,
  glyphType: PathwayGlyphType | undefined,
  w: number,
  h: number
): Shader | null {
  if (!glyphType) return null
  const spec = REALISTIC_STYLE.entityRadialGradients[glyphType]
  if (!spec) return null
  const cx = w * spec.cx
  const cy = h * spec.cy
  const radius = Math.max(w, h) * 0.7
  const colors = spec.stops.map(c => hexToCKColor(ck, c))
  const positions = spec.stops.map((_, i) => i / (spec.stops.length - 1))
  return ck.Shader.MakeRadialGradient(
    [cx, cy],
    radius,
    colors,
    positions,
    ck.TileMode.Clamp
  )
}

function applyRealisticFill(
  ck: CanvasKit,
  canvas: Canvas,
  path: InstanceType<CanvasKit['Path']>,
  glyphType: PathwayGlyphType | undefined,
  w: number,
  h: number,
  r: SkiaRenderer
): void {
  const shader = radialGradientShader(ck, glyphType, w, h)
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
    [0, 0], [0, h * 0.6],
    [hexToCKColor(ck, REALISTIC_STYLE.highlightColor), ck.Color4f(1, 1, 1, 0)],
    [0, 1],
    ck.TileMode.Clamp
  )
  if (!shader) return
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
  const filter = ck.ImageFilter.MakeDropShadow(
    spec.offsetX, spec.offsetY,
    spec.blur, spec.blur,
    shadowColor,
    null
  )
  if (filter) {
    r.fillPaint.setStyle(ck.PaintStyle.Fill)
    r.fillPaint.setColor(ck.Color4f(0, 0, 0, 0))
    r.fillPaint.setImageFilter(filter)
    canvas.drawPath(shadowPath, r.fillPaint)
    r.fillPaint.setImageFilter(null)
    filter.delete()
  }
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
  r: SkiaRenderer
): void {
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  const border = glyphType
    ? (REALISTIC_STYLE.entityBorders[glyphType] ?? REALISTIC_STYLE.entityBorders.default)
    : REALISTIC_STYLE.entityBorders.default
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
  skipBevel = false
): void {
  const ds = REALISTIC_STYLE.dropShadow
  const shadowFilter = ck.ImageFilter.MakeDropShadow(
    ds.offsetX, ds.offsetY,
    ds.blur, ds.blur,
    hexToCKColor(ck, ds.color),
    null
  )
  if (shadowFilter) {
    r.fillPaint.setImageFilter(shadowFilter)
  }

  applyRealisticFill(ck, canvas, path, glyphType, w, h, r)

  if (shadowFilter) {
    r.fillPaint.setImageFilter(null)
    shadowFilter.delete()
  }

  paintHighlight(ck, canvas, path, w, h, r)
  paintInnerShadow(ck, canvas, path, w, h, r)
  if (!skipBevel) paintBevelEdges(ck, canvas, w, h, r)
  applyRealisticStroke(ck, canvas, path, glyphType, r)
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
  const cr = w * SBGN_STYLE.macromoleculeCornerRadius
  const path = buildRoundedRectPath(ck, w, h, cr)
  try {
    paintRealisticLayers(ck, canvas, path, data.glyphType, w, h, r)
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
    paintRealisticLayers(ck, canvas, path, data.glyphType, w, h, r)
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
  const path = new ck.Path()
  try {
    path.moveTo(cut, 0)
    path.lineTo(w - cut, 0)
    path.lineTo(w, cut)
    path.lineTo(w, h - cut)
    path.lineTo(w - cut, h)
    path.lineTo(cut, h)
    path.lineTo(0, h - cut)
    path.lineTo(0, cut)
    path.close()
    paintRealisticLayers(ck, canvas, path, data.glyphType, w, h, r)
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
  const path = new ck.Path()
  try {
    path.moveTo(0, 0)
    path.lineTo(w, 0)
    path.lineTo(w, h - br)
    path.quadTo(w, h, w - br, h)
    path.lineTo(br, h)
    path.quadTo(0, h, 0, h - br)
    path.close()
    paintRealisticLayers(ck, canvas, path, data.glyphType, w, h, r)
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
  const path = new ck.Path()
  try {
    path.moveTo(w * 0.25, 0)
    path.lineTo(w * 0.75, 0)
    path.lineTo(w, h * 0.5)
    path.lineTo(w * 0.75, h)
    path.lineTo(w * 0.25, h)
    path.lineTo(0, h * 0.5)
    path.close()
    paintRealisticLayers(ck, canvas, path, data.glyphType, w, h, r, true)
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
  const path = new ck.Path()
  try {
    path.moveTo(0, 0)
    path.lineTo(w, 0)
    path.lineTo(w * 0.85, h * 0.5)
    path.lineTo(w, h)
    path.lineTo(0, h)
    path.lineTo(w * 0.15, h * 0.5)
    path.close()
    paintRealisticLayers(ck, canvas, path, data.glyphType, w, h, r, true)
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
    ds.offsetX, ds.offsetY,
    ds.blur, ds.blur,
    hexToCKColor(ck, ds.color),
    null
  )
  if (shadowFilter) r.fillPaint.setImageFilter(shadowFilter)

  const shader = radialGradientShader(ck, data.glyphType, w, h)
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

  if (shadowFilter) {
    r.fillPaint.setImageFilter(null)
    shadowFilter.delete()
  }

  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, REALISTIC_STYLE.entityBorders.source_sink))
  r.strokePaint.setStrokeWidth(REALISTIC_STYLE.borderWidth)
  canvas.drawCircle(cx, cy, radius, r.strokePaint)

  const cos45 = Math.SQRT1_2
  const sin45 = Math.SQRT1_2
  const rx = w / 2
  const ry = h / 2
  r.strokePaint.setStrokeWidth(REALISTIC_STYLE.borderWidth)
  canvas.drawLine(
    cx - rx * cos45,
    cy + ry * sin45,
    cx + rx * cos45,
    cy - ry * sin45,
    r.strokePaint
  )
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
    ds.offsetX, ds.offsetY,
    ds.blur, ds.blur,
    hexToCKColor(ck, ds.color),
    null
  )
  if (shadowFilter) r.fillPaint.setImageFilter(shadowFilter)

  const shader = radialGradientShader(ck, data.glyphType, w, h)
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

  if (shadowFilter) {
    r.fillPaint.setImageFilter(null)
    shadowFilter.delete()
  }

  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, REALISTIC_STYLE.entityBorders.unspecified_entity))
  r.strokePaint.setStrokeWidth(REALISTIC_STYLE.borderWidth)
  canvas.drawOval(rect, r.strokePaint)
}

const REALISTIC_GLYPH_PAINTERS: Record<PathwayGlyphType, typeof paintRealisticMacromolecule> = {
  macromolecule: paintRealisticMacromolecule,
  simple_chemical: paintRealisticSimpleChemical,
  complex: paintRealisticComplex,
  nucleic_acid_feature: paintRealisticNucleicAcidFeature,
  phenotype: paintRealisticPhenotype,
  perturbation: paintRealisticPerturbation,
  source_sink: paintRealisticSourceSink,
  unspecified_entity: paintRealisticUnspecifiedEntity,
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
  if (painter) {
    painter(ck, canvas, node, data, r)
  } else {
    paintRealisticUnspecifiedEntity(ck, canvas, node, data, r)
  }
}
