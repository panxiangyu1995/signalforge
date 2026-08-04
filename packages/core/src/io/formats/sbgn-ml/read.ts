import { SceneGraph, updatePathwayData, type PathwayGlyphType, type PathwayProcessType, type PathwayArcType } from '@signal-forge/scene-graph'

const GLYPH_CLASS_MAP: Record<string, PathwayGlyphType> = {
  'macromolecule': 'macromolecule',
  'simple chemical': 'simple_chemical',
  'complex': 'complex',
  'nucleic acid feature': 'nucleic_acid_feature',
  'unspecified entity': 'unspecified_entity',
  'perturbing agent': 'perturbation',
  'phenotype': 'phenotype',
  'source and sink': 'source_sink',
  'empty set': 'source_sink',
}

const PROCESS_CLASS_MAP: Record<string, PathwayProcessType> = {
  'process': 'process',
  'transport': 'transport',
  'association': 'association',
  'dissociation': 'dissociation',
  'omitted process': 'omitted_process',
  'uncertain process': 'uncertain_process',
}

const ARC_CLASS_MAP: Record<string, PathwayArcType> = {
  'consumption': 'consumption',
  'production': 'production',
  'modulation': 'modulation',
  'stimulation': 'stimulation',
  'catalysis': 'catalysis',
  'inhibition': 'inhibition',
  'necessary stimulation': 'necessary_stimulation',
  'trigger': 'trigger',
  'logic arc': 'logic_and',
  'logic and': 'logic_and',
  'logic or': 'logic_or',
  'logic not': 'logic_not',
  'equivalence arc': 'equivalence',
}

interface SbgnGlyph {
  id: string
  class: string
  x: number
  y: number
  w: number
  h: number
  label?: string
  stateVariables?: { variable: string; value?: string }[]
  compartment?: string
  ports?: Map<string, { x: number; y: number }>
}

interface SbgnArc {
  id: string
  class: string
  source: string
  target: string
  bendPoints?: { x: number; y: number }[]
}

function parseSbgnMlXml(xml: string): { glyphs: SbgnGlyph[]; arcs: SbgnArc[] } {
  const glyphs: SbgnGlyph[] = []
  const arcs: SbgnArc[] = []

  if (typeof DOMParser === 'undefined') {
    return { glyphs, arcs }
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  const mapEl = doc.querySelector('map') ?? doc.querySelector('sbgn')

  if (!mapEl) return { glyphs, arcs }

  collectGlyphsFromDom(mapEl, glyphs)
  collectArcsFromDom(mapEl, arcs)

  return { glyphs, arcs }
}

async function parseSbgnMlNode(
  xml: string,
  glyphs: SbgnGlyph[],
  arcs: SbgnArc[]
): Promise<{ glyphs: SbgnGlyph[]; arcs: SbgnArc[] }> {
  try {
    const { XMLParser } = await import('fast-xml-parser')
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      isArray: (name: string) => name === 'glyph' || name === 'arc' || name === 'point' || name === 'state' || name === 'port',
    })
    const obj = parser.parse(xml)
    const map = obj.sbgn?.map ?? obj.map
    if (!map) return { glyphs, arcs }

    const glyphList = map.glyph ?? []
    for (const g of glyphList) {
      const bbox = g.bbox
      const stateList = g.state ?? []
      const portList = g.port ?? []
      const ports = new Map<string, { x: number; y: number }>()
      for (const p of portList) {
        const portId = p['@_id'] ?? ''
        const px = safeFloat(p['@_x'], 0)
        const py = safeFloat(p['@_y'], 0)
        if (portId) ports.set(portId, { x: px, y: py })
      }
      const stateVars: { variable: string; value?: string }[] = []
      for (const s of stateList) {
        const variable = s['@_variable'] ?? ''
        const value = s['@_value'] ?? undefined
        stateVars.push({ variable: variable || (value ?? ''), value: variable ? value : undefined })
      }
      glyphs.push({
        id: g['@_id'] ?? '',
        class: g['@_class'] ?? '',
        x: safeFloat(bbox?.['@_x'], 0),
        y: safeFloat(bbox?.['@_y'], 0),
        w: safeFloat(bbox?.['@_w'], 100),
        h: safeFloat(bbox?.['@_h'], 100),
        label: g.label?.['@_text'] ?? undefined,
        stateVariables: stateVars.length > 0 ? stateVars : undefined,
        compartment: g['@_compartmentRef'] ?? g['@_compartment'] ?? undefined,
        ports: ports.size > 0 ? ports : undefined,
      })
    }

    const arcList = map.arc ?? []
    for (const a of arcList) {
      const bendPoints: { x: number; y: number }[] = []
      const pointList = a.point ?? []
      for (const p of pointList) {
        bendPoints.push({ x: safeFloat(p['@_x'], 0), y: safeFloat(p['@_y'], 0) })
      }
      let cls = a['@_class'] ?? ''
      if (cls === 'logic arc') {
        const logicGlyph = a.glyph
        const logicCls = logicGlyph?.['@_class'] ?? ''
        if (logicCls === 'and') cls = 'logic and'
        else if (logicCls === 'or') cls = 'logic or'
        else if (logicCls === 'not') cls = 'logic not'
      }
      arcs.push({
        id: a['@_id'] ?? '',
        class: cls,
        source: a['@_source'] ?? '',
        target: a['@_target'] ?? '',
        bendPoints: bendPoints.length > 0 ? bendPoints : undefined,
      })
    }
  } catch {
    // fast-xml-parser not available; return empty
  }

  return { glyphs, arcs }
}

