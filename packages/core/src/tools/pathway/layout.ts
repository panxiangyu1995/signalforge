import { resolveCollisions } from '#core/pathway/layout/collision'
import { hierarchicalLayout } from '#core/pathway/layout/hierarchical'
import { computeOrthogonalBendPoints } from '#core/pathway/layout/orthogonal'
import { defineTool } from '#core/tools/schema'

export const autoLayoutPathway = defineTool({
  name: 'auto_layout_pathway',
  mutates: true,
  description:
    'Automatically layout pathway nodes using hierarchical layering and orthogonal edge routing. Arranges signal flow top-to-bottom with non-overlapping nodes.',
  params: {
    page_id: { type: 'string', description: 'Page ID to layout (defaults to current page)' },
    direction: {
      type: 'string',
      description: 'Signal flow direction',
      enum: ['top-bottom', 'left-right']
    },
    spacing: { type: 'number', description: 'Minimum spacing between nodes in pixels', min: 20 },
    algorithm: {
      type: 'string',
      description:
        'Layout algorithm. "hierarchical" uses custom topological sort; "elk" uses ELK.js layered layout for better crossing minimization (not yet available).',
      enum: ['hierarchical', 'elk']
    }
  },
  execute: (figma, args) => {
    const pageId = args.page_id ?? figma.currentPage.id
    const direction = (args.direction ?? 'top-bottom') as 'top-bottom' | 'left-right'
    const spacing = args.spacing ?? 60
    const algorithm = args.algorithm ?? 'hierarchical'

    if (algorithm === 'elk') {
      return { error: 'ELK layout not yet available. Use algorithm="hierarchical".' }
    }

    const result = hierarchicalLayout(figma.graph, pageId, { direction, spacing })
    resolveCollisions(figma.graph, pageId, 20)
    const bendCount = computeOrthogonalBendPoints(figma.graph, pageId)

    return {
      positioned: result.positioned,
      layers: result.layers,
      bend_points_computed: bendCount,
      algorithm: 'hierarchical',
      summary: `Layout complete: ${result.positioned} nodes in ${result.layers} layers, ${bendCount} arcs routed (${direction}, ${spacing}px spacing, hierarchical)`
    }
  }
})
