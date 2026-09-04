import { defineTool } from '#core/tools/schema'
import { readSbgnMl } from '#core/io/formats/sbgn-ml/read'
import { writeSbgnMl } from '#core/io/formats/sbgn-ml/write'
import { getPathwayData, updatePathwayData } from '@signal-forge/scene-graph'

export const importSbgnMl = defineTool({
  name: 'import_sbgn_ml',
  mutates: true,
  description:
    'Import an SBGN-ML pathway diagram from raw XML content. Creates pathway nodes on the current page preserving compartment hierarchy. For very large SBGN-ML files (>1MB), consider using the open_file tool with a .sbgn file path instead.',
  params: {
    xml_content: {
      type: 'string',
      description: 'SBGN-ML XML string to import',
      required: true
    }
  },
  execute: (figma, args) => {
    try {
      const sourceGraph = readSbgnMl(args.xml_content)

      const sourcePages = sourceGraph.getPages()
      const sourcePage = sourcePages[0]

      const targetPageId = figma.currentPage.id
      const targetPage = figma.graph.getNode(targetPageId)
      if (!targetPage) return { error: 'No current page' }

      const idMap = new Map<string, string>()
      let compartments = 0
      let entities = 0
      let processes = 0
      let arcs = 0

      function cloneNodeRecursive(sourceId: string, targetParentId: string): void {
        const sourceNode = sourceGraph.getNode(sourceId)
        if (!sourceNode) return

        const newNode = figma.graph.createNode(sourceNode.type, targetParentId, {
          name: sourceNode.name,
          x: sourceNode.x,
          y: sourceNode.y,
          width: sourceNode.width,
          height: sourceNode.height,
        })

        const pathwayData = getPathwayData(sourceNode)
        if (pathwayData) {
          const cloned = { ...pathwayData }
          if (cloned.sourceId) delete cloned.sourceId
          if (cloned.targetId) delete cloned.targetId
          updatePathwayData(newNode, cloned)
        }

        for (const entry of sourceNode.pluginData) {
          if (entry.pluginId === 'signal-forge' || entry.pluginId === 'open-pencil' && entry.key === 'pathway') continue
          const existing = newNode.pluginData.findIndex(e => e.pluginId === entry.pluginId && e.key === entry.key)
          if (existing !== -1) newNode.pluginData[existing] = entry
          else newNode.pluginData.push(entry)
        }

        idMap.set(sourceId, newNode.id)

        if (sourceNode.type === 'COMPARTMENT') compartments++
        else if (sourceNode.type === 'PATHWAY_GLYPH') entities++
        else if (sourceNode.type === 'PATHWAY_PROCESS') processes++
        else if (sourceNode.type === 'PATHWAY_ARC') arcs++

        for (const childId of sourceNode.childIds) {
          cloneNodeRecursive(childId, newNode.id)
        }
      }

      for (const childId of sourcePage.childIds) {
        cloneNodeRecursive(childId, targetPageId)
      }

      for (const [oldId, newId] of idMap) {
        const oldNode = sourceGraph.getNode(oldId)
        if (oldNode?.type !== 'PATHWAY_ARC') continue

        const oldData = getPathwayData(oldNode)
        if (!oldData?.sourceId || !oldData.targetId) continue

        const newSourceId = idMap.get(oldData.sourceId)
        const newTargetId = idMap.get(oldData.targetId)
        if (!newSourceId || !newTargetId) continue

        const newNode = figma.graph.getNode(newId)
        if (!newNode) continue

        updatePathwayData(newNode, {
          sourceId: newSourceId,
          targetId: newTargetId,
        })
      }

      return {
        imported: { compartments, entities, processes, arcs },
        summary: `Imported ${compartments} compartments, ${entities} entities, ${processes} processes, ${arcs} arcs`
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { error: `SBGN-ML import failed: ${message}` }
    }
  }
})

export const exportSbgnMl = defineTool({
  name: 'export_sbgn_ml',
  mutates: false,
  description:
    'Export the current pathway diagram as SBGN-ML XML. Returns the XML content for interoperability with Newt, CellDesigner, PathVisio, and other SBGN tools.',
  params: {},
  execute: (figma) => {
    try {
      const xml = writeSbgnMl(figma.graph)
      return {
        xml,
        summary: `Exported pathway as SBGN-ML (${xml.length} characters)`
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { error: `SBGN-ML export failed: ${message}` }
    }
  }
})
