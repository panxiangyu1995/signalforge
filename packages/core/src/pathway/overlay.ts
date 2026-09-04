import type { SceneGraph } from '@signal-forge/scene-graph'

import { parseColor } from '#core/color'

export type ColorScaleFn = (value: number) => string

export function blueWhiteRedScale(value: number): string {
  const clamped = Math.max(-1, Math.min(1, value))
  if (clamped < 0) {
    const t = -clamped
    const r = Math.round(255 * (1 - t))
    const g = Math.round(255 * (1 - t))
    const b = 255
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }
  const t = clamped
  const r = 255
  const g = Math.round(255 * (1 - t))
  const b = Math.round(255 * (1 - t))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function applyExpressionOverlay(
  graph: SceneGraph,
  pageId: string,
  data: Map<string, number>,
  colorScale: ColorScaleFn = blueWhiteRedScale
): number {
  const page = graph.getNode(pageId)
  if (!page) return 0

  let updated = 0
  const stack = [...page.childIds]

  while (stack.length > 0) {
    const id = stack.pop()
    if (!id) break
    const node = graph.getNode(id)
    if (!node) continue

    if (node.childIds.length > 0) {
      stack.push(...node.childIds)
    }

    if (node.type !== 'PATHWAY_GLYPH') continue

    const lookupName = node.name
    const value = data.get(lookupName)
    if (value === undefined) continue

    const hexColor = colorScale(value)
    const color = parseColor(hexColor)

    graph.updateNode(node.id, {
      fills: [{ type: 'SOLID', color, opacity: 1, visible: true }]
    })
    updated++
  }

  return updated
}
