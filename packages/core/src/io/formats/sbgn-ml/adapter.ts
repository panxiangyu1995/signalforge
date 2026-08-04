import type { SceneGraph } from '@signal-forge/scene-graph'

import type { IOFormatAdapter, ReadDocumentInput, ReadDocumentResult } from '#core/io/types'

import { readSbgnMl } from './read'
import { writeSbgnMl } from './write'

function lowerExt(name: string): string {
  const match = /\.([^.]+)$/.exec(name.toLowerCase())
  return match?.[1] ?? ''
}

async function readDocument(input: ReadDocumentInput): Promise<ReadDocumentResult> {
  const text = new TextDecoder().decode(input.data)
  const graph = readSbgnMl(text)
  return { graph, sourceFormat: 'sbgn-ml' }
}

export const sbgnmlFormat: IOFormatAdapter = {
  id: 'sbgn-ml',
  label: 'SBGN-ML',
  role: 'interchange-document',
  category: 'document',
  extensions: ['sbgn', 'sbgnml'],
  mimeTypes: ['application/xml'],
  support: {
    readDocument: true,
    writeDocument: true,
    exportDocument: true,
    exportPage: true,
  },
  matchesFile(fileName, mimeType) {
    const ext = lowerExt(fileName)
    return ext === 'sbgn' || ext === 'sbgnml' || mimeType === 'application/xml'
  },
  readDocument,
  async writeDocument(graph: SceneGraph) {
    const xml = writeSbgnMl(graph)
    const data = new TextEncoder().encode(xml)
    return { data, fileName: 'diagram.sbgn', mimeType: 'application/xml', format: 'sbgn-ml', extension: 'sbgn' }
  },
  async exportContent(request) {
    const xml = writeSbgnMl(request.graph)
    const data = new TextEncoder().encode(xml)
    return { data, fileName: 'diagram.sbgn', mimeType: 'application/xml', format: 'sbgn-ml', extension: 'sbgn' }
  },
}
