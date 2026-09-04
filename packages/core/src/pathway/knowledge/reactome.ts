import type { JsonObject } from '@signal-forge/scene-graph/primitives'

const REACTOME_API_BASE = 'https://reactome.org/ContentService'
const FETCH_TIMEOUT = 10_000

interface ReactomePathway {
  stableId: string
  name: string
  species: string
  dbId: number
}

interface ReactomeParticipant {
  dbId: number
  displayName: string
  schemaClass: string
  typeName: string
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

async function safeFetch(url: string): Promise<Response | null> {
  if (typeof fetch === 'undefined') return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const response = await fetch(url, { signal: controller.signal })
    return response
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function searchPathways(
  query: string,
  species?: string
): Promise<ReactomePathway[]> {
  const params = new URLSearchParams({ query })
  if (species) params.set('species', species)

  const url = `${REACTOME_API_BASE}/search/query?${params.toString()}`
  const response = await safeFetch(url)
  if (!response?.ok) return []

  try {
    const data = await response.json() as {
      results?: Array<{
        entries?: Array<{
          stId?: string
          name?: string
          species?: string[]
          dbId?: number
          exactType?: string
        }>
      }>
    }
    const entries = (data.results ?? []).flatMap(r => r.entries ?? [])
    return entries
      .filter(e => e.exactType === 'Pathway')
      .map(e => ({
        stableId: e.stId ?? '',
        name: stripHtml(e.name ?? ''),
        species: Array.isArray(e.species) ? e.species.join(', ') : '',
        dbId: e.dbId ?? 0
      }))
  } catch {
    return []
  }
}

export async function getPathwayDetails(
  stableId: string
): Promise<JsonObject | null> {
  const url = `${REACTOME_API_BASE}/data/detail/${stableId}`
  const response = await safeFetch(url)
  if (!response?.ok) return null

  try {
    return (await response.json()) as JsonObject
  } catch {
    return null
  }
}

export async function getPathwayParticipants(
  stableId: string
): Promise<ReactomeParticipant[]> {
  const url = `${REACTOME_API_BASE}/data/participants/${stableId}`
  const response = await safeFetch(url)
  if (!response?.ok) return []

  try {
    const data = await response.json() as ReactomeParticipant[]
    return data
  } catch {
    return []
  }
}

export async function findPathwaysByGene(
  gene: string,
  _species?: string
): Promise<ReactomePathway[]> {
  const url = `${REACTOME_API_BASE}/data/mapping/UniProt/${gene}/pathways`
  const response = await safeFetch(url)
  if (!response?.ok) return []

  try {
    const data = await response.json() as Array<{
      dbId?: number
      stId?: string
      displayName?: string
      name?: string[]
      speciesName?: string
    }>
    return data.map(r => ({
      stableId: r.stId ?? '',
      name: r.displayName ?? (Array.isArray(r.name) ? r.name.join(', ') : ''),
      species: r.speciesName ?? '',
      dbId: r.dbId ?? 0
    }))
  } catch {
    return []
  }
}
