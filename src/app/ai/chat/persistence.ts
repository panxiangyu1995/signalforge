import type { UIMessage } from 'ai'

import { serializeChatLog } from '@/app/ai/debug'
import type { AIProviderID } from '@signal-forge/core/constants'

export interface ChatHistoryEntry {
  id: string
  timestamp: string
  providerID: string
  messageCount: number
  filePath: string
  date: string
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

class ChatPersistenceManager {
  async save(chatId: string, messages: UIMessage[], providerID: AIProviderID): Promise<void> {
    if (typeof window === 'undefined') return

    if (import.meta.env.DEV && !isTauriRuntime()) {
      await this.saveDevLog(messages, providerID)
    } else {
      await this.saveProdLog(chatId, messages, providerID)
    }
  }

  private async saveDevLog(messages: UIMessage[], providerID: string): Promise<void> {
    if (typeof window === 'undefined') return
    try {
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10)
      const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '-')
      const fileName = `${timeStr}_${providerID}.log`
      const content = serializeChatLog(messages)

      await this.devServerWriteLog(dateStr, fileName, content)
      console.info(`[ChatPersistence] Dev log saved: .logs/${dateStr}/${fileName}`)
    } catch (err) {
      console.warn('[ChatPersistence] Failed to save dev log:', err)
    }
  }

  private async devServerWriteLog(dateStr: string, fileName: string, content: string): Promise<void> {
    const response = await fetch('/__chat-persistence/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateStr, fileName, content })
    })
    if (!response.ok) {
      throw new Error(`Failed to write log: ${response.statusText}`)
    }
  }

  private async saveProdLog(chatId: string, messages: UIMessage[], providerID: string): Promise<void> {
    if (typeof window === 'undefined') return
    try {
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10)
      const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '-')
      const fileName = `${timeStr}_${providerID}.json`
      const content = JSON.stringify({ chatId, messages, providerID, savedAt: now.toISOString() }, null, 2)

      await this.ensureLogDir(dateStr)
      await this.writeProdFile(`${dateStr}/${fileName}`, content)
      console.info(`[ChatPersistence] Prod log saved: ${dateStr}/${fileName}`)
    } catch (err) {
      console.warn('[ChatPersistence] Failed to save prod log:', err)
    }
  }

  private async ensureLogDir(datePath: string): Promise<void> {
    if (typeof window === 'undefined') return
    try {
      const { mkdir, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs')

      if (!await exists(datePath, { baseDir: BaseDirectory.AppLocalData })) {
        await mkdir(datePath, { baseDir: BaseDirectory.AppLocalData, recursive: true })
      }
    } catch (err) {
      console.warn('[ChatPersistence] Failed to ensure log dir:', err)
    }
  }

  private async writeProdFile(path: string, content: string): Promise<void> {
    if (typeof window === 'undefined') return
    try {
      const { writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')
      await writeTextFile(path, content, { baseDir: BaseDirectory.AppLocalData })
    } catch (err) {
      console.warn('[ChatPersistence] Failed to write file:', err)
    }
  }

  async loadHistories(): Promise<ChatHistoryEntry[]> {
    if (typeof window === 'undefined') return []
    try {
      const { readDir, BaseDirectory } = await import('@tauri-apps/plugin-fs')
      const entries: ChatHistoryEntry[] = []

      const items = await readDir('', { baseDir: BaseDirectory.AppLocalData })

      for (const item of items) {
        if (item.isDirectory && /^\d{4}-\d{2}-\d{2}$/.test(item.name)) {
          const date = item.name
          const logDir = await readDir(date, { baseDir: BaseDirectory.AppLocalData })

          for (const file of logDir) {
            if (!file.isFile) continue
            const nameParts = file.name.match(/^(\d{2}-\d{2}-\d{2})_(.+)\.(log|json)$/)
            if (!nameParts) continue

            const [, timeStr, providerID] = nameParts
            const timestamp = `${date}T${timeStr.replace(/-/g, ':')}`

            let messageCount = 0
            try {
              const { readTextFile } = await import('@tauri-apps/plugin-fs')
              const content = await readTextFile(`${date}/${file.name}`, { baseDir: BaseDirectory.AppLocalData })
              if (file.name.endsWith('.json')) {
                const parsed = JSON.parse(content)
                messageCount = Array.isArray(parsed.messages) ? parsed.messages.length : 0
              }
            } catch { /* ignore */ }

            entries.push({
              id: file.name,
              timestamp,
              providerID,
              messageCount,
              filePath: `${date}/${file.name}`,
              date
            })
          }
        }
      }

      return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    } catch (err) {
      console.warn('[ChatPersistence] Failed to load histories:', err)
      return []
    }
  }

  async loadHistoryFile(filePath: string): Promise<string> {
    if (typeof window === 'undefined') return ''
    try {
      const { readTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')
      return await readTextFile(filePath, { baseDir: BaseDirectory.AppLocalData })
    } catch (err) {
      console.warn('[ChatPersistence] Failed to load history file:', err)
      return ''
    }
  }
}

export const chatPersistenceManager = new ChatPersistenceManager()
