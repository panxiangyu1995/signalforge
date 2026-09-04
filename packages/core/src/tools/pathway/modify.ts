import {
  type PathwayGlyphType,
  type PathwayProcessType,
  type PathwayArcType,
  type SceneNode,
  getPathwayData,
  updatePathwayData
} from '@signal-forge/scene-graph'

import { defineTool, nodeSummary, nodeNotFound } from '#core/tools/schema'

interface ModifyPathwayResult {
  id: string
  name: string
  type: string
  compartment?: string
  warnings?: string[]
}

function findNodeIdByName(
  figma: { graph: { getNode: (id: string) => SceneNode | undefined }; currentPageId: string },
  name: string
): { id: string; ambiguous: boolean } | null {
  const pageNode = figma.graph.getNode(figma.currentPageId)
  if (!pageNode) return null
  const stack = [...pageNode.childIds]
  let firstMatch: string | null = null
  let matchCount = 0
  while (stack.length > 0) {
    const id = stack.pop()
    if (id === undefined) break
    const node = figma.graph.getNode(id)
    if (!node) continue
    if (node.name === name) {
      if (!firstMatch) firstMatch = id
      matchCount++
    }
    stack.push(...node.childIds)
  }
  if (!firstMatch) return null
  return { id: firstMatch, ambiguous: matchCount > 1 }
}

const GLYPH_DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  macromolecule: { w: 96, h: 48 },
  simple_chemical: { w: 48, h: 48 },
  complex: { w: 96, h: 64 },
  nucleic_acid_feature: { w: 96, h: 48 },
  unspecified_entity: { w: 64, h: 48 },
  perturbation: { w: 64, h: 48 },
  phenotype: { w: 96, h: 48 },
  source_sink: { w: 36, h: 36 }
}

const PROCESS_DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  process: { w: 24, h: 24 },
  transport: { w: 24, h: 24 },
  association: { w: 24, h: 24 },
  dissociation: { w: 24, h: 24 },
  omitted_process: { w: 24, h: 24 },
  uncertain_process: { w: 24, h: 24 }
}

const GLYPH_TYPES: string[] = [
  'macromolecule',
  'simple_chemical',
  'complex',
  'nucleic_acid_feature',
  'unspecified_entity',
  'perturbation',
  'phenotype',
  'source_sink'
]

const PROCESS_TYPES: string[] = [
  'process',
  'transport',
  'association',
  'dissociation',
  'omitted_process',
  'uncertain_process'
]

const ARC_TYPES: string[] = [
  'consumption',
  'production',
  'modulation',
  'stimulation',
  'catalysis',
  'inhibition',
  'necessary_stimulation',
  'trigger',
  'logic_and',
  'logic_or',
  'logic_not',
  'equivalence'
]

export const addEntity = defineTool({
  name: 'add_entity',
  mutates: true,
  description: 'Add a single SBGN entity (glyph) to the pathway diagram.',
  params: {
    name: { type: 'string', description: 'Entity name (e.g. "JAK2", "ATP")', required: true },
    glyph_type: {
      type: 'string',
      description: 'SBGN glyph type',
      required: true,
      enum: GLYPH_TYPES
    },
    x: { type: 'number', description: 'X position (omit for auto-layout)' },
    y: { type: 'number', description: 'Y position (omit for auto-layout)' },
    compartment: {
      type: 'string',
      description: 'Parent compartment name (e.g. "Cytoplasm"). The compartment must already exist.'
    },
    state_variables: {
      type: 'string',
      description: 'Comma-separated state variables (e.g. "P@Y705,Ub")'
    },
    clone_marker: { type: 'boolean', description: 'Mark entity as a clone (gray band at bottom)' }
  },
  execute: (figma, args) => {
    const size = GLYPH_DEFAULT_SIZES[args.glyph_type] ?? { w: 96, h: 48 }
    const overrides: Partial<SceneNode> = {
      name: args.name,
      width: size.w,
      height: size.h,
      x: args.x ?? 0,
      y: args.y ?? 0
    }
    const node = figma.createPathwayGlyph(args.glyph_type as PathwayGlyphType, overrides)

    const warnings: string[] = []

    if (args.state_variables) {
      const svs = args.state_variables.split(',').map((s: string) => {
        const trimmed = s.trim()
        const atIdx = trimmed.indexOf('@')
        if (atIdx > 0) {
          return { variable: trimmed.slice(0, atIdx), value: trimmed.slice(atIdx + 1) }
        }
        return { variable: trimmed }
      })
      const rawNode = figma.graph.getNode(node.id)
      if (rawNode) updatePathwayData(rawNode, { stateVariables: svs })
    }
    if (args.clone_marker) {
      const rawNode = figma.graph.getNode(node.id)
      if (rawNode) updatePathwayData(rawNode, { cloneMarker: true })
    }

    const nameLookup = findNodeIdByName(figma, args.name)
    if (nameLookup && nameLookup.id !== node.id && nameLookup.ambiguous) {
      warnings.push(
        `Duplicate name "${args.name}" — arcs may connect to the first node with this name`
      )
    }

    if (args.compartment) {
      const compLookup = findNodeIdByName(figma, args.compartment)
      if (compLookup) {
        const parent = figma.getNodeById(compLookup.id)
        if (parent) parent.appendChild(node)
      } else {
        warnings.push(`Compartment "${args.compartment}" not found — entity placed at page root`)
      }
    }

    const result: ModifyPathwayResult = nodeSummary(node)
    if (args.compartment && warnings.length === 0) result.compartment = args.compartment
    if (warnings.length > 0) result.warnings = warnings
    return result
  }
})

