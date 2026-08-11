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
      if (abs) {
        bounds.push({
          id,
          x: abs.x,
          y: abs.y,
          width: node.width,
          height: node.height,
          parentId: node.parentId,
        })
      }
    }

    stack.push(...node.childIds)
  }

  return bounds
}

function detectAndResolveOverlaps(
  bounds: NodeBounds[],
  offsets: Map<string, Vector>,
  minGap: number
): boolean {
  let anyOverlap = false

  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      const offA = offsets.get(bounds[i].id)
      const offB = offsets.get(bounds[j].id)
      const ax = bounds[i].x + (offA?.x ?? 0)
      const ay = bounds[i].y + (offA?.y ?? 0)
      const bx = bounds[j].x + (offB?.x ?? 0)
      const by = bounds[j].y + (offB?.y ?? 0)

      const aW = bounds[i].width
      const aH = bounds[i].height
      const bW = bounds[j].width
      const bH = bounds[j].height

      const overlap =
        ax < bx + bW + minGap &&
        ax + aW + minGap > bx &&
        ay < by + bH + minGap &&
        ay + aH + minGap > by

      if (overlap) {
        const overlapX = Math.min(ax + aW + minGap - bx, bx + bW + minGap - ax)
        const overlapY = Math.min(ay + aH + minGap - by, by + bH + minGap - ay)

        if (overlapX > 0 && overlapY > 0) {
          let sepX = 0
          let sepY = 0
          if (overlapX < overlapY) {
            sepX = ((ax + aW / 2) < (bx + bW / 2) ? -1 : 1) * overlapX / 2
          } else {
            sepY = ((ay + aH / 2) < (by + bH / 2) ? -1 : 1) * overlapY / 2
          }
          if (offA && offB) {
            offsets.set(bounds[i].id, { x: offA.x + sepX, y: offA.y + sepY })
            offsets.set(bounds[j].id, { x: offB.x - sepX, y: offB.y - sepY })
          }
        }
        anyOverlap = true
      }
    }
  }

  return anyOverlap
}

export function resolveCollisions(
  graph: SceneGraph,
  pageId: string,
  minGap: number
): number {
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
        if (parentAbs) {
          const node = graph.getNode(b.id)
          if (node) {
            graph.updateNode(b.id, { x: b.x + off.x - parentAbs.x, y: b.y + off.y - parentAbs.y })
          }
        }
        continue
      }
    }

    graph.updateNode(b.id, { x: b.x + off.x, y: b.y + off.y })
  }

  return totalResolved
}
