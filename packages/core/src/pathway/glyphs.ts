import type { Canvas, CanvasKit } from 'canvaskit-wasm'

import type { SceneNode } from '@signal-forge/scene-graph'
import type { PathwayNodeData, PathwayGlyphType } from '@signal-forge/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'

import { SBGN_STYLE, PUBLICATION_STYLE, type PathwayStyle } from './constants'
import { hexToCKColor } from './utils'

function glyphFill(ck: CanvasKit, glyphType: PathwayGlyphType | undefined, style: PathwayStyle): Float32Array {
  if (style === 'publication' && glyphType) {
    const fill = PUBLICATION_STYLE.entityFills[glyphType]
    if (fill) return hexToCKColor(ck, fill)
  }
  return hexToCKColor(ck, SBGN_STYLE.nodeBackgroundColor)
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

    r.fillPaint.setStyle(ck.PaintStyle.Fill)
    r.fillPaint.setColor(glyphFill(ck, data.glyphType, style))
    canvas.drawPath(path, r.fillPaint)

    r.strokePaint.setStyle(ck.PaintStyle.Stroke)
    r.strokePaint.setColor(glyphBorder(ck, data.glyphType, style))
    r.strokePaint.setStrokeWidth(glyphBorderWidth(data))
    canvas.drawPath(path, r.strokePaint)
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

    r.fillPaint.setStyle(ck.PaintStyle.Fill)
    r.fillPaint.setColor(glyphFill(ck, data.glyphType, style))
    canvas.drawPath(path, r.fillPaint)

    r.strokePaint.setStyle(ck.PaintStyle.Stroke)
    r.strokePaint.setColor(glyphBorder(ck, data.glyphType, style))
    r.strokePaint.setStrokeWidth(glyphBorderWidth(data))
    canvas.drawPath(path, r.strokePaint)
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

    r.fillPaint.setStyle(ck.PaintStyle.Fill)
    r.fillPaint.setColor(glyphFill(ck, data.glyphType, style))
    canvas.drawPath(path, r.fillPaint)

    r.strokePaint.setStyle(ck.PaintStyle.Stroke)
    r.strokePaint.setColor(glyphBorder(ck, data.glyphType, style))
    r.strokePaint.setStrokeWidth(SBGN_STYLE.entityBorderWidth)
    canvas.drawPath(path, r.strokePaint)
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

    r.fillPaint.setStyle(ck.PaintStyle.Fill)
    r.fillPaint.setColor(glyphFill(ck, data.glyphType, style))
    canvas.drawPath(path, r.fillPaint)

    r.strokePaint.setStyle(ck.PaintStyle.Stroke)
    r.strokePaint.setColor(glyphBorder(ck, data.glyphType, style))
    r.strokePaint.setStrokeWidth(SBGN_STYLE.entityBorderWidth)
    canvas.drawPath(path, r.strokePaint)
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

    r.fillPaint.setStyle(ck.PaintStyle.Fill)
    r.fillPaint.setColor(glyphFill(ck, data.glyphType, style))
    canvas.drawPath(path, r.fillPaint)

    r.strokePaint.setStyle(ck.PaintStyle.Stroke)
    r.strokePaint.setColor(glyphBorder(ck, data.glyphType, style))
    r.strokePaint.setStrokeWidth(SBGN_STYLE.entityBorderWidth)
    canvas.drawPath(path, r.strokePaint)
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

    r.fillPaint.setStyle(ck.PaintStyle.Fill)
    r.fillPaint.setColor(glyphFill(ck, data.glyphType, style))
    canvas.drawPath(path, r.fillPaint)

    r.strokePaint.setStyle(ck.PaintStyle.Stroke)
    r.strokePaint.setColor(glyphBorder(ck, data.glyphType, style))
    r.strokePaint.setStrokeWidth(SBGN_STYLE.entityBorderWidth)
    canvas.drawPath(path, r.strokePaint)
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

  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, SBGN_STYLE.sourceSinkStroke))
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

  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.fillPaint.setColor(glyphFill(ck, data.glyphType, style))
  canvas.drawOval(ck.LTRBRect(0, 0, w, h), r.fillPaint)

  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(glyphBorder(ck, data.glyphType, style))
  r.strokePaint.setStrokeWidth(SBGN_STYLE.entityBorderWidth)
  canvas.drawOval(ck.LTRBRect(0, 0, w, h), r.strokePaint)
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
