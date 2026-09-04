<script setup lang="ts">
import type { PathwayGlyphType } from '@signal-forge/scene-graph'

const { glyphType, label, active } = defineProps<{
  glyphType: PathwayGlyphType | string
  label: string
  active: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const svgShapes: Record<string, string> = {
  macromolecule:
    '<rect x="4" y="8" width="40" height="24" rx="4" fill="#D4E6F1" stroke="#5B9BD5" stroke-width="1.5"/>',
  simple_chemical:
    '<rect x="8" y="8" width="32" height="24" rx="12" fill="#FADBD8" stroke="#E74C3C" stroke-width="1.5"/>',
  complex:
    '<polygon points="10,8 38,8 44,14 44,26 38,32 10,32 4,26 4,14" fill="#E8DAEF" stroke="#8E44AD" stroke-width="2"/>',
  nucleic_acid_feature:
    '<path d="M4,8 L44,8 L44,24 Q44,32 36,32 L12,32 Q4,32 4,24 Z" fill="#D5F5E3" stroke="#27AE60" stroke-width="1.5"/>',
  perturbation:
    '<polygon points="4,8 24,20 4,32 44,32 24,20 44,8" fill="#D1F2EB" stroke="#16A085" stroke-width="1.5"/>',
  phenotype:
    '<polygon points="12,8 36,8 48,20 36,32 12,32 0,20" fill="#FEF9E7" stroke="#F39C12" stroke-width="1.5"/>',
  source_sink:
    '<circle cx="24" cy="20" r="12" fill="none" stroke="#6A6A6A" stroke-width="1.5"/><line x1="16" y1="28" x2="32" y2="12" stroke="#6A6A6A" stroke-width="1.5"/>',
  unspecified_entity:
    '<ellipse cx="24" cy="20" rx="20" ry="12" fill="#F2F3F4" stroke="#555" stroke-width="1.5"/>',
  process:
    '<rect x="14" y="10" width="20" height="20" fill="#f6f6f6" stroke="#555" stroke-width="1.5"/>',
  transport:
    '<rect x="14" y="10" width="20" height="20" fill="#f6f6f6" stroke="#555" stroke-width="1.5"/><rect x="18" y="14" width="12" height="12" fill="none" stroke="#555" stroke-width="0.75"/>',
  association: '<circle cx="24" cy="20" r="8" fill="#6B6B6B"/>',
  dissociation:
    '<circle cx="24" cy="20" r="10" fill="none" stroke="#6A6A6A" stroke-width="1.5"/><circle cx="24" cy="20" r="5" fill="none" stroke="#6A6A6A" stroke-width="1.5"/>',
  omitted_process:
    '<rect x="14" y="10" width="20" height="20" fill="#f6f6f6" stroke="#555" stroke-width="1.5" stroke-dasharray="1,1"/>',
  uncertain_process:
    '<rect x="14" y="10" width="20" height="20" fill="#f6f6f6" stroke="#555" stroke-width="1.5" stroke-dasharray="4,2"/>'
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
      v-html="svgShapes[glyphType] ?? svgShapes['unspecified_entity']"
    />
    <span class="truncate text-[10px] leading-tight text-muted-foreground">{{ label }}</span>
  </button>
</template>
