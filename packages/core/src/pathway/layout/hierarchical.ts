import type { SceneGraph, Vector } from '@signal-forge/scene-graph'
import { getPathwayData } from '@signal-forge/scene-graph'

import { SBGN_STYLE } from '#core/pathway/constants'

import {
  compartmentOrder,
  computePositions,
  groupLayersByCompartment,
  type NodeInfo
} from './bands'

interface ArcInfo {
  sourceId: string
  targetId: string
  arcType: string
}

const FLOW_ARC_TYPES: ReadonlySet<string> = new Set([
  'consumption',
  'production',
  'catalysis',
  'inhibition',
  'stimulation',
  'necessary_stimulation',
  'modulation',
  'trigger'
])

function parentCompartmentId(graph: SceneGraph, node: { parentId: string | null }): string | null {
  if (!node.parentId) return null
  const parent = graph.getNode(node.parentId)
  return parent?.type === 'COMPARTMENT' ? parent.id : null
}

function collectPathwayGraph(
  graph: SceneGraph,
  pageId: string
): {
  nodes: Map<string, NodeInfo>
  arcs: ArcInfo[]
  epnIds: string[]
  processIds: string[]
} | null {
  const page = graph.getNode(pageId)
  if (!page) return null

  const nodes = new Map<string, NodeInfo>()
  const arcs: ArcInfo[] = []

  const stack = [...page.childIds]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    const child = graph.getNode(current)
    if (!child) continue

    const data = getPathwayData(child)
    if (child.type === 'PATHWAY_GLYPH') {
      nodes.set(child.id, {
        id: child.id,
        type: 'epn',
        width: child.width,
        height: child.height,
        compartmentId: parentCompartmentId(graph, child)
      })
    } else if (child.type === 'PATHWAY_PROCESS') {
      nodes.set(child.id, {
        id: child.id,
        type: 'process',
        width: child.width,
        height: child.height,
        compartmentId: parentCompartmentId(graph, child)
      })
    } else if (child.type === 'COMPARTMENT') {
      nodes.set(child.id, {
        id: child.id,
        type: 'compartment',
        width: child.width,
        height: child.height,
        compartmentId: null
      })
    } else if (child.type === 'PATHWAY_ARC' && data?.sourceId && data.targetId) {
      arcs.push({
        sourceId: data.sourceId,
        targetId: data.targetId,
        arcType: data.arcType ?? 'consumption'
      })
    }

    stack.push(...child.childIds)
  }

  const epnIds: string[] = []
  const processIds: string[] = []
  for (const [id, info] of nodes) {
    if (info.type === 'epn') epnIds.push(id)
    else if (info.type === 'process') processIds.push(id)
  }

  return { nodes, arcs, epnIds, processIds }
}

function buildAdjacency(
  arcs: ArcInfo[],
  nodes: Map<string, NodeInfo>
): { downEdges: Map<string, string[]>; upEdges: Map<string, string[]> } {
  const downEdges = new Map<string, string[]>()
  const upEdges = new Map<string, string[]>()

  for (const arc of arcs) {
    if (!FLOW_ARC_TYPES.has(arc.arcType)) continue
    const srcInfo = nodes.get(arc.sourceId)
    const tgtInfo = nodes.get(arc.targetId)
    if (!srcInfo || !tgtInfo) continue
    if (srcInfo.type === 'compartment' || tgtInfo.type === 'compartment') continue

    const downs = downEdges.get(arc.sourceId) ?? []
    downs.push(arc.targetId)
    downEdges.set(arc.sourceId, downs)
    const ups = upEdges.get(arc.targetId) ?? []
    ups.push(arc.sourceId)
    upEdges.set(arc.targetId, ups)
  }

  return { downEdges, upEdges }
}

