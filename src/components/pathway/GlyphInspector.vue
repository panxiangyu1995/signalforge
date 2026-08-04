<script setup lang="ts">
import type { SceneNode, PathwayNodeData } from '@signal-forge/scene-graph'

import { computeUpdatedPluginData } from '@signal-forge/scene-graph'
import { useI18n } from '@signal-forge/vue'

import { useEditorStore } from '@/app/editor/active-store'
import NumberField from '@/components/inputs/NumberField.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import { GLYPH_TYPE_LABELS } from './labels'

const { node, data } = defineProps<{
  node: SceneNode
  data: PathwayNodeData
}>()

const store = useEditorStore()
const { panels } = useI18n()

const glyphType = data.glyphType ?? 'unspecified_entity'

function updateLabel(value: string) {
  store.renameNode(node.id, value)
}

function addStateVariable() {
  const vars = [...(data.stateVariables ?? []), { variable: '', value: undefined }]
  store.updateNodeWithUndo(node.id, { pluginData: computeUpdatedPluginData(node, { stateVariables: vars }) }, 'Add state variable')
}

function removeStateVariable(index: number) {
  const vars = [...(data.stateVariables ?? [])]
  vars.splice(index, 1)
  store.updateNodeWithUndo(node.id, { pluginData: computeUpdatedPluginData(node, { stateVariables: vars }) }, 'Remove state variable')
}

function updateStateVariable(index: number, field: 'variable' | 'value', value: string) {
  const vars = [...(data.stateVariables ?? [])]
  vars[index] = { ...vars[index], [field]: value || undefined }
  store.updateNodeWithUndo(node.id, { pluginData: computeUpdatedPluginData(node, { stateVariables: vars }) }, 'Update state variable')
}

function addUnitOfInformation() {
  const units = [...(data.unitOfInformation ?? []), { text: '' }]
  store.updateNodeWithUndo(node.id, { pluginData: computeUpdatedPluginData(node, { unitOfInformation: units }) }, 'Add unit of information')
}

function removeUnitOfInformation(index: number) {
  const units = [...(data.unitOfInformation ?? [])]
  units.splice(index, 1)
  store.updateNodeWithUndo(node.id, { pluginData: computeUpdatedPluginData(node, { unitOfInformation: units }) }, 'Remove unit of information')
}

function updateUnitOfInformation(index: number, text: string) {
  const units = [...(data.unitOfInformation ?? [])]
  units[index] = { text }
  store.updateNodeWithUndo(node.id, { pluginData: computeUpdatedPluginData(node, { unitOfInformation: units }) }, 'Update unit of information')
}

function toggleCloneMarker() {
  store.updateNodeWithUndo(node.id, { pluginData: computeUpdatedPluginData(node, { cloneMarker: !data.cloneMarker }) }, 'Toggle clone marker')
}

function updatePosition(axis: 'x' | 'y', value: number) {
  store.updateNodeWithUndo(node.id, { [axis]: value }, `Set ${axis}`)
}

function updateSize(dim: 'width' | 'height', value: number) {
  store.updateNodeWithUndo(node.id, { [dim]: value }, `Set ${dim}`)
}
</script>

<template>
  <div class="scrollbar-thin overflow-x-hidden overflow-y-auto">
    <PanelSection :label="panels.glyphType">
      <div class="px-3 py-1.5 text-xs text-muted">
        {{ GLYPH_TYPE_LABELS[glyphType] ?? glyphType }}
      </div>
    </PanelSection>

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

    <PanelSection :label="panels.stateVariable">
      <div class="flex flex-col gap-1.5 px-3 py-1.5">
        <div
          v-for="(sv, i) in data.stateVariables ?? []"
          :key="i"
          class="flex items-center gap-1"
        >
          <input
            :value="sv.variable"
            placeholder="variable"
            class="min-w-0 flex-1 rounded border border-border bg-panel px-1.5 py-0.5 text-[11px] text-surface outline-none focus:border-accent"
            @change="updateStateVariable(i, 'variable', ($event.target as HTMLInputElement).value)"
          />
          <input
            :value="sv.value ?? ''"
            placeholder="value"
            class="min-w-0 flex-1 rounded border border-border bg-panel px-1.5 py-0.5 text-[11px] text-surface outline-none focus:border-accent"
            @change="updateStateVariable(i, 'value', ($event.target as HTMLInputElement).value)"
          />
          <button
            class="shrink-0 rounded p-0.5 text-muted hover:bg-hover hover:text-surface"
            @click="removeStateVariable(i)"
          >
            <icon-lucide-x class="size-3" />
          </button>
        </div>
        <button
          class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-surface"
          @click="addStateVariable"
        >
          <icon-lucide-plus class="size-3" />
          {{ panels.addStateVariable }}
        </button>
      </div>
    </PanelSection>

    <PanelSection :label="panels.unitOfInformation">
      <div class="flex flex-col gap-1.5 px-3 py-1.5">
        <div
          v-for="(uoi, i) in data.unitOfInformation ?? []"
          :key="i"
          class="flex items-center gap-1"
        >
          <input
            :value="uoi.text"
            placeholder="text"
            class="min-w-0 flex-1 rounded border border-border bg-panel px-1.5 py-0.5 text-[11px] text-surface outline-none focus:border-accent"
            @change="updateUnitOfInformation(i, ($event.target as HTMLInputElement).value)"
          />
          <button
            class="shrink-0 rounded p-0.5 text-muted hover:bg-hover hover:text-surface"
            @click="removeUnitOfInformation(i)"
          >
            <icon-lucide-x class="size-3" />
          </button>
        </div>
        <button
          class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover hover:text-surface"
          @click="addUnitOfInformation"
        >
          <icon-lucide-plus class="size-3" />
          {{ panels.addUnitOfInformation }}
        </button>
      </div>
    </PanelSection>

    <PanelSection :label="panels.compartment">
      <div class="px-3 py-1.5 text-xs text-muted">
        {{ data.compartmentRef ?? '—' }}
      </div>
    </PanelSection>

    <PanelSection :label="panels.cloneMarker">
      <div class="px-3 py-1.5">
        <button
          class="flex items-center gap-2 text-xs"
          @click="toggleCloneMarker"
        >
          <span
            class="flex size-4 items-center justify-center rounded border border-border"
            :class="{ 'bg-accent': data.cloneMarker }"
          >
            <icon-lucide-check v-if="data.cloneMarker" class="size-3 text-black" />
          </span>
          {{ panels.cloneMarker }}
        </button>
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
