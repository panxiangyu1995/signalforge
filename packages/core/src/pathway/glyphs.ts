import type { Canvas, CanvasKit, Shader } from 'canvaskit-wasm'

import type { SceneNode } from '@signal-forge/scene-graph'
import type { PathwayNodeData, PathwayGlyphType } from '@signal-forge/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'

import { SBGN_STYLE, PUBLICATION_STYLE, type PathwayStyle } from './constants'
import { hexToCKColor } from './utils'

function glyphFillColor(
  ck: CanvasKit,
  glyphType: PathwayGlyphType | undefined,
  style: PathwayStyle
): Float32Array {
  if (style === 'publication' && glyphType) {
    const fill = PUBLICATION_STYLE.entityFills[glyphType]
    if (fill) return hexToCKColor(ck, fill)
  }
  return hexToCKColor(ck, SBGN_STYLE.nodeBackgroundColor)
}

function glyphGradientShader(
  ck: CanvasKit,
  glyphType: PathwayGlyphType | undefined,
  style: PathwayStyle,
  nodeHeight: number
): Shader | null {
  if (style !== 'publication' || !glyphType) return null
  const grad = PUBLICATION_STYLE.entityGradients[glyphType]
  if (!grad) return null
  return ck.Shader.MakeLinearGradient(
    [0, 0], [0, nodeHeight],
    [hexToCKColor(ck, grad.top), hexToCKColor(ck, grad.bottom)],
    [0, 1],
    ck.TileMode.Clamp
  )
}

function glyphBorder(ck: CanvasKit, glyphType: PathwayGlyphType | undefined, style: PathwayStyle): Float32Array {
  if (style === 'publication' && glyphType) {
    const border = PUBLICATION_STYLE.entityBorders[glyphType]
    if (border) return hexToCKColor(ck, border)
  }
  return hexToCKColor(ck, SBGN_STYLE.nodeBorderColor)
}

function glyphBorderWidth(data: PathwayNodeData): number {
  if (data.glyphType === 'complex') return SBGN_STYLE.complexBorderWidth
  if (data.stateVariables && data.stateVariables.length > 0) return SBGN_STYLE.entityBorderWidth
  return SBGN_STYLE.defaultBorderWidth
}

function applyGlyphFill(
  ck: CanvasKit,
  canvas: Canvas,
  path: InstanceType<CanvasKit['Path']>,
  glyphType: PathwayGlyphType | undefined,
  style: PathwayStyle,
  nodeHeight: number,
  r: SkiaRenderer
): void {
  const shader = glyphGradientShader(ck, glyphType, style, nodeHeight)
  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  if (shader) {
    r.fillPaint.setShader(shader)
    canvas.drawPath(path, r.fillPaint)
    r.fillPaint.setShader(null)
    shader.delete()
  } else {
    r.fillPaint.setColor(glyphFillColor(ck, glyphType, style))
    canvas.drawPath(path, r.fillPaint)
  }
}

function applyGlyphStroke(
  ck: CanvasKit,
  canvas: Canvas,
  path: InstanceType<CanvasKit['Path']>,
  glyphType: PathwayGlyphType | undefined,
  style: PathwayStyle,
  borderWidth: number,
  r: SkiaRenderer
): void {
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(glyphBorder(ck, glyphType, style))
  r.strokePaint.setStrokeWidth(borderWidth)
  canvas.drawPath(path, r.strokePaint)
}

export function paintMacromolecule(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  style: PathwayStyle,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height
  if (w <= 0 || h <= 0) return
  const cr = Math.min(w, h) * 0.12

  const path = new ck.Path()
  try {
    path.moveTo(cr, 0)
    path.lineTo(w - cr, 0)
    path.quadTo(w, 0, w, cr)
    path.lineTo(w, h - cr)
    path.quadTo(w, h, w - cr, h)
    path.lineTo(cr, h)
    path.quadTo(0, h, 0, h - cr)
    path.lineTo(0, cr)
    path.quadTo(0, 0, cr, 0)
    path.close()

    applyGlyphFill(ck, canvas, path, data.glyphType, style, h, r)
    applyGlyphStroke(ck, canvas, path, data.glyphType, style, glyphBorderWidth(data), r)
  } finally {
    path.delete()
  }
}

export function paintSimpleChemical(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  style: PathwayStyle,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height
  if (w <= 0 || h <= 0) return
  const cr = Math.min(w / 2, h / 2)

  const path = new ck.Path()
  try {
    path.moveTo(cr, 0)
    path.lineTo(w - cr, 0)
    path.quadTo(w, 0, w, cr)
    path.lineTo(w, h - cr)
    path.quadTo(w, h, w - cr, h)
    path.lineTo(cr, h)
    path.quadTo(0, h, 0, h - cr)
    path.lineTo(0, cr)
    path.quadTo(0, 0, cr, 0)
    path.close()

    applyGlyphFill(ck, canvas, path, data.glyphType, style, h, r)
    applyGlyphStroke(ck, canvas, path, data.glyphType, style, glyphBorderWidth(data), r)
  } finally {
    path.delete()
  }
}

