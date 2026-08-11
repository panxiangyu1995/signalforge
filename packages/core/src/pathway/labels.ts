import type { Canvas, CanvasKit, Font, Path } from 'canvaskit-wasm'

import type { SceneNode, PathwayNodeData } from '@signal-forge/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'

import { SBGN_STYLE, REALISTIC_STYLE } from './constants'
import { buildRoundedRectPath } from './utils'

const GLYPH_LABEL_FONT_SIZE = SBGN_STYLE.nodeFontSize
const COMPARTMENT_LABEL_FONT_SIZE = SBGN_STYLE.nodeFontSize + 2

export function paintPathwayLabel(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  r: SkiaRenderer
): void {
  if (!node.name) return
  const font = r.sectionTitleFont
  if (!font) return

  const paddingX = 8
  const maxW = node.width - paddingX * 2
  if (maxW < 10) return

  const displayText = ellipsizeText(font, node.name, maxW)
  if (!displayText) return

  const textW = measureTextWidth(font, displayText)

  const textX = (node.width - textW) / 2
  const textY = node.height / 2 + GLYPH_LABEL_FONT_SIZE * 0.35

  if (r.pathwayStyle === 'realistic') {
    const outlineW = REALISTIC_STYLE.textOutline.width
    r.auxStroke.setStyle(ck.PaintStyle.Stroke)
    r.auxStroke.setColor(ck.Color4f(1, 1, 1, 0.85))
    r.auxStroke.setStrokeWidth(outlineW * 2)
    canvas.drawText(displayText, textX, textY, r.auxStroke, font)
    r.auxStroke.setStrokeWidth(1)
  }

  r.auxFill.setColor(ck.Color4f(0, 0, 0, 1))
  canvas.drawText(displayText, textX, textY, r.auxFill, font)
}

export function paintCompartmentLabel(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  r: SkiaRenderer
): void {
  if (!node.name) return
  const font = r.sectionTitleFont
  if (!font) return

  const padding = SBGN_STYLE.compartmentPadding
  const maxW = node.width - padding * 2
  if (maxW < 10) return

  const displayText = ellipsizeText(font, node.name, maxW)
  if (!displayText) return

  const textX = padding
  const textY = padding * 0.5 + COMPARTMENT_LABEL_FONT_SIZE * 0.85

  r.auxFill.setColor(ck.Color4f(0.2, 0.2, 0.2, 1))
  canvas.drawText(displayText, textX, textY, r.auxFill, font)
}

export function paintStateVariables(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  r: SkiaRenderer
): void {
  if (!data.stateVariables || data.stateVariables.length === 0) return
  const font = r.sectionTitleFont
  if (!font) return

  const badgeH = 16
  const badgeGap = 2
  const badgeOffsetY = 2
  const minBadgeW = 28

  const widths: number[] = []
  let totalW = 0

  for (const sv of data.stateVariables) {
    const label = sv.value ? `${sv.variable}@${sv.value}` : sv.variable
    const textW = measureTextWidth(font, label)
    const w = Math.max(minBadgeW, textW + 8)
    widths.push(w)
    totalW += w
  }

  totalW += (data.stateVariables.length - 1) * badgeGap

  let x = (node.width - totalW) / 2
  const y = -badgeH - badgeOffsetY

  for (let i = 0; i < data.stateVariables.length; i++) {
    const sv = data.stateVariables[i]
    const label = sv.value ? `${sv.variable}@${sv.value}` : sv.variable
    const w = widths[i]
    const cr = Math.min(w / 2, badgeH / 2)

    const path = buildRoundedRectPath(ck, w, badgeH, cr)
    try {
      r.auxFill.setColor(ck.Color4f(1, 1, 1, 1))
      r.auxFill.setStyle(ck.PaintStyle.Fill)
      canvas.drawPath(path, r.auxFill)

      r.auxStroke.setColor(ck.Color4f(0x55 / 255, 0x55 / 255, 0x55 / 255, 1))
      r.auxStroke.setStyle(ck.PaintStyle.Stroke)
      r.auxStroke.setStrokeWidth(SBGN_STYLE.infoboxBorderWidth)
      canvas.drawPath(path, r.auxStroke)
    } finally {
      path.delete()
    }

    const textW = measureTextWidth(font, label)

    const textX = x + (w - textW) / 2
    const textY = y + badgeH / 2 + SBGN_STYLE.infoboxFontSize * 0.35

    r.auxFill.setColor(ck.Color4f(0, 0, 0, 1))
    canvas.drawText(label, textX, textY, r.auxFill, font)

    x += w + badgeGap
  }
}