export function hierarchicalLayout(
  graph: SceneGraph,
  pageId: string,
  options?: {
    direction?: 'top-bottom' | 'left-right'
    spacing?: number
    respectPositions?: boolean
  }
): { positioned: number; layers: number } {
  const collected = collectPathwayGraph(graph, pageId)
  if (!collected) return { positioned: 0, layers: 0 }
  const { nodes, epnIds, processIds } = collected

  if (epnIds.length === 0 && processIds.length === 0) {
    return { positioned: 0, layers: 0 }
  }

  const { downEdges, upEdges } = buildAdjacency(collected.arcs, nodes)
  const { downEdges: dagDown, upEdges: dagUp } = breakCycles(epnIds, processIds, downEdges, upEdges)
  const layerMap = assignLayers(epnIds, processIds, dagDown, dagUp)

  const nonCompartmentIds = [...epnIds, ...processIds]
  const layers = buildLayerArrays(layerMap, nonCompartmentIds)
  const maxLayer = layers.length - 1

  barycenterOrder(layers, downEdges, upEdges, maxLayer)
  const compOrder = compartmentOrder(layerMap, nodes)
  groupLayersByCompartment(layers, nodes, compOrder)

  const direction = options?.direction ?? 'top-bottom'
  const spacing = options?.spacing ?? 60
  const respectPositions = options?.respectPositions ?? false

  let absPositions: Map<string, Vector>
  if (respectPositions) {
    absPositions = collectExistingPositions(graph, pageId, nonCompartmentIds)
  } else {
    absPositions = computePositions(layers, nodes, direction, spacing)
  }
  removeOverlaps(absPositions, layers, nodes, direction, spacing)
  const compBounds = expandCompartments(absPositions, graph, pageId, nodes)
  commitPositions(absPositions, compBounds, graph, pageId, nodes)

  return { positioned: nonCompartmentIds.length, layers: maxLayer + 1 }
}

function collectExistingPositions(
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[]
): Map<string, Vector> {
  const positions = new Map<string, Vector>()
  const page = graph.getNode(pageId)
  if (!page) return positions

  for (const id of nodeIds) {
    const abs = graph.getAbsolutePosition(id)
    positions.set(id, { x: abs.x, y: abs.y })
  }

  return positions
}

function breakCycles(
  epnIds: string[],
  processIds: string[],
  downEdges: Map<string, string[]>,
  upEdges: Map<string, string[]>
): { downEdges: Map<string, string[]>; upEdges: Map<string, string[]> } {
  const allIds = new Set([...epnIds, ...processIds])
  const visited = new Set<string>()
  const onStack = new Set<string>()
  const backEdges = new Set<string>()

  function dfs(id: string): void {
    if (visited.has(id)) return
    visited.add(id)
    onStack.add(id)
    for (const downId of downEdges.get(id) ?? []) {
      if (!allIds.has(downId)) continue
      if (onStack.has(downId)) {
        backEdges.add(`${id}->${downId}`)
      } else if (!visited.has(downId)) {
        dfs(downId)
      }
    }
    onStack.delete(id)
  }

  for (const id of allIds) {
    if (!visited.has(id)) dfs(id)
  }

  if (backEdges.size === 0) return { downEdges, upEdges }

  const dagDown = new Map<string, string[]>()
  const dagUp = new Map<string, string[]>()
  for (const [src, targets] of downEdges) {
    const filtered = targets.filter((tgt) => !backEdges.has(`${src}->${tgt}`))
    if (filtered.length > 0) dagDown.set(src, filtered)
  }
  for (const [tgt, sources] of upEdges) {
    const filtered = sources.filter((src) => !backEdges.has(`${src}->${tgt}`))
    if (filtered.length > 0) dagUp.set(tgt, filtered)
  }
  return { downEdges: dagDown, upEdges: dagUp }
}

function assignLayers(
  epnIds: string[],
  processIds: string[],
  downEdges: Map<string, string[]>,
  upEdges: Map<string, string[]>
): Map<string, number> {
  const layerMap = new Map<string, number>()
  const allIds = new Set([...epnIds, ...processIds])

  const topoOrder = topoSort(allIds, downEdges)

  for (const id of topoOrder) {
    const ups = upEdges.get(id) ?? []
    let maxUpLayer = -1
    for (const upId of ups) {
      const upLayer = layerMap.get(upId)
      if (upLayer !== undefined && upLayer > maxUpLayer) {
        maxUpLayer = upLayer
      }
    }
    layerMap.set(id, maxUpLayer + 1)
  }

  return layerMap
}

