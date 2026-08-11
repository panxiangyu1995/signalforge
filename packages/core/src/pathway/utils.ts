import type { SceneGraph, SceneNode } from '@signal-forge/scene-graph'
import type { Canvas, CanvasKit } from 'canvaskit-wasm'

import { parseColor } from '#core/color'

import type { SkiaRenderer } from '#core/canvas/renderer'

export function hexToCKColor(ck: CanvasKit, hex: string): Float32Array {
  const c = parseColor(hex)
  return ck.Color4f(c.r, c.g, c.b, c.a)
}

export function collectPathwayArcs(graph: SceneGraph, pageId: string): SceneNode[] {
  const arcs: SceneNode[] = []
  const page = graph.getNode(pageId)
  if (!page) return arcs

  const stack = [...page.childIds]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    const node = graph.getNode(current)
    if (!node) continue
    if (node.type === 'PATHWAY_ARC') arcs.push(node)
    stack.push(...node.childIds)
  }
  return arcs
}

export function paintProcessSymbol(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  symbol: string,
  r: SkiaRenderer
): void {
  const font = r.sectionTitleFont
  if (!font) return

  const glyphs = font.getGlyphIDs(symbol)
  const widths = font.getGlyphWidths(glyphs)
  let textW = 0
  for (const w of widths) textW += w

  const textX = (node.width - textW) / 2
  const textY = node.height / 2 + (textW > 0 ? textW * 0.35 : 0)

  r.auxFill.setColor(ck.Color4f(0x55 / 255, 0x55 / 255, 0x55 / 255, 1))
  canvas.drawText(symbol, textX, textY, r.auxFill, font)
}

export function buildRoundedRectPath(ck: CanvasKit, w: number, h: number, cr: number): InstanceType<CanvasKit['Path']> {
  const path = new ck.Path()
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
  return path
}
