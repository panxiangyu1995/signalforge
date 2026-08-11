import type { Canvas, CanvasKit, ImageFilter } from 'canvaskit-wasm'

import { type SceneNode, type SceneGraph, type Vector, getPathwayData, type PathwayNodeData } from '@signal-forge/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'

import { paintPathwayGlyph } from './glyphs'
import { paintPathwayProcess } from './processes'
import { paintPathwayArc } from './arcs'
import { paintPathwayLabel, paintCompartmentLabel, paintStateVariables, paintCloneMarker, paintUnitOfInformation } from './labels'
import { SBGN_STYLE, PUBLICATION_STYLE, REALISTIC_STYLE, type PathwayStyle } from './constants'
import { hexToCKColor } from './utils'
import { inferMembraneType, paintMembraneLine } from './membrane'

const MULTIMER_OFFSETS: Record<string, Vector> = {
  macromolecule: { x: 12, y: 12 },
  simple_chemical: { x: 5, y: 5 },
  complex: { x: 16, y: 16 },
  nucleic_acid_feature: { x: 12, y: 12 },
  phenotype: { x: 8, y: 8 },
  perturbation: { x: 8, y: 8 },
  source_sink: { x: 5, y: 5 },
  unspecified_entity: { x: 8, y: 8 },
}

export type CompartmentType =
  | 'extracellular' | 'membrane' | 'cytoplasm' | 'nucleus'
  | 'mitochondria' | 'endoplasmic_reticulum' | 'golgi' | 'default'

export function inferCompartmentType(name: string): CompartmentType {
  const lower = name.toLowerCase()
  if (lower.includes('extracellul')) return 'extracellular'
  if (lower.includes('nuclear') || lower.includes('nucleus')) return 'nucleus'
  if (lower.includes('mitochondr')) return 'mitochondria'
  if (lower.includes('endoplasm') || lower === 'er') return 'endoplasmic_reticulum'
  if (lower.includes('golgi')) return 'golgi'
  if (lower.includes('membrane') || lower.includes('plasma')) return 'membrane'
  if (lower.includes('cytoplasm') || lower.includes('cytosol')) return 'cytoplasm'
  return 'default'
}

function applyDropShadow(
  ck: CanvasKit,
  r: SkiaRenderer,
  spec: { readonly offsetX: number; readonly offsetY: number; readonly blur: number; readonly color: string }
): ImageFilter {
  const color = hexToCKColor(ck, spec.color)
  const filter = ck.ImageFilter.MakeDropShadow(
    spec.offsetX, spec.offsetY,
    spec.blur, spec.blur,
    color,
    null
  )
  r.fillPaint.setImageFilter(filter)
  return filter
}

function clearDropShadow(r: SkiaRenderer): void {
  r.fillPaint.setImageFilter(null)
}

export function renderPathwayGlyph(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode
): void {
  const data = getPathwayData(node)
  if (!data) return

  const style: PathwayStyle = r.pathwayStyle
  const ck = r.ck

  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)

  if (data.multimer) {
    const offset = MULTIMER_OFFSETS[data.glyphType ?? 'unspecified_entity'] ?? { x: 8, y: 8 }
    canvas.save()
    canvas.translate(offset.x, offset.y)
    let multimerFilter: ImageFilter | null = null
    if (style === 'publication') {
      multimerFilter = applyDropShadow(ck, r, PUBLICATION_STYLE.dropShadow)
    }
    paintPathwayGlyph(ck, canvas, node, data, style, r)
    if (multimerFilter) {
      clearDropShadow(r)
      multimerFilter.delete()
    }
    canvas.restore()
  }

  paintPathwayGlyph(ck, canvas, node, data, style, r)

  if (data.activeState) {
    paintActiveStateBorder(ck, canvas, node, data, r)
  }

  if (data.cloneMarker) {
    paintCloneMarker(ck, canvas, node, data, r)
  }

  paintPathwayLabel(ck, canvas, node, data, r)

  paintStateVariables(ck, canvas, node, data, r)

  if (data.unitOfInformation && data.unitOfInformation.length > 0) {
    paintUnitOfInformation(ck, canvas, node, data, r)
  }
}

function paintActiveStateBorder(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  r: SkiaRenderer
): void {
  const pad = SBGN_STYLE.activePadding
  const expandedNode: SceneNode = {
    ...node,
    x: node.x - pad,
    y: node.y - pad,
    width: node.width + pad * 2,
    height: node.height + pad * 2
  }
  const expandedData: PathwayNodeData = { ...data, stateVariables: undefined, activeState: undefined }
  canvas.save()
  canvas.translate(-pad, -pad)

  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, SBGN_STYLE.nodeBorderColor))
  r.strokePaint.setStrokeWidth(SBGN_STYLE.defaultBorderWidth)
  const dashEffect = ck.PathEffect.MakeDash([...SBGN_STYLE.activeDashPattern], 0)
  if (dashEffect) {
    r.strokePaint.setPathEffect(dashEffect)
  }
  paintPathwayGlyph(ck, canvas, expandedNode, expandedData, 'sbgn', r)
  r.strokePaint.setPathEffect(null)
  if (dashEffect) dashEffect.delete()
  canvas.restore()
}

export function renderPathwayProcess(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode
): void {
  const data = getPathwayData(node)
  if (!data) return

  const style: PathwayStyle = r.pathwayStyle
  const ck = r.ck

  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)

  paintPathwayProcess(ck, canvas, node, data, style, r)

  if (node.name) {
    paintPathwayLabel(ck, canvas, node, data, r)
  }
}