export const addProcess = defineTool({
  name: 'add_process',
  mutates: true,
  description: 'Add a single SBGN process node to the pathway diagram.',
  params: {
    name: { type: 'string', description: 'Process name', required: true },
    process_type: {
      type: 'string',
      description: 'SBGN process type',
      required: true,
      enum: PROCESS_TYPES
    },
    x: { type: 'number', description: 'X position (omit for auto-layout)' },
    y: { type: 'number', description: 'Y position (omit for auto-layout)' },
    compartment: { type: 'string', description: 'Parent compartment name' }
  },
  execute: (figma, args) => {
    const size = PROCESS_DEFAULT_SIZES[args.process_type] ?? { w: 24, h: 24 }
    const overrides: Partial<SceneNode> = {
      name: args.name,
      width: size.w,
      height: size.h,
      x: args.x ?? 0,
      y: args.y ?? 0
    }
    const node = figma.createPathwayProcess(args.process_type as PathwayProcessType, overrides)

    const warnings: string[] = []

    const nameLookup = findNodeIdByName(figma, args.name)
    if (nameLookup && nameLookup.id !== node.id && nameLookup.ambiguous) {
      warnings.push(
        `Duplicate name "${args.name}" — arcs may connect to the first node with this name`
      )
    }

    if (args.compartment) {
      const compLookup = findNodeIdByName(figma, args.compartment)
      if (compLookup) {
        const parent = figma.getNodeById(compLookup.id)
        if (parent) parent.appendChild(node)
      } else {
        warnings.push(`Compartment "${args.compartment}" not found — process placed at page root`)
      }
    }

    const result: ModifyPathwayResult = nodeSummary(node)
    if (args.compartment && warnings.length === 0) result.compartment = args.compartment
    if (warnings.length > 0) result.warnings = warnings
    return result
  }
})

export const addArc = defineTool({
  name: 'add_arc',
  mutates: true,
  description:
    'Add a single SBGN arc connecting two pathway nodes. Use source/target names (preferred) or source_id/target_id node IDs.',
  params: {
    source: { type: 'string', description: 'Source node name (e.g. "JAK2")' },
    target: { type: 'string', description: 'Target node name (e.g. "STAT3 phosphorylation")' },
    source_id: { type: 'string', description: 'Source node ID (alternative to source name)' },
    target_id: { type: 'string', description: 'Target node ID (alternative to target name)' },
    arc_type: {
      type: 'string',
      description: 'SBGN arc type',
      required: true,
      enum: ARC_TYPES
    }
  },
  execute: (figma, args) => {
    let sourceId: string | undefined
    let targetId: string | undefined
    const warnings: string[] = []

    if (args.source) {
      const sourceLookup = findNodeIdByName(figma, args.source)
      if (sourceLookup) {
        sourceId = sourceLookup.id
        if (sourceLookup.ambiguous)
          warnings.push(`Multiple nodes named "${args.source}" — using first match`)
      } else if (args.source_id) {
        sourceId = args.source_id
        warnings.push(`Name "${args.source}" not found — falling back to source_id`)
      } else {
        return {
          error: `Source name "${args.source}" not found. Create the node first or provide source_id.`
        }
      }
    } else {
      sourceId = args.source_id
    }

    if (args.target) {
      const targetLookup = findNodeIdByName(figma, args.target)
      if (targetLookup) {
        targetId = targetLookup.id
        if (targetLookup.ambiguous)
          warnings.push(`Multiple nodes named "${args.target}" — using first match`)
      } else if (args.target_id) {
        targetId = args.target_id
        warnings.push(`Name "${args.target}" not found — falling back to target_id`)
      } else {
        return {
          error: `Target name "${args.target}" not found. Create the node first or provide target_id.`
        }
      }
    } else {
      targetId = args.target_id
    }

    if (!sourceId) return { error: 'Source not found. Provide source name or source_id.' }
    if (!targetId) return { error: 'Target not found. Provide target name or target_id.' }

    const sourceNode = figma.getNodeById(sourceId)
    const targetNode = figma.getNodeById(targetId)
    if (!sourceNode)
      return {
        error: `Source node "${sourceId}" not found${args.source ? ` (name lookup for "${args.source}" failed)` : ''}`
      }
    if (!targetNode)
      return {
        error: `Target node "${targetId}" not found${args.target ? ` (name lookup for "${args.target}" failed)` : ''}`
      }

    const node = figma.createPathwayArc(args.arc_type as PathwayArcType, sourceId, targetId)
    const result: ModifyPathwayResult = nodeSummary(node)
    if (warnings.length > 0) result.warnings = warnings
    return result
  }
})