export function paintCloneMarker(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  r: SkiaRenderer
): void {
  if (!data.cloneMarker) return

  const w = node.width
  const h = node.height
  const bandH = h * 0.25
  const bandY = h - bandH

  canvas.save()

  const clipPath = buildGlyphClipPath(ck, node, data)
  if (clipPath) {
    try {
      canvas.clipPath(clipPath, ck.ClipOp.Intersect, true)
    } finally {
      clipPath.delete()
    }
  }

  r.auxFill.setStyle(ck.PaintStyle.Fill)
  r.auxFill.setColor(ck.Color4f(
    0x83 / 255, 0x83 / 255, 0x83 / 255, 1
  ))
  canvas.drawRect(ck.LTRBRect(0, bandY, w, h), r.auxFill)

  canvas.restore()
}

function buildGlyphClipPath(
  ck: CanvasKit,
  node: SceneNode,
  data: PathwayNodeData
): Path | null {
  const w = node.width
  const h = node.height
  const glyphType = data.glyphType

  if (glyphType === 'macromolecule' || glyphType === 'simple_chemical') {
    const cr = glyphType === 'simple_chemical'
      ? Math.min(w / 2, h / 2)
      : w * SBGN_STYLE.macromoleculeCornerRadius
    return buildRoundedRectPath(ck, w, h, cr)
  }

  if (glyphType === 'complex') {
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
      return path
    } catch (e) {
      path.delete()
      throw e
    }
  }

  if (glyphType === 'nucleic_acid_feature') {
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
      return path
    } catch (e) {
      path.delete()
      throw e
    }
  }

  return null
}

export function paintUnitOfInformation(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  r: SkiaRenderer
): void {
  if (!data.unitOfInformation || data.unitOfInformation.length === 0) return
  const font = r.sectionTitleFont
  if (!font) return

  const badgeH = 16
  const badgeGap = 2
  const badgeOffsetY = 2
  const minBadgeW = 28
  const svBadgeH = (data.stateVariables && data.stateVariables.length > 0) ? badgeH + badgeOffsetY : 0

  const widths: number[] = []
  let totalW = 0

  for (const ui of data.unitOfInformation) {
    const textW = measureTextWidth(font, ui.text)
    const w = Math.max(minBadgeW, textW + 8)
    widths.push(w)
    totalW += w
  }

  totalW += (data.unitOfInformation.length - 1) * badgeGap

  let x = (node.width - totalW) / 2
  const y = -badgeH - badgeOffsetY - svBadgeH

  for (let i = 0; i < data.unitOfInformation.length; i++) {
    const ui = data.unitOfInformation[i]
    const label = ui.text
    const w = widths[i]
    const cr = Math.min(w / 2, badgeH / 2)

    const path = buildRoundedRectPath(ck, w, badgeH, cr)
    try {
      r.auxFill.setColor(ck.Color4f(1, 1, 1, 1))
      r.auxFill.setStyle(ck.PaintStyle.Fill)
      canvas.drawPath(path, r.auxFill)

      r.auxStroke.setColor(ck.Color4f(0x55 / 255, 0x55 / 255, 0x55 / 255, 1))
      r.auxStroke.setStyle(ck.PaintStyle.Stroke)
      r.auxStroke.setStrokeWidth(SBGN_STYLE.infoboxBorderWidth)
      canvas.drawPath(path, r.auxStroke)
    } finally {
      path.delete()
    }

    const textW = measureTextWidth(font, label)
    const textX = x + (w - textW) / 2
    const textY = y + badgeH / 2 + SBGN_STYLE.infoboxFontSize * 0.35

    r.auxFill.setColor(ck.Color4f(0, 0, 0, 1))
    canvas.drawText(label, textX, textY, r.auxFill, font)

    x += w + badgeGap
  }
}

function ellipsizeText(font: Font, text: string, maxWidth: number): string {
  if (!text) return ''
  const totalW = measureTextWidth(font, text)
  if (totalW <= maxWidth) return text

  const ellipsis = '…'
  const ellW = measureTextWidth(font, ellipsis)

  const glyphs = font.getGlyphIDs(text)
  const widths = font.getGlyphWidths(glyphs)

  let cumW = 0
  let cutAt = 0
  for (let i = 0; i < widths.length; i++) {
    cumW += widths[i]
    if (cumW + ellW > maxWidth) {
      cutAt = i
      break
    }
    cutAt = i + 1
  }

  if (cutAt <= 0) return ''
  return text.slice(0, cutAt) + ellipsis
}

function measureTextWidth(font: Font, text: string): number {
  const glyphs = font.getGlyphIDs(text)
  const widths = font.getGlyphWidths(glyphs)
  let total = 0
  for (const w of widths) total += w
  return total
}
