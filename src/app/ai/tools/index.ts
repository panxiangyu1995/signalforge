import { valibotSchema } from '@ai-sdk/valibot'
import { tool } from 'ai'
import * as v from 'valibot'

import { computeAllLayouts } from '@signal-forge/core/layout'
import { resolveCollisions } from '@signal-forge/core/pathway/layout/collision'
import { hierarchicalLayout } from '@signal-forge/core/pathway/layout/hierarchical'
import { computeOrthogonalBendPoints } from '@signal-forge/core/pathway/layout/orthogonal'
import { BIOPATH_CORE_TOOLS, toolsToAI } from '@signal-forge/core/tools'
import type { StepBudget, ToolLogEntry } from '@signal-forge/core/tools'
import type { SceneNode } from '@signal-forge/scene-graph'

import { aiLog } from '@/app/ai/dev-log'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { getActiveEditorStore } from '@/app/editor/active-store'
import type { EditorStore } from '@/app/editor/active-store'
import { ensureGraphFonts } from '@/app/editor/fonts'

export const MAX_AGENT_STEPS = 100

export interface StepUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  timestamp: number
}

class RunState {
  toolLog: ToolLogEntry[] = []
  stepUsages: StepUsage[] = []
  currentSteps = 0

  recordStep(usage: StepUsage): void {
    this.stepUsages.push(usage)
    this.currentSteps++
  }

  resetSteps(): void {
    this.currentSteps = 0
  }

  hitLimit(): boolean {
    return this.currentSteps >= MAX_AGENT_STEPS
  }

  clear(): void {
    this.toolLog = []
    this.stepUsages = []
    this.currentSteps = 0
  }
}

const runStates = new WeakMap<EditorStore, RunState>()
const batchResetters = new WeakMap<EditorStore, () => void>()

function getRunState(store?: EditorStore): RunState {
  const target = store ?? getActiveEditorStore()
  const existing = runStates.get(target)
  if (existing) return existing
  const created = new RunState()
  runStates.set(target, created)
  return created
}

export function getToolLogEntries(store?: EditorStore): ToolLogEntry[] {
  return getRunState(store).toolLog
}

export function getStepUsages(store?: EditorStore): StepUsage[] {
  return getRunState(store).stepUsages
}

export function recordStepUsage(usage: StepUsage, store?: EditorStore): void {
  getRunState(store).recordStep(usage)
}

export function resetRunSteps(store?: EditorStore): void {
  getRunState(store).resetSteps()
}

export function resetBatchState(store?: EditorStore): void {
  const target = store ?? getActiveEditorStore()
  const resetter = batchResetters.get(target)
  if (resetter) resetter()
}

export function didHitStepLimit(store?: EditorStore): boolean {
  return getRunState(store).hitLimit()
}

export function clearToolLogEntries(store?: EditorStore): void {
  getRunState(store).clear()
}

export function createAITools(store: EditorStore) {
  let beforeSnapshot: Map<string, SceneNode> | null = null
  let batchBeforeSnapshot: Map<string, SceneNode> | null = null
  const runState = getRunState(store)
  aiLog.info('ai-tools', 'createAITools called — AI tool system initialized')

  const resetBatchState = () => {
    batchBeforeSnapshot = null
    beforeSnapshot = null
    const figma = makeFigmaFromStore(store)
    if (figma.pathwayBatch) {
      figma.resetPathwayBatch()
      aiLog.warn('ai-tools', 'reset stuck pathwayBatch on batch state reset')
    }
  }

  batchResetters.set(store, resetBatchState)

  return toolsToAI(
    BIOPATH_CORE_TOOLS,
    {
      getFigma: () => makeFigmaFromStore(store),
      onBeforeExecute: (def) => {
        if (def.name === 'begin_pathway') {
          if (batchBeforeSnapshot) {
            aiLog.warn('ai-tools', 'begin_pathway called while batch already active — resetting')
          }
          batchBeforeSnapshot = store.snapshotPage()
          return
        }
        const figma = makeFigmaFromStore(store)
        if (figma.pathwayBatch) return
        if (def.mutates) {
          beforeSnapshot = store.snapshotPage()
        }
      },
      onAfterExecute: async (def) => {
        const figma = makeFigmaFromStore(store)
        if (figma.pathwayBatch && def.name !== 'end_pathway') return
        if (def.mutates) {
          const t0 = Date.now()
          const pageId = store.state.currentPageId
          const pageNode = store.graph.getNode(pageId)

          if (def.name === 'end_pathway') {
            hierarchicalLayout(store.graph, pageId, { direction: 'top-bottom', spacing: 60 })
            resolveCollisions(store.graph, pageId, 20)
            computeOrthogonalBendPoints(store.graph, pageId, 'top-bottom')
            aiLog.perf('afterExec', `${def.name} pathwayLayout+collision`, Date.now() - t0)
          }

          if (pageNode) await ensureGraphFonts(store.graph, pageNode.childIds)
          aiLog.perf('afterExec', `${def.name} ensureGraphFonts`, Date.now() - t0)
          computeAllLayouts(store.graph, pageId)
          aiLog.perf('afterExec', `${def.name} computeAllLayouts`, Date.now() - t0)
          store.requestRender()
          aiLog.perf('afterExec', `${def.name} requestRender`, Date.now() - t0)

          let undoBefore = beforeSnapshot
          if (def.name === 'end_pathway' && batchBeforeSnapshot) {
            undoBefore = batchBeforeSnapshot
            batchBeforeSnapshot = null
          }

          if (undoBefore) {
            const before = undoBefore
            const after = store.snapshotPage()
            aiLog.perf('afterExec', `${def.name} snapshotPage`, Date.now() - t0)
            store.pushUndoEntry({
              label: def.name === 'end_pathway' ? 'AI: pathway batch' : `AI: ${def.name}`,
              forward: () => store.restorePageFromSnapshot(after),
              inverse: () => store.restorePageFromSnapshot(before)
            })
            beforeSnapshot = null
          }
          aiLog.perf('afterExec', `${def.name} TOTAL`, Date.now() - t0)
        }
      },
      onFlashNodes: (nodeIds) => {
        store.renderer?.aiClearActive()
        if (nodeIds.length > 0) {
          store.aiFlashDone(nodeIds)
        }
      },
      onToolLog: (entry) => {
        runState.toolLog.push(entry)
      },
      getStepBudget: (): StepBudget => ({
        current: runState.currentSteps,
        max: MAX_AGENT_STEPS
      }),
      devLog: aiLog
    },
    { v, valibotSchema, tool }
  )
}

export type AITools = ReturnType<typeof createAITools>
