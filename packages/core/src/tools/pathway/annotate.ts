import { defineTool, nodeNotFound } from '#core/tools/schema'
import {
  PATHWAY_PLUGIN_ID,
  LEGACY_PATHWAY_PLUGIN_ID,
  ANNOTATION_PLUGIN_KEY,
  type PathwayAnnotation,
  type PathwayAnnotationType
} from '@signal-forge/scene-graph'

const VALID_ANNOTATION_TYPES: readonly string[] = ['doi', 'pmid', 'url', 'comment']

export const annotatePathway = defineTool({
  name: 'annotate_pathway',
  mutates: true,
  description:
    'Add a literature reference or annotation to a pathway node or the current page. Supports DOI, PubMed ID, URL, and free-text comments.',
  params: {
    node_id: {
      type: 'string',
      description: 'Node ID to annotate. If omitted, annotates the current page (pathway-level annotation).'
    },
    type: {
      type: 'string',
      description: 'Annotation type',
      required: true,
      enum: VALID_ANNOTATION_TYPES as [string, ...string[]]
    },
    value: {
      type: 'string',
      description: 'Annotation value (e.g., "10.1234/example", "12345678", "https://reactome.org/...")',
      required: true
    }
  },
  execute: (figma, args) => {
    const trimmedValue = args.value.trim()
    if (!trimmedValue) return { error: 'Annotation value must not be empty' }
    if (trimmedValue.length > 2048) return { error: 'Annotation value exceeds maximum length (2048 characters)' }

    if (!VALID_ANNOTATION_TYPES.includes(args.type)) {
      return { error: `Invalid annotation type: ${args.type}. Must be one of: ${VALID_ANNOTATION_TYPES.join(', ')}` }
    }

    const annotation: PathwayAnnotation = { type: args.type as PathwayAnnotationType, value: trimmedValue }

    const targetId = args.node_id ?? figma.currentPage.id
    const target = figma.graph.getNode(targetId)
    if (!target) return nodeNotFound(targetId)

    const idx = target.pluginData.findIndex(
      e => (e.pluginId === PATHWAY_PLUGIN_ID || e.pluginId === LEGACY_PATHWAY_PLUGIN_ID) && e.key === ANNOTATION_PLUGIN_KEY
    )

    const annotations: PathwayAnnotation[] = idx !== -1
      ? (() => { try { return JSON.parse(target.pluginData[idx].value) as PathwayAnnotation[] } catch { return [] } })()
      : []

    annotations.push(annotation)

    const entry = { pluginId: PATHWAY_PLUGIN_ID, key: ANNOTATION_PLUGIN_KEY, value: JSON.stringify(annotations) }
    if (idx !== -1) target.pluginData[idx] = entry
    else target.pluginData.push(entry)

    return { id: targetId, annotation, total_annotations: annotations.length }
  }
})