function computeInDegree(
  allIds: Set<string>,
  downEdges: Map<string, string[]>
): Map<string, number> {
  const inDegree = new Map<string, number>()
  for (const id of allIds) {
    inDegree.set(id, 0)
  }
  for (const [src, targets] of downEdges) {
    if (!allIds.has(src)) continue
    for (const tgt of targets) {
      if (!allIds.has(tgt)) continue
      inDegree.set(tgt, (inDegree.get(tgt) ?? 0) + 1)
    }
  }
  return inDegree
}

function topoSort(allIds: Set<string>, downEdges: Map<string, string[]>): string[] {
  const inDegree = computeInDegree(allIds, downEdges)

  const queue: string[] = []
  for (const id of allIds) {
    if ((inDegree.get(id) ?? 0) === 0) {
      queue.push(id)
    }
  }

  const topoOrder: string[] = []
  const visited = new Set<string>()
  while (queue.length > 0) {
    const id = queue.shift()
    if (!id || visited.has(id)) continue
    visited.add(id)
    topoOrder.push(id)
    for (const downId of downEdges.get(id) ?? []) {
      if (!allIds.has(downId) || visited.has(downId)) continue
      const deg = (inDegree.get(downId) ?? 1) - 1
      inDegree.set(downId, deg)
      if (deg <= 0) queue.push(downId)
    }
  }

  for (const id of allIds) {
    if (!visited.has(id)) topoOrder.push(id)
  }

  return topoOrder
}

function buildLayerArrays(layerMap: Map<string, number>, nodeIds: string[]): string[][] {
  let maxLayer = 0
  for (const id of nodeIds) {
    const l = layerMap.get(id) ?? 0
    if (l > maxLayer) maxLayer = l
  }

  const layers: string[][] = []
  for (let i = 0; i <= maxLayer; i++) layers.push([])
  for (const id of nodeIds) {
    const l = layerMap.get(id) ?? 0
    layers[l].push(id)
  }
  return layers
}

function computeBarycenters(
  ids: string[],
  neighbors: Map<string, string[]>,
  orderMap: Map<string, number>,
  selfOrder: Map<string, number>
): Map<string, number> {
  const barycenters = new Map<string, number>()
  for (const id of ids) {
    const nbs = neighbors.get(id) ?? []
    if (nbs.length === 0) {
      barycenters.set(id, selfOrder.get(id) ?? 0)
      continue
    }
    let sum = 0
    let count = 0
    for (const nId of nbs) {
      const pos = orderMap.get(nId)
      if (pos !== undefined) {
        sum += pos
        count++
      }
    }
    barycenters.set(id, count > 0 ? sum / count : (selfOrder.get(id) ?? 0))
  }
  return barycenters
}

function barycenterOrder(
  layers: string[][],
  adjacencyDown: Map<string, string[]>,
  adjacencyUp: Map<string, string[]>,
  maxLayer: number
): void {
  for (let round = 0; round < 10; round++) {
    for (let l = 1; l <= maxLayer; l++) {
      const ids = layers[l]
      if (ids.length <= 1) continue
      const orderMap = new Map<string, number>()
      const prevIds = layers[l - 1] ?? []
      prevIds.forEach((id, i) => orderMap.set(id, i))
      const selfOrder = new Map(ids.map((id, i) => [id, i]))
      const bc = computeBarycenters(ids, adjacencyUp, orderMap, selfOrder)
      ids.sort((a, b) => (bc.get(a) ?? 0) - (bc.get(b) ?? 0))
    }

    for (let l = maxLayer - 1; l >= 0; l--) {
      const ids = layers[l]
      if (ids.length <= 1) continue
      const orderMap = new Map<string, number>()
      const nextIds = layers[l + 1] ?? []
      nextIds.forEach((id, i) => orderMap.set(id, i))
      const selfOrder = new Map(ids.map((id, i) => [id, i]))
      const bc = computeBarycenters(ids, adjacencyDown, orderMap, selfOrder)
      ids.sort((a, b) => (bc.get(a) ?? 0) - (bc.get(b) ?? 0))
    }
  }
}

