import { defineTool } from '#core/tools/schema'
import { hierarchicalLayout } from '#core/pathway/layout/hierarchical'
import { computeOrthogonalBendPoints } from '#core/pathway/layout/orthogonal'

import {
  type PathwayGlyphType,
  type PathwayProcessType,
  type PathwayArcType,
  type SceneNode,
  updatePathwayData
} from '@signal-forge/scene-graph'

interface EntitySpec {
  name: string
  glyph_type: PathwayGlyphType
  x?: number
  y?: number
  width?: number
  height?: number
  compartment?: string
  state_variables?: string
  clone_marker?: boolean
}

interface ProcessSpec {
  name: string
  process_type: PathwayProcessType
  x?: number
  y?: number
  compartment?: string
}

interface ArcSpec {
  source: string
  target: string
  arc_type: PathwayArcType
}

interface CompartmentSpec {
  name: string
  x?: number
  y?: number
  width?: number
  height?: number
}

function parseSpecs<T>(json: string, label: string): T[] | { error: string } {
  try {
    return JSON.parse(json) as T[]
  } catch {
    return { error: `Invalid JSON in ${label} parameter` }
  }
}

function parseStateVariables(sv: string): Array<{ variable: string; value?: string }> {
  return sv.split(',').map((s: string) => {
    const trimmed = s.trim()
    const atIdx = trimmed.indexOf('@')
    if (atIdx > 0) {
      return { variable: trimmed.slice(0, atIdx), value: trimmed.slice(atIdx + 1) }
    }
    return { variable: trimmed }
  })
}

interface FigmaLike {
  graph: { getNode: (id: string) => SceneNode | undefined }
  currentPage: { id: string }
  createCompartment: (name: string, opts: Record<string, unknown>) => SceneNode
  createPathwayGlyph: (type: string, opts: Record<string, unknown>) => SceneNode
  createPathwayProcess: (type: string, opts: Record<string, unknown>) => SceneNode
  createPathwayArc: (type: string, src: string, tgt: string, opts: Record<string, unknown>) => SceneNode
  getNodeById: (id: string) => SceneNode | undefined
  pathwayStyle: string
  setPathwayStyle: (style: string) => void
  beginBatch: () => void
  endBatch: () => void
}

function createCompartments(
  figma: FigmaLike,
  specs: CompartmentSpec[],
  nameToId: Map<string, string>,
  nameCollisions: string[]
): string[] {
  const ids: string[] = []
  for (const spec of specs) {
    const node = figma.createCompartment(spec.name, {
      x: spec.x ?? 0, y: spec.y ?? 0,
      width: spec.width ?? 800, height: spec.height ?? 600
    })
    if (nameToId.has(spec.name)) nameCollisions.push(spec.name)
    nameToId.set(spec.name, node.id)
    ids.push(node.id)
  }
  return ids
}

function createEntities(
  figma: FigmaLike,
  specs: EntitySpec[],
  nameToId: Map<string, string>,
  nameCollisions: string[]
): string[] {
  const ids: string[] = []
  for (const spec of specs) {
    const parentId = spec.compartment ? nameToId.get(spec.compartment) : undefined
    const node = figma.createPathwayGlyph(spec.glyph_type, {
      name: spec.name, x: spec.x ?? 0, y: spec.y ?? 0,
      width: spec.width ?? 96, height: spec.height ?? 48
    })

    if (spec.state_variables) {
      const rawNode = figma.graph.getNode(node.id)
      if (rawNode) updatePathwayData(rawNode, { stateVariables: parseStateVariables(spec.state_variables) })
    }
    if (spec.clone_marker) {
      const rawNode = figma.graph.getNode(node.id)
      if (rawNode) updatePathwayData(rawNode, { cloneMarker: true })
    }

    if (parentId) {
      const parent = figma.getNodeById(parentId)
      if (parent) parent.appendChild(node)
    }

    if (nameToId.has(spec.name)) nameCollisions.push(spec.name)
    nameToId.set(spec.name, node.id)
    ids.push(node.id)
  }
  return ids
}

