import { type SceneGraph, type SceneNode } from '@signal-forge/scene-graph'
import { copyFills } from '@signal-forge/scene-graph/copy'
import { computeBounds } from '@signal-forge/scene-graph/geometry'
import type { Rect } from '@signal-forge/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas'
import { canMakeBooleanSourceNode } from '#core/canvas/boolean'
import { flattenNodesToVectorProps } from '#core/canvas/flatten'
import type { BooleanOperation } from '#core/editor/structure/boolean'

export function createBooleanOperationNode(
  graph: SceneGraph,
  operation: BooleanOperation,
  nodeIds: string[],
  parentId: string,
  index?: number
): SceneNode {
  if (nodeIds.length < 2) throw new Error('Need at least 2 nodes for boolean operation')
  const first = graph.getNode(nodeIds[0])
  if (!first) throw new Error('Node not found')
  const group = graph.createNode('BOOLEAN_OPERATION', parentId, {
    name: `Boolean ${operation.toLowerCase()}`,
    x: first.x,
    y: first.y,
    width: first.width,
    height: first.height,
    booleanOperation: operation
  })
  for (const nodeId of nodeIds) {
    graph.reparentNode(nodeId, group.id)
  }
  if (index != null) graph.reorderChild(group.id, parentId, index)
  return group
}

export function createFlattenPlaceholder(
  graph: SceneGraph,
  nodes: SceneNode[],
  parentId: string
): SceneNode {
  const first = nodes[0]
  return graph.createNode('VECTOR', parentId, {
    name: 'Flatten',
    x: first.x,
    y: first.y,
    width: first.width,
    height: first.height,
    fills: copyFills(first.fills)
  })
}

export function flattenNodesWithRenderer(
  graph: SceneGraph,
  renderer: SkiaRenderer,
  nodes: SceneNode[],
  parentId: string
): SceneNode {
  if (nodes.some((node) => !canMakeBooleanSourceNode(node, graph))) {
    throw new Error('Cannot flatten unsupported node type')
  }

  const vectorProps = flattenNodesToVectorProps(renderer, graph, nodes)
  if (!vectorProps) throw new Error('Cannot flatten empty node path')
  return graph.createNode('VECTOR', parentId, vectorProps)
}

export function computeScrollZoom(
  nodes: readonly { absoluteBoundingBox: Rect }[],
  viewWidth: number,
  viewHeight: number
): { x: number; y: number; zoom: number } | null {
  const b = computeBounds(nodes.map((n) => n.absoluteBoundingBox))
  if (b.width === 0 && b.height === 0 && nodes.length === 0) return null

  const padding = 80
  const contentW = b.width + padding * 2
  const contentH = b.height + padding * 2
  const zoom = Math.min(viewWidth / contentW, viewHeight / contentH, 1)
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, zoom }
}
