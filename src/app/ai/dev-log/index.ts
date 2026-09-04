function timestamp(): string {
  return new Date().toISOString().slice(11, 23)
}

function serialize(data: unknown): string {
  if (data === undefined) return ''
  try {
    const raw = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    if (raw.length > 4000) return raw.slice(0, 4000) + '...[truncated]'
    return raw
  } catch {
    return '[unserializable]'
  }
}

function write(level: string, tag: string, msg: string, data?: unknown): void {
  const line = `${timestamp()} [${level}] [${tag}] ${msg}`
  const dataStr = serialize(data)
  const full = dataStr ? line + ' | ' + dataStr : line
  const text = `🔍 ${full}`
  if (level === 'ERROR') {
    console.error(text)
  } else if (level === 'WARN') {
    console.warn(text)
  } else {
    console.debug(text)
  }
}

export const aiLog = {
  info: (tag: string, msg: string, data?: unknown): void => write('INFO', tag, msg, data),
  warn: (tag: string, msg: string, data?: unknown): void => write('WARN', tag, msg, data),
  error: (tag: string, msg: string, data?: unknown): void => write('ERROR', tag, msg, data),
  perf: (tag: string, msg: string, ms: number, data?: unknown): void => {
    write('PERF', tag, `${msg} ${ms.toFixed(1)}ms`, data)
  },
  flush: (): void => {
    /* console is immediate */
  }
}
