import { defineTool } from '#core/tools/schema'
import { applyExpressionOverlay, blueWhiteRedScale } from '#core/pathway/overlay'

export const overlayExpressionData = defineTool({
  name: 'overlay_expression_data',
  mutates: true,
  description:
    'Overlay gene expression data onto pathway entities. Maps expression values to entity fill colors using a blue-white-red color scale (down-regulated=blue, neutral=white, up-regulated=red).',
  params: {
    data_json: {
      type: 'string',
      description: 'JSON object mapping entity name to expression value (-1 to 1). Keys must match entity labels exactly. Example: \'{"EGFR": 0.8, "JAK2": -0.5}\'',
      required: true
    },
    page_id: {
      type: 'string',
      description: 'Page ID to apply overlay to (defaults to current page)'
    }
  },
  execute: (figma, args) => {
    let parsed: Record<string, number>
    try {
      parsed = JSON.parse(args.data_json)
    } catch {
      return { error: 'Invalid JSON in data_json parameter' }
    }

    const pageId = args.page_id ?? figma.currentPage.id
    const dataMap = new Map<string, number>(Object.entries(parsed))

    const updated = applyExpressionOverlay(figma.graph, pageId, dataMap, blueWhiteRedScale)

    return {
      entities_updated: updated,
      entities_in_data: dataMap.size,
      summary: `Applied expression overlay: ${updated}/${dataMap.size} entities colored`
    }
  }
})
