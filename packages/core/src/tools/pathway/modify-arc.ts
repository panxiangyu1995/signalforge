import type { PathwayArcType } from '@signal-forge/scene-graph'
import { updatePathwayData } from '@signal-forge/scene-graph'

import { defineTool, nodeNotFound } from '#core/tools/schema'

const ARC_TYPES: readonly string[] = [
  'consumption', 'production', 'modulation', 'stimulation',
  'catalysis', 'inhibition', 'necessary_stimulation', 'trigger',
  'logic_and', 'logic_or', 'logic_not', 'equivalence'
]

export const removeArc = defineTool({
  name: 'remove_arc',
  mutates: true,
  description: 'Remove a pathway arc by its node ID. Does not cascade-delete connected entities or processes — only the arc itself is removed.',
  params: {
    node_id: {
      type: 'string',
      description: 'ID of the PATHWAY_ARC node to remove',
      required: true
    }
  },
  execute: (figma, args) => {
    const node = figma.graph.getNode(args.node_id)
    if (!node) return nodeNotFound(args.node_id)
    if (node.type !== 'PATHWAY_ARC') return { error: `Node ${args.node_id} is not a PATHWAY_ARC` }
    const name = node.name
    figma.graph.deleteNode(args.node_id)
    return { removed: true, id: args.node_id, name }
  }
})

export const modifyArc = defineTool({
  name: 'modify_arc',
  mutates: true,
  description: 'Modify an existing pathway arc — change its type, source, or target.',
  params: {
    node_id: {
      type: 'string',
      description: 'ID of the PATHWAY_ARC node to modify',
      required: true
    },
    arc_type: {
      type: 'string',
      description: 'New arc type',
      enum: ARC_TYPES as [string, ...string[]]
    },
    source_id: {
      type: 'string',
      description: 'New source node ID'
    },
    target_id: {
      type: 'string',
      description: 'New target node ID'
    }
  },
  execute: (figma, args) => {
    const node = figma.graph.getNode(args.node_id)
    if (!node) return nodeNotFound(args.node_id)
    if (node.type !== 'PATHWAY_ARC') return { error: `Node ${args.node_id} is not a PATHWAY_ARC` }

    const updates: Record<string, unknown> = {}

    if (args.arc_type) {
      if (!ARC_TYPES.includes(args.arc_type)) {
        return { error: `Invalid arc_type: ${args.arc_type}. Must be one of: ${ARC_TYPES.join(', ')}` }
      }
      updates.arcType = args.arc_type as PathwayArcType
    }

    if (args.source_id) updates.sourceId = args.source_id
    if (args.target_id) updates.targetId = args.target_id

    if (Object.keys(updates).length === 0) {
      return { error: 'No modifications specified. Provide arc_type, source_id, or target_id.' }
    }

    updatePathwayData(node, updates)
    return { id: node.id, name: node.name, updated: Object.keys(updates) }
  }
})
