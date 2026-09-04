import type { Vector } from './primitives'
import type { SceneNode } from './types'

export const PATHWAY_PLUGIN_ID = 'signal-forge'
export const LEGACY_PATHWAY_PLUGIN_ID = 'open-pencil'
export const PATHWAY_PLUGIN_KEY = 'pathway'
export const ANNOTATION_PLUGIN_KEY = 'pathway-annotations'

export type PathwayAnnotationType = 'doi' | 'pmid' | 'url' | 'comment'

export interface PathwayAnnotation {
  type: PathwayAnnotationType
  value: string
}

export type PathwayGlyphType =
  | 'macromolecule'
  | 'simple_chemical'
  | 'complex'
  | 'nucleic_acid_feature'
  | 'unspecified_entity'
  | 'perturbation'
  | 'phenotype'
  | 'source_sink'

export type PathwayProcessType =
  | 'process'
  | 'transport'
  | 'association'
  | 'dissociation'
  | 'omitted_process'
  | 'uncertain_process'

export type PathwayArcType =
  | 'consumption'
  | 'production'
  | 'modulation'
  | 'stimulation'
  | 'catalysis'
  | 'inhibition'
  | 'necessary_stimulation'
  | 'trigger'
  | 'logic_and'
  | 'logic_or'
  | 'logic_not'
  | 'equivalence'

export interface PathwayNodeData {
  glyphType?: PathwayGlyphType
  processType?: PathwayProcessType
  arcType?: PathwayArcType
  stateVariables?: { variable: string; value?: string }[]
  unitOfInformation?: { text: string }[]
  compartmentRef?: string
  cloneMarker?: boolean
  multimer?: boolean
  activeState?: boolean
  sourceId?: string
  targetId?: string
  sourcePort?: { side: string; x: number; y: number }
  targetPort?: { side: string; x: number; y: number }
  bendPoints?: Vector[]
  portInfo?: { ports: { side: string; x: number; y: number }[] }
}

export function getPathwayData(node: SceneNode): PathwayNodeData | null {
  const entry = node.pluginData.find(
    (e) =>
      (e.pluginId === PATHWAY_PLUGIN_ID || e.pluginId === LEGACY_PATHWAY_PLUGIN_ID) &&
      e.key === PATHWAY_PLUGIN_KEY
  )
  if (!entry) return null
  try {
    return JSON.parse(entry.value) as PathwayNodeData
  } catch {
    return null
  }
}

export function setPathwayData(node: SceneNode, data: PathwayNodeData): void {
  const json = JSON.stringify(data)
  const idx = node.pluginData.findIndex(
    (e) =>
      (e.pluginId === PATHWAY_PLUGIN_ID || e.pluginId === LEGACY_PATHWAY_PLUGIN_ID) &&
      e.key === PATHWAY_PLUGIN_KEY
  )
  if (idx !== -1) {
    node.pluginData[idx] = { pluginId: PATHWAY_PLUGIN_ID, key: PATHWAY_PLUGIN_KEY, value: json }
  } else {
    node.pluginData.push({ pluginId: PATHWAY_PLUGIN_ID, key: PATHWAY_PLUGIN_KEY, value: json })
  }
}

export function updatePathwayData(node: SceneNode, partial: Partial<PathwayNodeData>): void {
  const existing = getPathwayData(node) ?? {}
  setPathwayData(node, { ...existing, ...partial })
}

export function computeUpdatedPluginData(
  node: SceneNode,
  partial: Partial<PathwayNodeData>
): { pluginId: string; key: string; value: string }[] {
  const existing = getPathwayData(node) ?? {}
  const merged = { ...existing, ...partial }
  const json = JSON.stringify(merged)
  const idx = node.pluginData.findIndex(
    (e) =>
      (e.pluginId === PATHWAY_PLUGIN_ID || e.pluginId === LEGACY_PATHWAY_PLUGIN_ID) &&
      e.key === PATHWAY_PLUGIN_KEY
  )
  const entry = { pluginId: PATHWAY_PLUGIN_ID, key: PATHWAY_PLUGIN_KEY, value: json }
  if (idx !== -1) {
    const updated = [...node.pluginData]
    updated[idx] = entry
    return updated
  }
  return [...node.pluginData, entry]
}