export const addCompartment = defineTool({
  name: 'add_compartment',
  mutates: true,
  description:
    'Add a compartment (cell region) to the pathway diagram. Layout is computed automatically by auto_layout_pathway or end_pathway.',
  params: {
    name: {
      type: 'string',
      description: 'Compartment name (e.g. "Cytoplasm", "Nucleus")',
      required: true
    },
    x: { type: 'number', description: 'X position (omit for auto-layout)' },
    y: { type: 'number', description: 'Y position (omit for auto-layout)' },
    width: { type: 'number', description: 'Width (omit for default 800)' },
    height: { type: 'number', description: 'Height (omit for default 600)' }
  },
  execute: (figma, args) => {
    const node = figma.createCompartment(args.name, {
      x: args.x ?? 0,
      y: args.y ?? 0,
      width: args.width ?? 800,
      height: args.height ?? 600
    })
    return nodeSummary(node)
  }
})

export const setStateVariable = defineTool({
  name: 'set_state_variable',
  mutates: true,
  description:
    'Add or update a state variable badge on a pathway entity (e.g. phosphorylation state).',
  params: {
    node_id: { type: 'string', description: 'Entity node ID', required: true },
    variable: {
      type: 'string',
      description: 'State variable name (e.g. "P@Y705", "Ub")',
      required: true
    },
    value: { type: 'string', description: 'Optional value for the state variable' }
  },
  execute: (figma, args) => {
    const rawNode = figma.graph.getNode(args.node_id)
    if (!rawNode) return nodeNotFound(args.node_id)

    if (!getPathwayData(rawNode)) return { error: 'Node is not a pathway entity' }

    const sv = { variable: args.variable, value: args.value }
    updatePathwayData(rawNode, {
      stateVariables: [...(getPathwayData(rawNode)?.stateVariables ?? []), sv]
    })
    return { id: rawNode.id, name: rawNode.name, state_variable: sv }
  }
})

export const setUnitOfInformation = defineTool({
  name: 'set_unit_of_information',
  mutates: true,
  description:
    'Add a unit of information badge to a pathway entity (e.g., "MT:mtDNA", "charge:2+").',
  params: {
    node_id: { type: 'string', description: 'Entity node ID', required: true },
    text: {
      type: 'string',
      description: 'Unit of information text (e.g., "MT:mtDNA")',
      required: true
    }
  },
  execute: (figma, args) => {
    const rawNode = figma.graph.getNode(args.node_id)
    if (!rawNode) return nodeNotFound(args.node_id)

    if (!getPathwayData(rawNode)) return { error: 'Node is not a pathway entity' }

    updatePathwayData(rawNode, {
      unitOfInformation: [
        ...(getPathwayData(rawNode)?.unitOfInformation ?? []),
        { text: args.text }
      ]
    })
    return { id: rawNode.id, name: rawNode.name, unit_of_information: args.text }
  }
})

export const setPathwayStyle = defineTool({
  name: 'set_pathway_style',
  mutates: true,
  description:
    'Set the pathway rendering style. "sbgn" uses strict gray SBGN styling; "publication" uses semantic color coding with tinted fills and borders; "realistic" uses 3D-like rendering with radial gradients, highlights, shadows, and beveled edges for a photorealistic look.',
  params: {
    style: {
      type: 'string',
      description: 'Rendering style',
      required: true,
      enum: ['sbgn', 'publication', 'realistic']
    }
  },
  execute: (figma, args) => {
    figma.setPathwayStyle(args.style as 'sbgn' | 'publication' | 'realistic')
    return { style: args.style }
  }
})
