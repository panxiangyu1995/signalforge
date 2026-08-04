<script setup lang="ts">
import type { SceneNode, PathwayNodeData } from '@signal-forge/scene-graph'

import { useI18n } from '@signal-forge/vue'

import { useEditorStore } from '@/app/editor/active-store'
import NumberField from '@/components/inputs/NumberField.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

const props = defineProps<{
  node: SceneNode
  data: PathwayNodeData
}>()

const store = useEditorStore()
const { panels } = useI18n()

function updateLabel(value: string) {
  store.renameNode(props.node.id, value)
}

function updatePosition(axis: 'x' | 'y', value: number) {
  store.updateNodeWithUndo(props.node.id, { [axis]: value }, `Set ${axis}`)
}

function updateSize(dim: 'width' | 'height', value: number) {
  store.updateNodeWithUndo(props.node.id, { [dim]: value }, `Set ${dim}`)
}
</script>

<template>
  <div class="scrollbar-thin overflow-x-hidden overflow-y-auto">
    <PanelSection :label="panels.inspector">
      <div class="flex flex-col gap-2 px-3 py-1.5">
        <label class="flex flex-col gap-1">
          <span class="text-[11px] text-muted">Label</span>
          <input
            :value="node.name"
            class="rounded border border-border bg-panel px-2 py-1 text-xs text-surface outline-none focus:border-accent"
            @change="updateLabel(($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
    </PanelSection>

    <PanelSection :label="panels.position">
      <div class="grid grid-cols-2 gap-1.5 px-3 py-1.5">
        <NumberField
          :model-value="node.x"
          label="X"
          @update:model-value="updatePosition('x', $event)"
        />
        <NumberField
          :model-value="node.y"
          label="Y"
          @update:model-value="updatePosition('y', $event)"
        />
        <NumberField
          :model-value="node.width"
          label="W"
          @update:model-value="updateSize('width', $event)"
        />
        <NumberField
          :model-value="node.height"
          label="H"
          @update:model-value="updateSize('height', $event)"
        />
      </div>
    </PanelSection>
  </div>
</template>