function createProcesses(
  figma: FigmaLike,
  specs: ProcessSpec[],
  nameToId: Map<string, string>,
  nameCollisions: string[]
): string[] {
  const ids: string[] = []
  for (const spec of specs) {
    const parentId = spec.compartment ? nameToId.get(spec.compartment) : undefined
    const node = figma.createPathwayProcess(spec.process_type, {
      name: spec.name, x: spec.x ?? 0, y: spec.y ?? 0
    })

    if (parentId) {
      const parent = figma.getNodeById(parentId)
      if (parent) parent.appendChild(node)
    }

    if (nameToId.has(spec.name)) nameCollisions.push(spec.name)
    nameToId.set(spec.name, node.id)
    ids.push(node.id)
  }
  return ids
}

function createArcs(
  figma: FigmaLike,
  specs: ArcSpec[],
  nameToId: Map<string, string>
): { ids: string[]; skipped: string[] } {
  const ids: string[] = []
  const skipped: string[] = []
  for (const spec of specs) {
    const sourceId = nameToId.get(spec.source)
    const targetId = nameToId.get(spec.target)
    if (!sourceId || !targetId) {
      skipped.push(`${spec.source} → ${spec.target} (${!sourceId ? `source "${spec.source}" not found` : `target "${spec.target}" not found`})`)
      continue
    }
    const node = figma.createPathwayArc(spec.arc_type, sourceId, targetId, {
      name: `${spec.source} → ${spec.target}`
    })
    ids.push(node.id)
  }
  return { ids, skipped }
}

export const createPathway = defineTool({
  name: 'create_pathway',
  mutates: true,
  description:
    'Create a complete SBGN pathway diagram from structured JSON specs. For complex pathways (>5 nodes), use begin_pathway + add_compartment/add_entity/add_process/add_arc + end_pathway instead to avoid browser freezing. This tool is best for simple diagrams only.',
  params: {
    compartments: {
      type: 'string',
      description: 'JSON array of compartment specs: [{name, x?, y?, width?, height?}]',
      required: true
    },
    entities: {
      type: 'string',
      description: 'JSON array of entity specs: [{name, glyph_type, x?, y?, width?, height?, compartment?, state_variables?, clone_marker?}]',
      required: true
    },
    processes: {
      type: 'string',
      description: 'JSON array of process specs: [{name, process_type, x?, y?, compartment?}]',
      required: true
    },
    arcs: {
      type: 'string',
      description: 'JSON array of arc specs: [{source, target, arc_type}]',
      required: true
    }
  },
  execute: (figma, args) => {
    const compartments = parseSpecs<CompartmentSpec>(args.compartments, 'compartments')
    if ('error' in compartments) return compartments
    const entities = parseSpecs<EntitySpec>(args.entities, 'entities')
    if ('error' in entities) return entities
    const processes = parseSpecs<ProcessSpec>(args.processes, 'processes')
    if ('error' in processes) return processes
    const arcs = parseSpecs<ArcSpec>(args.arcs, 'arcs')
    if ('error' in arcs) return arcs

    const nameToId = new Map<string, string>()
    const nameCollisions: string[] = []

    figma.beginBatch()
    try {
      const compartmentIds = createCompartments(figma, compartments, nameToId, nameCollisions)
      const entityIds = createEntities(figma, entities, nameToId, nameCollisions)
      const processIds = createProcesses(figma, processes, nameToId, nameCollisions)
      const { ids: arcIds, skipped: skippedArcs } = createArcs(figma, arcs, nameToId)

      const pageId = figma.currentPage.id
      hierarchicalLayout(figma.graph, pageId, { direction: 'top-bottom', spacing: 60 })
      computeOrthogonalBendPoints(figma.graph, pageId, 'top-bottom')

      if (figma.pathwayStyle !== 'publication') {
        figma.setPathwayStyle('publication')
      }

      const result: Record<string, unknown> = {
        created: { compartments: compartmentIds, entities: entityIds, processes: processIds, arcs: arcIds },
        summary: `Created ${compartmentIds.length} compartments, ${entityIds.length} entities, ${processIds.length} processes, ${arcIds.length} arcs`
      }

      const existingWarnings = (result.warnings as string[] | undefined) ?? []
      if (skippedArcs.length > 0) {
        result.warnings = [...existingWarnings, ...skippedArcs.map(s => `Skipped arc: ${s}`)]
      }
      const updatedWarnings = (result.warnings as string[] | undefined) ?? []
      if (nameCollisions.length > 0) {
        result.warnings = [...updatedWarnings, ...nameCollisions.map(n => `Duplicate name "${n}" — later node shadows earlier, arcs may connect to wrong node`)]
      }

      return result
    } finally {
      figma.endBatch()
    }
  }
})