export function paintComplex(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  style: PathwayStyle,
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

    applyGlyphFill(ck, canvas, path, data.glyphType, style, h, r)
    applyGlyphStroke(ck, canvas, path, data.glyphType, style, SBGN_STYLE.entityBorderWidth, r)
  } finally {
    path.delete()
  }
}


export function paintNucleicAcidFeature(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  style: PathwayStyle,
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

    applyGlyphFill(ck, canvas, path, data.glyphType, style, h, r)
    applyGlyphStroke(ck, canvas, path, data.glyphType, style, SBGN_STYLE.entityBorderWidth, r)
  } finally {
    path.delete()
  }
}

export function paintPhenotype(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  style: PathwayStyle,
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

    applyGlyphFill(ck, canvas, path, data.glyphType, style, h, r)
    applyGlyphStroke(ck, canvas, path, data.glyphType, style, SBGN_STYLE.entityBorderWidth, r)
  } finally {
    path.delete()
  }
}

export function paintPerturbation(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  style: PathwayStyle,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height

  const path = new ck.Path()
  try {
    path.moveTo(0, 0)
    path.lineTo(w * 0.25, h * 0.5)
    path.lineTo(0, h)
    path.lineTo(w, h)
    path.lineTo(w * 0.75, h * 0.5)
    path.lineTo(w, 0)
    path.close()

    applyGlyphFill(ck, canvas, path, data.glyphType, style, h, r)
    applyGlyphStroke(ck, canvas, path, data.glyphType, style, SBGN_STYLE.entityBorderWidth, r)
  } finally {
    path.delete()
  }
}

export function paintSourceSink(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  style: PathwayStyle,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height
  const radius = Math.min(w, h) / 2
  const cx = w / 2
  const cy = h / 2

  if (style === 'publication') {
    const shader = glyphGradientShader(ck, data.glyphType, style, h)
    if (shader) {
      r.fillPaint.setStyle(ck.PaintStyle.Fill)
      r.fillPaint.setShader(shader)
      canvas.drawCircle(cx, cy, radius, r.fillPaint)
      r.fillPaint.setShader(null)
      shader.delete()
    } else {
      r.fillPaint.setStyle(ck.PaintStyle.Fill)
      r.fillPaint.setColor(glyphFillColor(ck, data.glyphType, style))
      canvas.drawCircle(cx, cy, radius, r.fillPaint)
    }
  } else {
    r.fillPaint.setStyle(ck.PaintStyle.Fill)
    r.fillPaint.setColor(glyphFillColor(ck, data.glyphType, style))
    canvas.drawCircle(cx, cy, radius, r.fillPaint)
  }

  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(style === 'publication'
    ? glyphBorder(ck, data.glyphType, style)
    : hexToCKColor(ck, SBGN_STYLE.sourceSinkStroke))
  r.strokePaint.setStrokeWidth(SBGN_STYLE.defaultBorderWidth)

  canvas.drawCircle(cx, cy, radius, r.strokePaint)

  const cos45 = Math.SQRT1_2
  const sin45 = Math.SQRT1_2
  const rx = w / 2
  const ry = h / 2
  canvas.drawLine(
    cx - rx * cos45,
    cy + ry * sin45,
    cx + rx * cos45,
    cy - ry * sin45,
    r.strokePaint
  )
}

export function paintUnspecifiedEntity(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  style: PathwayStyle,
  r: SkiaRenderer
): void {
  const w = node.width
  const h = node.height
  const rect = ck.LTRBRect(0, 0, w, h)

  const shader = glyphGradientShader(ck, data.glyphType, style, h)
  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  if (shader) {
    r.fillPaint.setShader(shader)
    canvas.drawOval(rect, r.fillPaint)
    r.fillPaint.setShader(null)
    shader.delete()
  } else {
    r.fillPaint.setColor(glyphFillColor(ck, data.glyphType, style))
    canvas.drawOval(rect, r.fillPaint)
  }

  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(glyphBorder(ck, data.glyphType, style))
  r.strokePaint.setStrokeWidth(SBGN_STYLE.entityBorderWidth)
  canvas.drawOval(rect, r.strokePaint)
}

const GLYPH_PAINTERS: Record<PathwayGlyphType, typeof paintMacromolecule> = {
  macromolecule: paintMacromolecule,
  simple_chemical: paintSimpleChemical,
  complex: paintComplex,
  nucleic_acid_feature: paintNucleicAcidFeature,
  phenotype: paintPhenotype,
  perturbation: paintPerturbation,
  source_sink: paintSourceSink,
  unspecified_entity: paintUnspecifiedEntity,
}

export function paintPathwayGlyph(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  style: PathwayStyle,
  r: SkiaRenderer
): void {
  const glyphType = data.glyphType
  if (!glyphType) {
    paintUnspecifiedEntity(ck, canvas, node, data, style, r)
    return
  }
  const painter = GLYPH_PAINTERS[glyphType]
  if (painter) {
    painter(ck, canvas, node, data, style, r)
  } else {
    paintUnspecifiedEntity(ck, canvas, node, data, style, r)
    console.warn(`[pathway] Unknown glyph type "${glyphType}", rendering as unspecified_entity`)
  }
}
