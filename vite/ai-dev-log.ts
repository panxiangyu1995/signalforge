import { appendFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import type { Plugin } from 'vite'

export function aiDevLogPlugin(): Plugin {
  const logFile = resolve(process.cwd(), '.logs', 'ai-dev.log')

  function ensureLog(): void {
    try {
      const dir = resolve(process.cwd(), '.logs')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    } catch (err) {
      console.warn('[ai-dev-log] Failed to ensure log directory:', err)
    }
  }

  return {
    name: 'ai-dev-log',
    configureServer() {
      ensureLog()
      appendFileSync(logFile, `\n=== dev server started ${new Date().toISOString()} ===\n`, 'utf8')
    }
  }
}
