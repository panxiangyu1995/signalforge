import { appendFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import type { Plugin } from 'vite'

export function aiDevLogPlugin(): Plugin {
  const logFile = resolve(process.cwd(), '.logs', 'ai-dev.log')

  function ensureLog(): void {
    try {
      const dir = resolve(process.cwd(), '.logs')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    } catch { /* ignore */ }
  }

  return {
    name: 'ai-dev-log',
    configureServer(server) {
      ensureLog()
      appendFileSync(logFile, `\n=== dev server started ${new Date().toISOString()} ===\n`, 'utf8')
    },
  }
}
