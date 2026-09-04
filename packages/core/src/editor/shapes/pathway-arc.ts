import { updatePathwayData, type PathwayArcType } from '@signal-forge/scene-graph'

import type { EditorContext } from '#core/editor/types'

export function createPathwayArcInteraction(ctx: EditorContext) {
  let isDragging = false
  let sourceId: string | null = null
  let previewLine: { x1: number; y1: number; x2: number; y2: number } | null = null

  function startArcFromNode(nodeId: string): void {
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    if (node.type !== 'PATHWAY_GLYPH' && node.type !== 'PATHWAY_PROCESS') return

    isDragging = true
    sourceId = nodeId
    previewLine = {
      x1: node.x + node.width / 2,
      y1: node.y + node.height / 2,
      x2: node.x + node.width / 2,
      y2: node.y + node.height / 2
    }
  }

  function updatePreview(x: number, y: number): void {
    if (!isDragging || !previewLine) return
    previewLine.x2 = x
    previewLine.y2 = y
  }

  function completeArc(targetId: string, arcType: PathwayArcType): string | null {
    if (!isDragging || !sourceId) return null

    const target = ctx.graph.getNode(targetId)
    if (!target) return null
    if (target.type !== 'PATHWAY_GLYPH' && target.type !== 'PATHWAY_PROCESS') return null
    if (targetId === sourceId) return null

    const node = ctx.graph.createNode('PATHWAY_ARC', ctx.state.currentPageId, {
      name: 'Arc'
    })
    updatePathwayData(node, { arcType, sourceId, targetId })

    reset()
    return node.id
  }

  function cancel(): void {
    reset()
  }

  function reset(): void {
    isDragging = false
    sourceId = null
    previewLine = null
  }

  return {
    startArcFromNode,
    updatePreview,
    completeArc,
    cancel,
    get isDragging() {
      return isDragging
    },
    get sourceId() {
      return sourceId
    },
    get previewLine() {
      return previewLine
    }
  }
}