function collectGlyphsFromDom(mapEl: Element, glyphs: SbgnGlyph[]): void {
  const glyphElements = mapEl.querySelectorAll('glyph')
  for (const el of glyphElements) {
    const id = el.getAttribute('id') ?? ''
    const cls = el.getAttribute('class') ?? ''

    const bboxEl = el.querySelector('bbox')
    const x = safeFloat(bboxEl?.getAttribute('x'), 0)
    const y = safeFloat(bboxEl?.getAttribute('y'), 0)
    const w = safeFloat(bboxEl?.getAttribute('w'), 100)
    const h = safeFloat(bboxEl?.getAttribute('h'), 100)

    const labelEl = el.querySelector('label')
    const label = labelEl?.getAttribute('text') ?? undefined

    const stateVars: { variable: string; value?: string }[] = []
    const stateEls = el.querySelectorAll('state')
    for (const sEl of stateEls) {
      const variable = sEl.getAttribute('variable') ?? ''
      const value = sEl.getAttribute('value') ?? undefined
      stateVars.push({ variable: variable || (value ?? ''), value: variable ? value : undefined })
    }

    const compartment = el.getAttribute('compartmentRef') ?? el.getAttribute('compartment') ?? undefined

    const ports = new Map<string, { x: number; y: number }>()
    const portEls = el.querySelectorAll('port')
    for (const pEl of portEls) {
      const portId = pEl.getAttribute('id') ?? ''
      const px = safeFloat(pEl.getAttribute('x'), 0)
      const py = safeFloat(pEl.getAttribute('y'), 0)
      if (portId) ports.set(portId, { x: px, y: py })
    }

    glyphs.push({
      id,
      class: cls,
      x,
      y,
      w,
      h,
      label,
      stateVariables: stateVars.length > 0 ? stateVars : undefined,
      compartment,
      ports: ports.size > 0 ? ports : undefined,
    })
  }
}

function collectArcsFromDom(mapEl: Element, arcs: SbgnArc[]): void {
  const arcElements = mapEl.querySelectorAll('arc')
  for (const el of arcElements) {
    const id = el.getAttribute('id') ?? ''
    const cls = el.getAttribute('class') ?? ''
    const source = el.getAttribute('source') ?? ''
    const target = el.getAttribute('target') ?? ''

    const bendPoints: { x: number; y: number }[] = []
    const pointEls = el.querySelectorAll('point')
    for (const pEl of pointEls) {
      const px = safeFloat(pEl.getAttribute('x'), 0)
      const py = safeFloat(pEl.getAttribute('y'), 0)
      bendPoints.push({ x: px, y: py })
    }

    let resolvedClass = cls
    if (cls === 'logic arc') {
      const logicGlyph = el.querySelector('glyph')
      const logicCls = logicGlyph?.getAttribute('class') ?? ''
      if (logicCls === 'and') resolvedClass = 'logic and'
      else if (logicCls === 'or') resolvedClass = 'logic or'
      else if (logicCls === 'not') resolvedClass = 'logic not'
    }

    arcs.push({
      id,
      class: resolvedClass,
      source,
      target,
      bendPoints: bendPoints.length > 0 ? bendPoints : undefined,
    })
  }
}

