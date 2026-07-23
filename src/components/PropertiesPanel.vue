<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger, TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

import { useI18n, useSelectionState } from '@signal-forge/vue'

import { useAIChat } from '@/app/ai/chat/use'
import { PATHWAY_NODE_TYPES, usePathwayMode } from '@/app/pathway/use'

import ChatPanel from './ChatPanel.vue'
import DesignPanel from './DesignPanel.vue'
import PathwayInspector from './pathway/PathwayInspector.vue'
import ZoomDropdown from './editor/ZoomDropdown.vue'

const { activeTab } = useAIChat()
const { panels } = useI18n()
const { isPathwayMode } = usePathwayMode()
const { selectedNode } = useSelectionState()

const hasPathwaySelection = computed(() => {
  const type = selectedNode.value?.type
  return type != null && PATHWAY_NODE_TYPES.has(type)
})

const inspectorOpen = ref(true)

watch(hasPathwaySelection, (selected) => {
  if (selected) inspectorOpen.value = true
})

const inspectorLabel = computed(() => {
  const node = selectedNode.value
  if (!node) return ''
  const typeLabels: Record<string, string> = {
    PATHWAY_GLYPH: 'Glyph',
    PATHWAY_PROCESS: 'Process',
    PATHWAY_ARC: 'Arc',
    COMPARTMENT: 'Compartment',
  }
  return `${typeLabels[node.type] ?? node.type}: ${node.name}`
})

watch(isPathwayMode, (pathway) => {
  if (pathway && activeTab.value === 'design') {
    activeTab.value = 'ai'
  }
})
</script>

<template>
  <aside
    data-test-id="properties-panel"
    class="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-panel"
    style="contain: paint layout style"
  >
    <!-- Pathway mode: AI-First, ChatPanel full space + collapsible inspector -->
    <template v-if="isPathwayMode">
      <ChatPanel class="flex min-h-0 flex-1 flex-col" />

      <CollapsibleRoot
        v-if="hasPathwaySelection"
        v-model:open="inspectorOpen"
        class="shrink-0 border-t border-border"
      >
        <CollapsibleTrigger
          class="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted hover:text-surface"
        >
          <icon-lucide-chevron-down class="size-3 transition-transform [[data-state=closed]>&]:-rotate-90" />
          <span class="truncate">{{ inspectorLabel }}</span>
        </CollapsibleTrigger>
        <CollapsibleContent class="max-h-[40vh] overflow-hidden">
          <PathwayInspector />
        </CollapsibleContent>
      </CollapsibleRoot>
    </template>

    <!-- Design mode: Design + AI tabs -->
    <TabsRoot v-else v-model="activeTab" class="flex min-h-0 flex-1 flex-col">
      <TabsList class="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
        <TabsTrigger
          value="design"
          data-test-id="properties-tab-design"
          class="rounded px-2.5 py-1 text-xs text-muted hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface"
        >
          {{ panels.design }}
        </TabsTrigger>
        <TabsTrigger
          value="ai"
          data-test-id="properties-tab-ai"
          class="flex items-center gap-1 rounded px-2.5 py-1 text-xs text-muted hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface"
        >
          <icon-lucide-sparkles class="size-3" />
          {{ panels.ai }}
        </TabsTrigger>
        <ZoomDropdown v-if="activeTab === 'design'" />
      </TabsList>

      <TabsContent
        value="design"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'design'"
      >
        <DesignPanel />
      </TabsContent>

      <TabsContent
        value="ai"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'ai'"
      >
        <ChatPanel />
      </TabsContent>
    </TabsRoot>
  </aside>
</template>
