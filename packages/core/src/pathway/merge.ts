import {
  getPathwayData,
  updatePathwayData,
  type SceneGraph,
  type SceneNode
} from '@signal-forge/scene-graph'

export interface MergeResult {
  mergedEntities: number
  totalEntities: number
  totalArcs: number
  totalProcesses: number
}

type MatchMode = 'name' | 'name_and_type'

export function mergePathways(
  graph: SceneGraph,
  sourcePageId: string,
  targetPageId: string,
  matchBy: MatchMode = 'name_and_type'
): MergeResult {
  const sourcePage = graph.getNode(sourcePageId)
  const targetPage = graph.getNode(targetPageId)
  if (!sourcePage || !targetPage) {
    return { mergedEntities: 0, totalEntities: 0, totalArcs: 0, totalProcesses: 0 }
  }

  const targetEntityMap = collectTargetEntities(graph, targetPageId, matchBy)
  const nameToId = new Map<string, string>()
  const mergedEntities = copySourceEntities(
    graph,
    sourcePageId,
    targetPageId,
    matchBy,
    targetEntityMap,
    nameToId
  )
  remapSourceArcs(graph, sourcePageId, targetPageId, matchBy, nameToId)
  const counts = countTargetNodes(graph, targetPageId)

  return { mergedEntities, ...counts }
}

// Target map keys use the bare name in 'name' mode; source glyphs use the
// 'glyph:' prefix in that same mode, so 'name' mode never matches by design.
function targetGlyphKey(node: SceneNode, matchBy: MatchMode): string {
  return matchBy === 'name_and_type'
    ? `${getPathwayData(node)?.glyphType ?? 'unknown'}:${node.name}`
    : node.name
}

function sourceGlyphKey(node: SceneNode, matchBy: MatchMode): string {
  return matchBy === 'name_and_type'
    ? `${getPathwayData(node)?.glyphType ?? 'unknown'}:${node.name}`
    : `glyph:${node.name}`
}

function processKey(node: SceneNode, matchBy: MatchMode): string {
  return matchBy === 'name_and_type'
    ? `${getPathwayData(node)?.processType ?? 'unknown'}:${node.name}`
    : `process:${node.name}`
}

function endpointKey(node: SceneNode, matchBy: MatchMode): string {
  if (matchBy === 'name_and_type') {
    return `${getPathwayData(node)?.glyphType ?? getPathwayData(node)?.processType ?? 'unknown'}:${node.name}`
  }
  return node.type === 'PATHWAY_PROCESS' ? `process:${node.name}` : `glyph:${node.name}`
}

function collectTargetEntities(
  graph: SceneGraph,
  targetPageId: string,
  matchBy: MatchMode
): Map<string, string> {
  const targetEntityMap = new Map<string, string>()
  for (const childId of collectDescendantIds(graph, targetPageId)) {
    const node = graph.getNode(childId)
    if (node?.type !== 'PATHWAY_GLYPH') continue
    targetEntityMap.set(targetGlyphKey(node, matchBy), node.id)
  }
  return targetEntityMap
}

function copySourceEntities(
  graph: SceneGraph,
  sourcePageId: string,
  targetPageId: string,
  matchBy: MatchMode,
  targetEntityMap: Map<string, string>,
  nameToId: Map<string, string>
): number {
  let mergedEntities = 0
  for (const childId of collectDescendantIds(graph, sourcePageId)) {
    const node = graph.getNode(childId)
    if (!node) continue

    if (node.type === 'PATHWAY_GLYPH') {
      if (mergeSourceGlyph(graph, node, targetPageId, matchBy, targetEntityMap, nameToId)) {
        mergedEntities++
      }
    } else if (node.type === 'PATHWAY_PROCESS') {
      cloneSourceProcess(graph, node, targetPageId, matchBy, nameToId)
    }
  }
  return mergedEntities
}

function mergeSourceGlyph(
  graph: SceneGraph,
  node: SceneNode,
  targetPageId: string,
  matchBy: MatchMode,
  targetEntityMap: Map<string, string>,
  nameToId: Map<string, string>
): boolean {
  const key = sourceGlyphKey(node, matchBy)
  const existingId = targetEntityMap.get(key)

  if (existingId) {
    nameToId.set(key, existingId)
    return true
  }

  const clone = graph.createNode('PATHWAY_GLYPH', targetPageId, {
    name: node.name,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height
  })
  const data = getPathwayData(node)
  if (data) updatePathwayData(clone, data)
  nameToId.set(key, clone.id)
  targetEntityMap.set(key, clone.id)
  return false
}

function cloneSourceProcess(
  graph: SceneGraph,
  node: SceneNode,
  targetPageId: string,
  matchBy: MatchMode,
  nameToId: Map<string, string>
): void {
  const key = processKey(node, matchBy)
  const clone = graph.createNode('PATHWAY_PROCESS', targetPageId, {
    name: node.name,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height
  })
  const data = getPathwayData(node)
  if (data) updatePathwayData(clone, data)
  nameToId.set(key, clone.id)
}

function remapSourceArcs(
  graph: SceneGraph,
  sourcePageId: string,
  targetPageId: string,
  matchBy: MatchMode,
  nameToId: Map<string, string>
): void {
  for (const childId of collectDescendantIds(graph, sourcePageId)) {
    const node = graph.getNode(childId)
    if (node?.type !== 'PATHWAY_ARC') continue

    const data = getPathwayData(node)
    if (!data?.sourceId || !data.targetId || !data.arcType) continue

    const sourceNode = graph.getNode(data.sourceId)
    const targetNode = graph.getNode(data.targetId)
    if (!sourceNode || !targetNode) continue

    const newSourceId = nameToId.get(endpointKey(sourceNode, matchBy))
    const newTargetId = nameToId.get(endpointKey(targetNode, matchBy))

    if (!newSourceId || !newTargetId) continue

    const arc = graph.createNode('PATHWAY_ARC', targetPageId, {
      name: node.name
    })
    updatePathwayData(arc, { arcType: data.arcType, sourceId: newSourceId, targetId: newTargetId })
  }
}

function countTargetNodes(
  graph: SceneGraph,
  targetPageId: string
): { totalEntities: number; totalArcs: number; totalProcesses: number } {
  let totalEntities = 0
  let totalArcs = 0
  let totalProcesses = 0
  for (const childId of collectDescendantIds(graph, targetPageId)) {
    const n = graph.getNode(childId)
    if (!n) continue
    if (n.type === 'PATHWAY_GLYPH') totalEntities++
    else if (n.type === 'PATHWAY_ARC') totalArcs++
    else if (n.type === 'PATHWAY_PROCESS') totalProcesses++
  }
  return { totalEntities, totalArcs, totalProcesses }
}

function collectDescendantIds(graph: SceneGraph, parentId: string): string[] {
  const ids: string[] = []
  const stack = [parentId]
  while (stack.length > 0) {
    const id = stack.pop()
    if (!id) break
    const node = graph.getNode(id)
    if (!node) continue
    if (id !== parentId) ids.push(id)
    stack.push(...node.childIds)
  }
  return ids
}
