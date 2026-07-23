import { computed } from 'vue'

import type { NodeType } from '@signal-forge/scene-graph'

import { useEditorStore } from '@/app/editor/active-store'

export const PATHWAY_NODE_TYPES: Set<NodeType> = new Set([
  'PATHWAY_GLYPH',
  'PATHWAY_PROCESS',
  'PATHWAY_ARC',
  'COMPARTMENT',
])

export function usePathwayMode() {
  const store = useEditorStore()

  const isPathwayMode = computed(() => {
    void store.state.sceneVersion
    for (const node of store.graph.nodes.values()) {
      if (PATHWAY_NODE_TYPES.has(node.type)) return true
    }
    return false
  })

  return { isPathwayMode }
}