function removeOverlaps(
  absPositions: Map<string, Vector>,
  layers: string[][],
  nodes: Map<string, NodeInfo>,
  direction: 'top-bottom' | 'left-right',
  minGap: number
): void {
  const isTB = direction === 'top-bottom'

  for (const ids of layers) {
    if (ids.length <= 1) continue

    for (let i = 1; i < ids.length; i++) {
      const prevId = ids[i - 1]
      const currId = ids[i]
      const prevInfo = nodes.get(prevId)
      const currInfo = nodes.get(currId)
      if (!prevInfo || !currInfo) continue

      const prevAbs = absPositions.get(prevId)
      const currAbs = absPositions.get(currId)
      if (!prevAbs || !currAbs) continue

      if (isTB) {
        const overlap = prevAbs.x + prevInfo.width + minGap - currAbs.x
        if (overlap > 0) {
          absPositions.set(currId, { x: currAbs.x + overlap, y: currAbs.y })
          for (let j = i + 1; j < ids.length; j++) {
            const laterAbs = absPositions.get(ids[j])
            if (laterAbs) absPositions.set(ids[j], { x: laterAbs.x + overlap, y: laterAbs.y })
          }
        }
      } else {
        const overlap = prevAbs.y + prevInfo.height + minGap - currAbs.y
        if (overlap > 0) {
          absPositions.set(currId, { x: currAbs.x, y: currAbs.y + overlap })
          for (let j = i + 1; j < ids.length; j++) {
            const laterAbs = absPositions.get(ids[j])
            if (laterAbs) absPositions.set(ids[j], { x: laterAbs.x, y: laterAbs.y + overlap })
          }
        }
      }
    }
  }
}

interface CompartmentBounds {
  id: string
  x: number
  y: number
  width: number
  height: number
}

function expandCompartments(
  absPositions: Map<string, Vector>,
  graph: SceneGraph,
  pageId: string,
  nodes: Map<string, NodeInfo>
): Map<string, CompartmentBounds> {
  const page = graph.getNode(pageId)
  if (!page) return new Map()

  const padding = SBGN_STYLE.compartmentPadding
  const compBounds = new Map<string, CompartmentBounds>()

  for (const childId of page.childIds) {
    const child = graph.getNode(childId)
    if (child?.type !== 'COMPARTMENT') continue
    if (child.childIds.length === 0) continue

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const gcId of child.childIds) {
      const gcAbs = absPositions.get(gcId)
      const gcInfo = nodes.get(gcId)
      if (!gcAbs || !gcInfo) continue
      minX = Math.min(minX, gcAbs.x)
      minY = Math.min(minY, gcAbs.y)
      maxX = Math.max(maxX, gcAbs.x + gcInfo.width)
      maxY = Math.max(maxY, gcAbs.y + gcInfo.height)
    }

    if (minX === Infinity) continue

    compBounds.set(child.id, {
      id: child.id,
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2
    })
  }

  return compBounds
}

function commitPositions(
  absPositions: Map<string, Vector>,
  compBounds: Map<string, CompartmentBounds>,
  graph: SceneGraph,
  pageId: string,
  nodes: Map<string, NodeInfo>
): void {
  const page = graph.getNode(pageId)
  if (!page) return

  for (const childId of page.childIds) {
    const child = graph.getNode(childId)
    if (child?.type !== 'COMPARTMENT') continue

    const bounds = compBounds.get(child.id)
    if (bounds) {
      graph.updateNode(child.id, {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      })
    }

    if (child.childIds.length === 0) continue

    const compAbs: Vector = bounds
      ? { x: bounds.x, y: bounds.y }
      : graph.getAbsolutePosition(child.id)

    for (const gcId of child.childIds) {
      const gcAbs = absPositions.get(gcId)
      if (!gcAbs) continue
      graph.updateNode(gcId, {
        x: gcAbs.x - compAbs.x,
        y: gcAbs.y - compAbs.y
      })
    }
  }

  for (const [id, absPos] of absPositions) {
    const info = nodes.get(id)
    if (!info) continue
    if (info.compartmentId) continue
    graph.updateNode(id, { x: absPos.x, y: absPos.y })
  }
}