export function renderPathwayArc(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  const data = getPathwayData(node)
  if (!data) return

  const style: PathwayStyle = r.pathwayStyle
  const ck = r.ck
  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)

  paintPathwayArc(ck, canvas, node, data, graph, style, r)
}

export function renderCompartment(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode
): void {
  const style: PathwayStyle = r.pathwayStyle
  const ck = r.ck
  const w = node.width
  const h = node.height

  const path = new ck.Path()
  try {
    path.moveTo(0, h * 0.03)
    path.lineTo(0, h * 0.97)
    path.quadTo(w * 0.06, h, w * 0.25, h)
    path.lineTo(w * 0.75, h)
    path.quadTo(w * 0.95, h, w, h * 0.95)
    path.lineTo(w, h * 0.05)
    path.quadTo(w, 0, w * 0.75, 0)
    path.lineTo(w * 0.25, 0)
    path.quadTo(w * 0.06, 0, 0, h * 0.03)
    path.close()

    r.fillPaint.setStyle(ck.PaintStyle.Fill)

    if (style === 'realistic') {
      const compType = inferCompartmentType(node.name)
      const grad = REALISTIC_STYLE.compartmentGradients[compType]
      let filled = false
      if (grad) {
        const shader = ck.Shader.MakeLinearGradient(
          [0, 0], [0, h],
          [hexToCKColor(ck, grad.top), hexToCKColor(ck, grad.bottom)],
          [0, 1],
          ck.TileMode.Clamp
        )
        if (shader) {
          r.fillPaint.setShader(shader)
          canvas.drawPath(path, r.fillPaint)
          r.fillPaint.setShader(null)
          shader.delete()
          filled = true
        }
      }
      if (!filled) {
        r.fillPaint.setColor(hexToCKColor(ck, 'rgba(0, 0, 0, 0.05)'))
        canvas.drawPath(path, r.fillPaint)
      }

      const cs = REALISTIC_STYLE.compartmentShadow
      const compShadow = ck.ImageFilter.MakeDropShadow(
        cs.offsetX, cs.offsetY,
        cs.blur, cs.blur,
        hexToCKColor(ck, cs.color),
        null
      )
      r.strokePaint.setStyle(ck.PaintStyle.Stroke)
      r.strokePaint.setColor(hexToCKColor(ck, '#777'))
      r.strokePaint.setStrokeWidth(2)
      r.strokePaint.setImageFilter(compShadow)
      canvas.drawPath(path, r.strokePaint)
      r.strokePaint.setImageFilter(null)
      if (compShadow) compShadow.delete()
    } else if (style === 'publication') {
      const compType = inferCompartmentType(node.name)
      const grad = PUBLICATION_STYLE.compartmentGradients[compType]
      if (grad) {
        const shader = ck.Shader.MakeLinearGradient(
          [0, 0], [0, h],
          [hexToCKColor(ck, grad.top), hexToCKColor(ck, grad.bottom)],
          [0, 1],
          ck.TileMode.Clamp
        )
        if (shader) {
          r.fillPaint.setShader(shader)
          canvas.drawPath(path, r.fillPaint)
          r.fillPaint.setShader(null)
          shader.delete()
        } else {
          r.fillPaint.setColor(hexToCKColor(ck, PUBLICATION_STYLE.compartmentFills[compType] ?? PUBLICATION_STYLE.compartmentFills.default))
          canvas.drawPath(path, r.fillPaint)
        }
      } else {
        const fillColor = hexToCKColor(ck, PUBLICATION_STYLE.compartmentFills[compType] ?? PUBLICATION_STYLE.compartmentFills.default)
        r.fillPaint.setColor(fillColor)
        canvas.drawPath(path, r.fillPaint)
      }

      const compShadow = ck.ImageFilter.MakeDropShadow(
        PUBLICATION_STYLE.compartmentShadow.offsetX,
        PUBLICATION_STYLE.compartmentShadow.offsetY,
        PUBLICATION_STYLE.compartmentShadow.blur,
        PUBLICATION_STYLE.compartmentShadow.blur,
        hexToCKColor(ck, PUBLICATION_STYLE.compartmentShadow.color),
        null
      )
      r.strokePaint.setStyle(ck.PaintStyle.Stroke)
      r.strokePaint.setColor(hexToCKColor(ck, '#888'))
      r.strokePaint.setStrokeWidth(1.5)
      r.strokePaint.setImageFilter(compShadow)
      canvas.drawPath(path, r.strokePaint)
      r.strokePaint.setImageFilter(null)
      compShadow.delete()
    } else {
      const fillColor = hexToCKColor(ck, SBGN_STYLE.nodeBackgroundColor)
      r.fillPaint.setColor(fillColor)
      r.fillPaint.setAlphaf(0.15)
      canvas.drawPath(path, r.fillPaint)
      r.fillPaint.setAlphaf(1)

      r.strokePaint.setColor(hexToCKColor(ck, SBGN_STYLE.nodeBorderColor))
      r.strokePaint.setStrokeWidth(SBGN_STYLE.compartmentBorderWidth)
      r.strokePaint.setStyle(ck.PaintStyle.Stroke)
      canvas.drawPath(path, r.strokePaint)
    }
  } finally {
    path.delete()
  }

  paintCompartmentLabel(ck, canvas, node, r)

  if (style === 'publication') {
    const membraneType = inferMembraneType(node.name)
    if (membraneType) {
      canvas.save()
      canvas.translate(node.width * 0.05, 0)
      paintMembraneLine(ck, canvas, node, membraneType, r)
      canvas.restore()
    }
  }
}
