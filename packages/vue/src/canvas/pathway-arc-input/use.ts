import type { Editor } from '@signal-forge/core/editor'
import { updatePathwayData } from '@signal-forge/scene-graph'

import type { HitTestFns } from '#vue/shared/input/select'
import type { DragPathwayArc, DragState } from '#vue/shared/input/types'

const PATHWAY_NODE_TYPES = new Set(['PATHWAY_GLYPH', 'PATHWAY_PROCESS', 'COMPARTMENT'])

export function startPathwayArcInput(
  cx: number,
  cy: number,
  hitFns: HitTestFns,
  setDrag: (d: DragState) => void
) {
  const hit = hitFns.hitTestInScope(cx, cy, false)
  if (!hit || !PATHWAY_NODE_TYPES.has(hit.type)) return

  setDrag({
    type: 'pathway-arc',
    sourceId: hit.id,
    sourceX: cx,
    sourceY: cy,
    currentX: cx,
    currentY: cy
  })
}

export function handlePathwayArcMove(d: DragPathwayArc, cx: number, cy: number) {
  d.currentX = cx
  d.currentY = cy
}

export function handlePathwayArcUp(d: DragPathwayArc, editor: Editor, hitFns: HitTestFns) {
  const hit = hitFns.hitTestInScope(d.currentX, d.currentY, false)
  if (!hit || hit.id === d.sourceId || !PATHWAY_NODE_TYPES.has(hit.type)) {
    editor.setTool('SELECT')
    return
  }

  const source = editor.graph.getNode(d.sourceId)
  if (!source) {
    editor.setTool('SELECT')
    return
  }

  const sx = source.x + source.width / 2
  const sy = source.y + source.height / 2
  const tx = hit.x + hit.width / 2
  const ty = hit.y + hit.height / 2

  const arcId = editor.createShape('PATHWAY_ARC', sx, sy, 0, 0)

  editor.graph.updateNode(arcId, {
    width: Math.abs(tx - sx),
    height: Math.abs(ty - sy)
  })

  const arcNode = editor.graph.getNode(arcId)
  if (arcNode) {
    updatePathwayData(arcNode, {
      arcType: 'consumption',
      sourceId: d.sourceId,
      targetId: hit.id
    })
  }

  editor.select([arcId])
  editor.setTool('SELECT')
}
