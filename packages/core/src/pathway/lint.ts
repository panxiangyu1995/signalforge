import {
  getPathwayData,
  type PathwayArcType,
  type SceneGraph,
  type SceneNode
} from '@signal-forge/scene-graph'

export interface PathwayLintIssue {
  rule: string
  severity: 'error' | 'warning'
  nodeId: string
  message: string
}

const REGULATORY_ARC_TYPES = new Set<PathwayArcType>([
  'modulation',
  'stimulation',
  'catalysis',
  'inhibition',
  'necessary_stimulation',
  'trigger'
])

export function lintPathway(graph: SceneGraph, pageId: string): PathwayLintIssue[] {
  const issues: PathwayLintIssue[] = []
  const page = graph.getNode(pageId)
  if (!page) return issues

  const allNodes = collectPathwayNodes(graph, pageId)
  const arcNodes = allNodes.filter((n) => n.type === 'PATHWAY_ARC')
  const entityNodes = allNodes.filter((n) => n.type === 'PATHWAY_GLYPH')
  const processNodes = allNodes.filter((n) => n.type === 'PATHWAY_PROCESS')

  lintArcsBetweenEntities(graph, arcNodes, issues)
  lintMissingCompartments(graph, entityNodes, issues)

  const processArcCounts = collectProcessArcCounts(graph, arcNodes)
  lintOrphanProcesses(processArcCounts, processNodes, issues)

  lintRegulatoryArcs(graph, arcNodes, issues)

  return issues
}

function lintArcsBetweenEntities(
  graph: SceneGraph,
  arcNodes: SceneNode[],
  issues: PathwayLintIssue[]
): void {
  for (const arc of arcNodes) {
    const data = getPathwayData(arc)
    if (!data?.sourceId || !data.targetId) continue

    const source = graph.getNode(data.sourceId)
    const target = graph.getNode(data.targetId)

    if (source?.type === 'PATHWAY_GLYPH' && target?.type === 'PATHWAY_GLYPH') {
      issues.push({
        rule: 'arc-between-entities',
        severity: 'error',
        nodeId: arc.id,
        message: `Arc "${arc.name}" connects two entities directly — SBGN requires arcs go through process nodes`
      })
    }
  }
}

function lintMissingCompartments(
  graph: SceneGraph,
  entityNodes: SceneNode[],
  issues: PathwayLintIssue[]
): void {
  for (const entity of entityNodes) {
    const parentType = entity.parentId ? graph.getNode(entity.parentId)?.type : null
    const isOnPage = parentType === 'CANVAS'

    if (isOnPage) {
      issues.push({
        rule: 'missing-compartment',
        severity: 'warning',
        nodeId: entity.id,
        message: `Entity "${entity.name}" is not inside a compartment`
      })
    }
  }
}

function collectProcessArcCounts(
  graph: SceneGraph,
  arcNodes: SceneNode[]
): Map<string, { consumption: number; production: number }> {
  const processArcCounts = new Map<string, { consumption: number; production: number }>()
  for (const arc of arcNodes) {
    const data = getPathwayData(arc)
    if (!data?.targetId || !data.arcType) continue

    const target = graph.getNode(data.targetId)
    if (target?.type !== 'PATHWAY_PROCESS') continue

    const counts = processArcCounts.get(target.id) ?? { consumption: 0, production: 0 }
    if (data.arcType === 'consumption') counts.consumption++
    if (data.arcType === 'production') counts.production++
    processArcCounts.set(target.id, counts)
  }
  return processArcCounts
}

function lintOrphanProcesses(
  processArcCounts: Map<string, { consumption: number; production: number }>,
  processNodes: SceneNode[],
  issues: PathwayLintIssue[]
): void {
  for (const process of processNodes) {
    const counts = processArcCounts.get(process.id)
    if (!counts || counts.consumption === 0 || counts.production === 0) {
      issues.push({
        rule: 'orphan-process',
        severity: 'warning',
        nodeId: process.id,
        message: `Process "${process.name}" should have at least 1 consumption and 1 production arc`
      })
    }
  }
}

function lintRegulatoryArcs(
  graph: SceneGraph,
  arcNodes: SceneNode[],
  issues: PathwayLintIssue[]
): void {
  for (const arc of arcNodes) {
    const data = getPathwayData(arc)
    if (!data?.arcType || !data.sourceId || !data.targetId) continue

    const source = graph.getNode(data.sourceId)
    const target = graph.getNode(data.targetId)

    if (REGULATORY_ARC_TYPES.has(data.arcType)) {
      if (source?.type !== 'PATHWAY_GLYPH' || target?.type !== 'PATHWAY_PROCESS') {
        issues.push({
          rule: 'invalid-arc-type',
          severity: 'error',
          nodeId: arc.id,
          message: `Regulatory arc "${data.arcType}" should go from entity to process`
        })
      }
    }
  }
}

function collectPathwayNodes(graph: SceneGraph, parentId: string): SceneNode[] {
  const result: SceneNode[] = []
  const parent = graph.getNode(parentId)
  if (!parent) return result

  const stack = [...parent.childIds]
  while (stack.length > 0) {
    const id = stack.pop()
    if (!id) break
    const node = graph.getNode(id)
    if (!node) continue

    if (
      node.type === 'PATHWAY_GLYPH' ||
      node.type === 'PATHWAY_PROCESS' ||
      node.type === 'PATHWAY_ARC'
    ) {
      result.push(node)
    }

    if (node.childIds.length > 0) {
      stack.push(...node.childIds)
    }
  }

  return result
}
