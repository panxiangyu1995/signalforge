import { omit } from 'es-toolkit/object'

import type { SceneNode } from './types'

export function removeStaleBindings(
  node: SceneNode,
  field: 'fills' | 'strokes',
  changes: Partial<SceneNode>
): void {
  const len = node[field].length
  const stale = Object.keys(node.boundVariables).filter((k) => {
    if (k === field) return true
    if (!k.startsWith(`${field}/`)) return false
    const i = Number.parseInt(k.split('/')[1] ?? '', 10)
    return Number.isNaN(i) || i < 0 || i >= len
  })
  if (stale.length > 0) {
    node.boundVariables = omit(node.boundVariables, stale)
    changes.boundVariables = { ...node.boundVariables }
  }
}