export function readSbgnMl(xml: string): SceneGraph {
  const { glyphs, arcs } = parseSbgnMlXml(xml)
  return buildSceneGraph(glyphs, arcs)
}

export async function readSbgnMlAsync(xml: string): Promise<SceneGraph> {
  const { glyphs, arcs } = await parseSbgnMlNode(xml, [], [])
  return buildSceneGraph(glyphs, arcs)
}

function buildSceneGraph(glyphs: SbgnGlyph[], arcs: SbgnArc[]): SceneGraph {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const pageId = page.id
  const idMap = new Map<string, string>()

  const compartments = glyphs.filter(g => g.class === 'compartment')
  const entities = glyphs.filter(g => g.class !== 'compartment' && g.class in GLYPH_CLASS_MAP)
  const processes = glyphs.filter(g => g.class in PROCESS_CLASS_MAP)
  const otherGlyphs = glyphs.filter(
    g => g.class !== 'compartment' && !(g.class in GLYPH_CLASS_MAP) && !(g.class in PROCESS_CLASS_MAP)
  )

  for (const spec of compartments) {
    const node = graph.createNode('COMPARTMENT', pageId, {
      name: spec.label ?? spec.id,
      x: spec.x,
      y: spec.y,
      width: spec.w,
      height: spec.h,
    })
    idMap.set(spec.id, node.id)
  }

  for (const spec of entities) {
    const glyphType = GLYPH_CLASS_MAP[spec.class]
    const parentId = spec.compartment ? idMap.get(spec.compartment) : undefined

    const node = graph.createNode('PATHWAY_GLYPH', parentId ?? pageId, {
      name: spec.label ?? spec.id,
      x: spec.x,
      y: spec.y,
      width: spec.w,
      height: spec.h,
    })
    updatePathwayData(node, { glyphType })

    if (spec.stateVariables && spec.stateVariables.length > 0) {
      updatePathwayData(node, { stateVariables: spec.stateVariables })
    }

    idMap.set(spec.id, node.id)
  }

  for (const spec of processes) {
    const processType = PROCESS_CLASS_MAP[spec.class]
    const parentId = spec.compartment ? idMap.get(spec.compartment) : undefined

    const node = graph.createNode('PATHWAY_PROCESS', parentId ?? pageId, {
      name: spec.label ?? spec.id,
      x: spec.x,
      y: spec.y,
      width: spec.w,
      height: spec.h,
    })
    updatePathwayData(node, { processType })
    idMap.set(spec.id, node.id)
  }

  for (const spec of otherGlyphs) {
    const node = graph.createNode('PATHWAY_GLYPH', pageId, {
      name: spec.label ?? spec.id,
      x: spec.x,
      y: spec.y,
      width: spec.w,
      height: spec.h,
    })
    updatePathwayData(node, { glyphType: 'unspecified_entity' })
    idMap.set(spec.id, node.id)
  }

  for (const spec of arcs) {
    const sourceId = idMap.get(spec.source)
    const targetId = idMap.get(spec.target)
    if (!sourceId || !targetId) continue

    const arcType = ARC_CLASS_MAP[spec.class] ?? 'modulation'
    const node = graph.createNode('PATHWAY_ARC', pageId, {
      name: `${spec.source} → ${spec.target}`,
    })
    const data: Record<string, unknown> = { arcType, sourceId, targetId }
    if (spec.bendPoints) data.bendPoints = spec.bendPoints
    updatePathwayData(node, data as Partial<import('@signal-forge/scene-graph').PathwayNodeData>)
  }

  return graph
}

function safeFloat(value: string | null | undefined, fallback: number): number {
  if (value == null || value === '') return fallback
  const parsed = parseFloat(value)
  return Number.isNaN(parsed) ? fallback : parsed
}
