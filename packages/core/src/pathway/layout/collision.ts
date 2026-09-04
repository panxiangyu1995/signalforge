import type { SceneGraph, Vector } from '@signal-forge/scene-graph'

interface NodeBounds {
  id: string
  x: number
  y: number
  width: number
  height: number
  parentId: string | null
}

const MAX_ITERATIONS = 20

function collectNodeBounds(graph: SceneGraph, pageId: string): NodeBounds[] {
  const page = graph.getNode(pageId)
  if (!page) return []

  const bounds: NodeBounds[] = []
  const stack = [...page.childIds]

  while (stack.length > 0) {
    const id = stack.pop()
    if (id === undefined) continue
    const node = graph.getNode(id)
    if (!node) continue

    if (node.type === 'PATHWAY_GLYPH' || node.type === 'PATHWAY_PROCESS') {
      const abs = graph.getAbsolutePosition(id)
      bounds.push({
        id,
        x: abs.x,
        y: abs.y,
        width: node.width,
        height: node.height,
        parentId: node.parentId
      })
    }

    stack.push(...node.childIds)
  }

  return bounds
}

interface Separation {
  sepX: number
  sepY: number
}

/** Effective bounds including the accumulated separation offset. */
function effectiveBounds(b: NodeBounds, offsets: Map<string, Vector>): NodeBounds {
  const off = offsets.get(b.id)
  if (!off || (off.x === 0 && off.y === 0)) return b
  return { ...b, x: b.x + off.x, y: b.y + off.y }
}

function computeSeparation(
  a: Pick<NodeBounds, 'x' | 'y' | 'width' | 'height'>,
  b: Pick<NodeBounds, 'x' | 'y' | 'width' | 'height'>,
  minGap: number
): Separation | null {
  const overlap =
    a.x < b.x + b.width + minGap &&
    a.x + a.width + minGap > b.x &&
    a.y < b.y + b.height + minGap &&
    a.y + a.height + minGap > b.y
  if (!overlap) return null

  const overlapX = Math.min(a.x + a.width + minGap - b.x, b.x + b.width + minGap - a.x)
  const overlapY = Math.min(a.y + a.height + minGap - b.y, b.y + b.height + minGap - a.y)
  if (overlapX <= 0 || overlapY <= 0) return null

  if (overlapX < overlapY) {
    const sepX = ((a.x + a.width / 2 < b.x + b.width / 2 ? -1 : 1) * overlapX) / 2
    return { sepX, sepY: 0 }
  }
  const sepY = ((a.y + a.height / 2 < b.y + b.height / 2 ? -1 : 1) * overlapY) / 2
  return { sepX: 0, sepY }
}

function detectAndResolveOverlaps(
  bounds: NodeBounds[],
  offsets: Map<string, Vector>,
  minGap: number
): boolean {
  let anyOverlap = false

  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      // Only separate siblings — pushing nodes across compartment boundaries
      // breaks containment and invalidates compartment bounds.
      if (bounds[i].parentId !== bounds[j].parentId) continue
      const a = effectiveBounds(bounds[i], offsets)
      const b = effectiveBounds(bounds[j], offsets)
      const sep = computeSeparation(a, b, minGap)
      if (!sep) continue

      const offA = offsets.get(bounds[i].id)
      const offB = offsets.get(bounds[j].id)
      if (!offA || !offB) continue
      offsets.set(bounds[i].id, { x: offA.x + sep.sepX, y: offA.y + sep.sepY })
      offsets.set(bounds[j].id, { x: offB.x - sep.sepX, y: offB.y - sep.sepY })
      anyOverlap = true
    }
  }

  return anyOverlap
}

export function resolveCollisions(graph: SceneGraph, pageId: string, minGap: number): number {
  const bounds = collectNodeBounds(graph, pageId)
  if (bounds.length <= 1) return 0

  const offsets = new Map<string, Vector>()
  for (const b of bounds) offsets.set(b.id, { x: 0, y: 0 })

  let totalResolved = 0

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const anyOverlap = detectAndResolveOverlaps(bounds, offsets, minGap)
    if (!anyOverlap) break
    totalResolved++
  }

  for (const b of bounds) {
    const off = offsets.get(b.id)
    if (!off || (off.x === 0 && off.y === 0)) continue

    if (b.parentId) {
      const parent = graph.getNode(b.parentId)
      if (parent) {
        const parentAbs = graph.getAbsolutePosition(b.parentId)
        const node = graph.getNode(b.id)
        if (node) {
          graph.updateNode(b.id, { x: b.x + off.x - parentAbs.x, y: b.y + off.y - parentAbs.y })
        }
        continue
      }
    }

    graph.updateNode(b.id, { x: b.x + off.x, y: b.y + off.y })
  }

  return totalResolved
}
