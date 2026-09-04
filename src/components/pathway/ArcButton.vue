<script setup lang="ts">
import type { PathwayArcType } from '@signal-forge/scene-graph'

const { arcType, label, active } = defineProps<{
  arcType: PathwayArcType
  label: string
  active: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const arcSvgs: Record<string, string> = {
  production:
    '<line x1="4" y1="20" x2="36" y2="20" stroke="#555" stroke-width="1.5"/><polygon points="36,16 44,20 36,24" fill="#555"/>',
  consumption: '<line x1="4" y1="20" x2="40" y2="20" stroke="#555" stroke-width="1.5"/>',
  catalysis:
    '<line x1="4" y1="20" x2="30" y2="20" stroke="#555" stroke-width="1.5"/><circle cx="34" cy="20" r="4" fill="none" stroke="#555" stroke-width="1.5"/><line x1="38" y1="20" x2="44" y2="20" stroke="#555" stroke-width="1.5"/>',
  inhibition:
    '<line x1="4" y1="20" x2="40" y2="20" stroke="#555" stroke-width="1.5"/><line x1="40" y1="14" x2="40" y2="26" stroke="#555" stroke-width="2"/>',
  stimulation:
    '<line x1="4" y1="20" x2="36" y2="20" stroke="#555" stroke-width="1.5"/><polygon points="36,16 44,20 36,24" fill="none" stroke="#555" stroke-width="1.5"/>',
  necessary_stimulation:
    '<line x1="4" y1="20" x2="36" y2="20" stroke="#555" stroke-width="1.5"/><polygon points="36,16 44,20 36,24" fill="#555"/>',
  modulation:
    '<line x1="4" y1="20" x2="30" y2="20" stroke="#555" stroke-width="1.5"/><polygon points="34,16 38,20 34,24 30,20" fill="none" stroke="#555" stroke-width="1.5"/><line x1="38" y1="20" x2="44" y2="20" stroke="#555" stroke-width="1.5"/>',
  trigger:
    '<line x1="4" y1="20" x2="36" y2="20" stroke="#555" stroke-width="1.5"/><polygon points="36,16 44,20 36,24" fill="#555"/><line x1="36" y1="14" x2="36" y2="26" stroke="#555" stroke-width="1.5"/>',
  logic_and:
    '<line x1="4" y1="20" x2="40" y2="20" stroke="#555" stroke-width="1.5"/><text x="22" y="16" text-anchor="middle" font-size="8" fill="#555">AND</text>',
  logic_or:
    '<line x1="4" y1="20" x2="40" y2="20" stroke="#555" stroke-width="1.5"/><text x="22" y="16" text-anchor="middle" font-size="8" fill="#555">OR</text>',
  logic_not:
    '<line x1="4" y1="20" x2="40" y2="20" stroke="#555" stroke-width="1.5"/><line x1="40" y1="14" x2="40" y2="26" stroke="#555" stroke-width="2"/>',
  equivalence:
    '<line x1="4" y1="20" x2="36" y2="20" stroke="#555" stroke-width="1.5"/><polygon points="36,16 44,20 36,24" fill="#555"/><polygon points="8,16 4,20 8,24" fill="#555"/>'
}
</script>

<template>
  <button
    class="flex flex-col items-center gap-0.5 rounded-md p-1.5 text-xs transition-colors hover:bg-accent/10"
    :class="{ 'bg-accent/15 ring-1 ring-accent/30': active }"
    @click="emit('click')"
  >
    <svg
      width="48"
      height="40"
      viewBox="0 0 48 40"
      class="shrink-0"
      v-html="arcSvgs[arcType] ?? arcSvgs['consumption']"
    />
    <span class="truncate text-[10px] leading-tight text-muted-foreground">{{ label }}</span>
  </button>
</template>
