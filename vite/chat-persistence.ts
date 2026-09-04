import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

import type { Plugin } from 'vite'

export function chatPersistencePlugin(): Plugin {
  const logDir = resolve(process.cwd(), '.logs')

  function ensureLogDir(): void {
    try {
      if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true })
    } catch (err) {
      console.warn('[chat-persistence] Failed to ensure log directory:', err)
    }
  }

  return {
    name: 'chat-persistence',
    configureServer(server) {
      ensureLogDir()

      server.middlewares.use('/__chat-persistence/write', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        try {
          let body = ''
          for await (const chunk of req) {
            body += chunk.toString()
          }

          const { date: dateStr, fileName, content } = JSON.parse(body)

          if (!dateStr || !fileName || !content) {
            res.statusCode = 400
            res.end('Missing required fields')
            return
          }

          const dateDir = resolve(logDir, dateStr)
          if (!existsSync(dateDir)) mkdirSync(dateDir, { recursive: true })

          const filePath = resolve(dateDir, fileName)
          appendFileSync(filePath, content, 'utf8')

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true }))
        } catch (err) {
          console.error('[chat-persistence] Write error:', err)
          res.statusCode = 500
          res.end('Internal Server Error')
        }
      })
    }
  }
}
