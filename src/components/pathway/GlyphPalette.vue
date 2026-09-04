<script setup lang="ts">
import type {
  PathwayGlyphType,
  PathwayProcessType,
  PathwayArcType
} from '@signal-forge/scene-graph'

import { GLYPH_PALETTE_ENTITIES, GLYPH_PALETTE_PROCESSES, GLYPH_PALETTE_ARCS } from './labels'
import GlyphButton from './GlyphButton.vue'
import ArcButton from './ArcButton.vue'

const { activeGlyphType, activeArcType } = defineProps<{
  activeGlyphType: PathwayGlyphType | null
  activeArcType: PathwayArcType | null
}>()

const emit = defineEmits<{
  selectGlyph: [type: PathwayGlyphType]
  selectProcess: [type: PathwayProcessType]
  selectArc: [type: PathwayArcType]
}>()

const entities = GLYPH_PALETTE_ENTITIES
const processes = GLYPH_PALETTE_PROCESSES
const arcs = GLYPH_PALETTE_ARCS
</script>

<template>
  <div class="flex flex-col gap-3 p-3">
    <div>
      <h3 class="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Entities
      </h3>
      <div class="grid grid-cols-2 gap-1">
        <GlyphButton
          v-for="e in entities"
          :key="e.type"
          :glyph-type="e.type"
          :label="e.label"
          :active="activeGlyphType === e.type"
          @click="emit('selectGlyph', e.type)"
        />
      </div>
    </div>

    <div>
      <h3 class="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Processes
      </h3>
      <div class="grid grid-cols-2 gap-1">
        <GlyphButton
          v-for="p in processes"
          :key="p.type"
          :glyph-type="p.type"
          :label="p.label"
          :active="false"
          @click="emit('selectProcess', p.type)"
        />
      </div>
    </div>

    <div>
      <h3 class="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Arcs
      </h3>
      <div class="grid grid-cols-2 gap-1">
        <ArcButton
          v-for="a in arcs"
          :key="a.type"
          :arc-type="a.type"
          :label="a.label"
          :active="activeArcType === a.type"
          @click="emit('selectArc', a.type)"
        />
      </div>
    </div>
  </div>
</template>
