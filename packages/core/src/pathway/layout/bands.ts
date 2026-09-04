import type { Vector } from '@signal-forge/scene-graph'

export interface NodeInfo {
  id: string
  type: 'epn' | 'process' | 'compartment'
  width: number
  height: number
  compartmentId: string | null
}

interface GroupSlice {
  comp: string | null
  start: number
  end: number
}

/**
 * Orders compartments by the earliest layer they appear in, so band layout
 * follows signal flow (e.g. extracellular → cytoplasm → nucleus).
 */
export function compartmentOrder(
  layerMap: Map<string, number>,
  nodes: Map<string, NodeInfo>
): Map<string | null, number> {
  const minLayer = new Map<string | null, number>()
  for (const [, info] of nodes) {
    if (info.type === 'compartment') continue
    const layer = layerMap.get(info.id) ?? 0
    const key = info.compartmentId
    const current = minLayer.get(key)
    if (current === undefined || layer < current) minLayer.set(key, layer)
  }
  const sorted = [...minLayer.entries()].sort((a, b) => a[1] - b[1])
  return new Map(sorted.map(([key], index) => [key, index]))
}

/**
 * Makes each layer's nodes contiguous per compartment (stable w.r.t. the
 * barycenter order computed beforehand) so compartment boxes never interleave.
 */
export function groupLayersByCompartment(
  layers: string[][],
  nodes: Map<string, NodeInfo>,
  compOrder: Map<string | null, number>
): void {
  for (const ids of layers) {
    if (ids.length <= 1) continue
    ids.sort(
      (a, b) =>
        (compOrder.get(nodes.get(a)?.compartmentId ?? null) ?? 0) -
        (compOrder.get(nodes.get(b)?.compartmentId ?? null) ?? 0)
    )
  }
}

function groupOf(nodes: Map<string, NodeInfo>, id: string): string | null {
  return nodes.get(id)?.compartmentId ?? null
}

function collectGroupSlices(ids: string[], nodes: Map<string, NodeInfo>): GroupSlice[] {
  const slices: GroupSlice[] = []
  let index = 0
  while (index < ids.length) {
    const comp = groupOf(nodes, ids[index])
    let end = index
    while (end < ids.length && groupOf(nodes, ids[end]) === comp) end++
    slices.push({ comp, start: index, end })
    index = end
  }
  return slices
}

function sliceSpan(
  ids: string[],
  slice: GroupSlice,
  nodes: Map<string, NodeInfo>,
  isTB: boolean,
  nodeGap: number
): number {
  let span = 0
  for (let i = slice.start; i < slice.end; i++) {
    const info = nodes.get(ids[i])
    span += isTB ? (info?.width ?? 0) : (info?.height ?? 0)
  }
  return span + (slice.end - slice.start - 1) * nodeGap
}

/**
 * Places nodes in per-layer rows where every compartment owns a fixed band
 * across all layers. Per-layer centering alone would let a compartment's
 * nodes drift into another compartment's band, producing overlapping
 * compartment boxes.
 */
export function computePositions(
  layers: string[][],
  nodes: Map<string, NodeInfo>,
  direction: 'top-bottom' | 'left-right',
  spacing: number
): Map<string, Vector> {
  const isTB = direction === 'top-bottom'
  const layerGap = spacing * 2.5
  const nodeGap = spacing
  const groupGap = spacing * 2
  const absPositions = new Map<string, Vector>()

  const slicesByLayer = layers.map((ids) => collectGroupSlices(ids, nodes))
  const bandWidth = new Map<string | null, number>()
  for (let l = 0; l < layers.length; l++) {
    for (const slice of slicesByLayer[l]) {
      const span = sliceSpan(layers[l], slice, nodes, isTB, nodeGap)
      bandWidth.set(slice.comp, Math.max(bandWidth.get(slice.comp) ?? 0, span))
    }
  }

  const totalWidth =
    [...bandWidth.values()].reduce((sum, w) => sum + w, 0) + (bandWidth.size - 1) * groupGap
  const bandStart = new Map<string | null, number>()
  let cursor = -totalWidth / 2
  for (const [comp, width] of bandWidth) {
    bandStart.set(comp, cursor)
    cursor += width + groupGap
  }

  for (let l = 0; l < layers.length; l++) {
    const ids = layers[l]
    if (ids.length === 0) continue
    const layerPos = l * layerGap

    for (const slice of slicesByLayer[l]) {
      const width = bandWidth.get(slice.comp) ?? 0
      const span = sliceSpan(ids, slice, nodes, isTB, nodeGap)
      let pos = (bandStart.get(slice.comp) ?? 0) + (width - span) / 2
      for (let i = slice.start; i < slice.end; i++) {
        const info = nodes.get(ids[i])
        if (!info) continue
        if (isTB) {
          absPositions.set(ids[i], { x: pos, y: layerPos })
          pos += info.width + nodeGap
        } else {
          absPositions.set(ids[i], { x: layerPos, y: pos })
          pos += info.height + nodeGap
        }
      }
    }
  }

  return absPositions
}
