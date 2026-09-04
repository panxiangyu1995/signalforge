import {
  updatePathwayData,
  type NodeType,
  type PathwayGlyphType,
  type PathwayArcType
} from '@signal-forge/scene-graph'

import type { EditorContext } from '#core/editor/types'

export function createPathwayGlyphActions(
  ctx: EditorContext,
  createShape: (
    type: NodeType,
    x: number,
    y: number,
    w: number,
    h: number,
    parentId?: string
  ) => string
) {
  let activeGlyphType: PathwayGlyphType = 'macromolecule'

  function setActiveGlyphType(type: PathwayGlyphType): void {
    activeGlyphType = type
  }

  function getActiveGlyphType(): PathwayGlyphType {
    return activeGlyphType
  }

  function createPathwayGlyphNode(
    glyphType: PathwayGlyphType,
    x: number,
    y: number,
    w: number,
    h: number,
    parentId?: string
  ): string {
    const id = createShape('PATHWAY_GLYPH', x, y, w, h, parentId)
    const node = ctx.graph.getNode(id)
    if (node) {
      updatePathwayData(node, { glyphType })
    }
    return id
  }

  return {
    setActiveGlyphType,
    getActiveGlyphType,
    createPathwayGlyphNode
  }
}

export function createPathwayArcActions(ctx: EditorContext) {
  let activeArcType: PathwayArcType = 'production'

  function setActiveArcType(type: PathwayArcType): void {
    activeArcType = type
  }

  function getActiveArcType(): PathwayArcType {
    return activeArcType
  }

  function createPathwayArcNode(
    arcType: PathwayArcType,
    sourceId: string,
    targetId: string
  ): string {
    const node = ctx.graph.createNode('PATHWAY_ARC', ctx.state.currentPageId, {
      name: 'Arc'
    })
    updatePathwayData(node, { arcType, sourceId, targetId })
    return node.id
  }

  return {
    setActiveArcType,
    getActiveArcType,
    createPathwayArcNode
  }
}
