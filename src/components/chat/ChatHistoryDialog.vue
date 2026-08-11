<script setup lang="ts">
import { DialogClose, DialogContent, DialogRoot, DialogTitle } from 'reka-ui'
import { computed, ref, watch } from 'vue'

import { chatPersistenceManager, type ChatHistoryEntry } from '@/app/ai/chat/persistence'
import AppTextButton from '@/components/ui/AppTextButton.vue'

const props = defineProps<{
  open?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const open = ref(props.open ?? false)

watch(
  () => props.open,
  (val) => {
    open.value = val ?? false
    if (open.value) {
      loadHistories()
    }
  }
)

const histories = ref<ChatHistoryEntry[]>([])
const selectedEntry = ref<ChatHistoryEntry | null>(null)
const selectedContent = ref('')
const isLoading = ref(false)

async function loadHistories() {
  isLoading.value = true
  try {
    histories.value = await chatPersistenceManager.loadHistories()
  } finally {
    isLoading.value = false
  }
}

async function selectEntry(entry: ChatHistoryEntry) {
  selectedEntry.value = entry
  selectedContent.value = await chatPersistenceManager.loadHistoryFile(entry.filePath)
}

function formatTimestamp(ts: string) {
  try {
    const d = new Date(ts)
    return d.toLocaleString()
  } catch {
    return ts
  }
}

function groupByDate(entries: ChatHistoryEntry[]) {
  const groups: Record<string, ChatHistoryEntry[]> = {}
  for (const entry of entries) {
    if (!groups[entry.date]) groups[entry.date] = []
    groups[entry.date].push(entry)
  }
  return groups
}

const groupedHistories = computed(() => groupByDate(histories.value))

async function handleExport() {
  if (!selectedContent.value) return
  const blob = new Blob([selectedContent.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = selectedEntry.value?.filePath.split('/').pop() ?? 'chat-history.json'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <DialogRoot v-model:open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="fixed left-1/2 top-1/2 z-50 max-h-[80vh] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background shadow-lg"
    >
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <DialogTitle class="text-sm font-medium">Chat History</DialogTitle>
        <DialogClose as-child>
          <button class="rounded p-1 hover:bg-hover">
            <icon-lucide-x class="size-4" />
          </button>
        </DialogClose>
      </div>

      <div class="flex max-h-[60vh] overflow-hidden">
        <!-- Sidebar: history list -->
        <div class="w-48 border-r border-border overflow-y-auto">
          <div v-if="isLoading" class="p-4 text-xs text-muted">Loading...</div>
          <div v-else-if="histories.length === 0" class="p-4 text-xs text-muted">No history yet</div>
          <template v-else>
            <div v-for="(entries, date) in groupedHistories" :key="date" class="border-b border-border last:border-b-0">
              <div class="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted">{{ date }}</div>
              <button
                v-for="entry in entries"
                :key="entry.id"
                class="w-full border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-hover"
                :class="{ 'bg-accent/10': selectedEntry?.id === entry.id }"
                @click="selectEntry(entry)"
              >
                <div class="text-xs font-medium">{{ formatTimestamp(entry.timestamp) }}</div>
                <div class="text-xs text-muted">{{ entry.providerID }} · {{ entry.messageCount }} msgs</div>
              </button>
            </div>
          </template>
        </div>

        <!-- Main: content preview -->
        <div class="flex-1 overflow-hidden flex flex-col">
          <div v-if="!selectedEntry" class="flex h-full items-center justify-center text-xs text-muted">
            Select a history to preview
          </div>
          <template v-else>
            <div class="border-b border-border bg-muted/30 px-4 py-2">
              <div class="text-xs">
                <span class="font-medium">{{ selectedEntry.providerID }}</span>
                <span class="ml-2 text-muted">{{ formatTimestamp(selectedEntry.timestamp) }}</span>
                <span class="ml-2 text-muted">· {{ selectedEntry.messageCount }} messages</span>
              </div>
            </div>
            <pre
              class="flex-1 overflow-auto p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap"
            >{{ selectedContent }}</pre>
            <div class="border-t border-border px-4 py-2 flex justify-end">
              <AppTextButton
                :ui="{ base: 'flex items-center gap-1 rounded px-3 py-1.5 hover:bg-hover' }"
                @click="handleExport"
              >
                <icon-lucide-download class="size-3" />
                Export
              </AppTextButton>
            </div>
          </template>
        </div>
      </div>
    </DialogContent>
  </DialogRoot>
</template>
