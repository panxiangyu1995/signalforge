/**
 * Browser-side automation handler.
 *
 * Connects to the bridge via WebSocket, receives RPC requests,
 * executes them against the live EditorStore, and sends results back.
 */
import { AUTOMATION_WS_PORT } from '@signal-forge/core/constants'
import { randomHex } from '@signal-forge/core/random'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import type { EditorStore } from '@/app/editor/active-store'

export function connectAutomation(getStore: () => EditorStore, authToken: string | null = null) {
  const token = authToken ?? randomHex(32)
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let intentionalDisconnect = false
  let reconnectAttempts = 0
  const MAX_RECONNECT_ATTEMPTS = 3

  const { handleRequest: handleAutomationRequest } =
    createAutomationCommandHandlers(makeFigmaFromStore)

  async function handleRequest(_id: string, command: string, args: unknown): Promise<unknown> {
    return handleAutomationRequest(getStore(), command, args)
  }

  function connect() {
    try {
      ws = new WebSocket(`ws://127.0.0.1:${AUTOMATION_WS_PORT}`)
    } catch (e) {
      console.error(
        '[Automation] WebSocket constructor failed:',
        e instanceof Error ? e.message : e
      )
      scheduleReconnect()
      return
    }

    ws.onopen = () => {
      reconnectAttempts = 0
      ws?.send(JSON.stringify({ type: 'register', token }))
    }

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data) as {
          type: string
          id: string
          command: string
          args?: unknown
        }
        if (msg.type !== 'request' || !msg.id) return
        try {
          const result = await handleRequest(msg.id, msg.command, msg.args)
          ws?.send(JSON.stringify({ type: 'response', id: msg.id, ...(result as object) }))
        } catch (e) {
          ws?.send(
            JSON.stringify({
              type: 'response',
              id: msg.id,
              ok: false,
              error: e instanceof Error ? e.message : String(e)
            })
          )
        }
      } catch (e) {
        console.warn('Failed to parse WebSocket message:', e)
      }
    }

    ws.onclose = (event) => {
      ws = null
      if (intentionalDisconnect || event.code === 1000) return
      scheduleReconnect()
    }

    ws.onerror = () => {
      ws?.close()
    }
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer)
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return
    reconnectAttempts++
    reconnectTimer = setTimeout(connect, 2000)
  }

  function disconnect() {
    intentionalDisconnect = true
    clearTimeout(reconnectTimer)
    ws?.close()
    ws = null
  }

  connect()
  return { disconnect, token }
}
