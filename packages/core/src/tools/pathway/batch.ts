import { defineTool } from '#core/tools/schema'

export const beginPathway = defineTool({
  name: 'begin_pathway',
  mutates: true,
  description: 'Begin a pathway construction batch. Call this before add_compartment/add_entity/add_process/add_arc calls. Suppresses intermediate rendering and undo snapshots for performance. Must be paired with end_pathway.',
  params: {},
  execute: (figma, _args) => {
    figma.beginPathwayBatch()
    return { status: 'batch started', hint: 'Now call add_compartment, add_entity, add_process, add_arc, then end_pathway' }
  }
})

export const endPathway = defineTool({
  name: 'end_pathway',
  mutates: true,
  description: 'End a pathway construction batch. Computes layout, renders the pathway, and creates an undo entry. Call this after all add_* calls in a begin_pathway/end_pathway sequence.',
  params: {},
  execute: (figma, _args) => {
    if (!figma.pathwayBatch) {
      return { error: 'No active pathway batch. Call begin_pathway first.' }
    }
    figma.endPathwayBatch()
    if (figma.pathwayStyle !== 'realistic' && figma.pathwayStyle !== 'publication') {
      figma.setPathwayStyle('realistic')
    }
    return { status: 'batch ended', hint: 'Layout and rendering will be computed by the post-processing step' }
  }
})
