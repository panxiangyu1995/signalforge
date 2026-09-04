import {
  SceneGraph,
  updatePathwayData,
  type PathwayArcType,
  type PathwayGlyphType,
  type PathwayProcessType,
  type PathwayNodeData,
  type Vector
} from '@signal-forge/scene-graph'

const GLYPH_CLASS_MAP: Record<string, PathwayGlyphType> = {
  macromolecule: 'macromolecule',
  'simple chemical': 'simple_chemical',
  complex: 'complex',
  'nucleic acid feature': 'nucleic_acid_feature',
  'unspecified entity': 'unspecified_entity',
  'perturbing agent': 'perturbation',
  phenotype: 'phenotype',
  'source and sink': 'source_sink',
  'empty set': 'source_sink'
}

const PROCESS_CLASS_MAP: Record<string, PathwayProcessType> = {
  process: 'process',
  transport: 'transport',
  association: 'association',
  dissociation: 'dissociation',
  'omitted process': 'omitted_process',
  'uncertain process': 'uncertain_process'
}

const ARC_CLASS_MAP: Record<string, PathwayArcType> = {
  consumption: 'consumption',
  production: 'production',
  modulation: 'modulation',
  stimulation: 'stimulation',
  catalysis: 'catalysis',
  inhibition: 'inhibition',
  'necessary stimulation': 'necessary_stimulation',
  trigger: 'trigger',
  'logic arc': 'logic_and',
  'logic and': 'logic_and',
  'logic or': 'logic_or',
  'logic not': 'logic_not',
  'equivalence arc': 'equivalence'
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
  ports?: Map<string, Vector>
}

interface SbgnArc {
  id: string
  class: string
  source: string
  target: string
  bendPoints?: Vector[]
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

interface ParsedSbgnGlyphNode {
  '@_id'?: string
  '@_class'?: string
  '@_compartmentRef'?: string
  '@_compartment'?: string
  bbox?: { '@_x'?: string; '@_y'?: string; '@_w'?: string; '@_h'?: string }
  label?: { '@_text'?: string }
  port?: { '@_id'?: string; '@_x'?: string; '@_y'?: string }[]
  state?: { '@_variable'?: string; '@_value'?: string }[]
}

interface ParsedSbgnArcNode {
  '@_id'?: string
  '@_class'?: string
  '@_source'?: string
  '@_target'?: string
  point?: { '@_x'?: string; '@_y'?: string }[]
  glyph?: { '@_class'?: string }
}

interface ParsedSbgnMap {
  glyph?: ParsedSbgnGlyphNode[]
  arc?: ParsedSbgnArcNode[]
}

function parsePortsFromNode(g: ParsedSbgnGlyphNode): Map<string, Vector> | undefined {
  const ports = new Map<string, Vector>()
  for (const p of g.port ?? []) {
    const portId = p['@_id'] ?? ''
    const px = safeFloat(p['@_x'], 0)
    const py = safeFloat(p['@_y'], 0)
    if (portId) ports.set(portId, { x: px, y: py })
  }
  return ports.size > 0 ? ports : undefined
}

function parseStateVarsFromNode(
  g: ParsedSbgnGlyphNode
): { variable: string; value?: string }[] | undefined {
  const stateVars: { variable: string; value?: string }[] = []
  for (const s of g.state ?? []) {
    const variable = s['@_variable'] ?? ''
    const value = s['@_value'] ?? undefined
    stateVars.push({ variable: variable || (value ?? ''), value: variable ? value : undefined })
  }
  return stateVars.length > 0 ? stateVars : undefined
}

function collectParsedGlyphs(map: ParsedSbgnMap, glyphs: SbgnGlyph[]): void {
  for (const g of map.glyph ?? []) {
    glyphs.push({
      id: g['@_id'] ?? '',
      class: g['@_class'] ?? '',
      x: safeFloat(g.bbox?.['@_x'], 0),
      y: safeFloat(g.bbox?.['@_y'], 0),
      w: safeFloat(g.bbox?.['@_w'], 100),
      h: safeFloat(g.bbox?.['@_h'], 100),
      label: g.label?.['@_text'] ?? undefined,
      stateVariables: parseStateVarsFromNode(g),
      compartment: g['@_compartmentRef'] ?? g['@_compartment'] ?? undefined,
      ports: parsePortsFromNode(g)
    })
  }
}

function parseBendPointsFromNode(a: ParsedSbgnArcNode): Vector[] {
  const bendPoints: Vector[] = []
  for (const p of a.point ?? []) {
    bendPoints.push({ x: safeFloat(p['@_x'], 0), y: safeFloat(p['@_y'], 0) })
  }
  return bendPoints
}

function resolveLogicArcClass(cls: string, logicCls: string): string {
  if (cls !== 'logic arc') return cls
  if (logicCls === 'and') return 'logic and'
  if (logicCls === 'or') return 'logic or'
  if (logicCls === 'not') return 'logic not'
  return cls
}

function collectParsedArcs(map: ParsedSbgnMap, arcs: SbgnArc[]): void {
  for (const a of map.arc ?? []) {
    const bendPoints = parseBendPointsFromNode(a)
    arcs.push({
      id: a['@_id'] ?? '',
      class: resolveLogicArcClass(a['@_class'] ?? '', a.glyph?.['@_class'] ?? ''),
      source: a['@_source'] ?? '',
      target: a['@_target'] ?? '',
      bendPoints: bendPoints.length > 0 ? bendPoints : undefined
    })
  }
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
      isArray: (name: string) =>
        name === 'glyph' ||
        name === 'arc' ||
        name === 'point' ||
        name === 'state' ||
        name === 'port'
    })
    const obj = parser.parse(xml)
    const map: ParsedSbgnMap | undefined = obj.sbgn?.map ?? obj.map
    if (!map) return { glyphs, arcs }

    collectParsedGlyphs(map, glyphs)
    collectParsedArcs(map, arcs)
  } catch (error) {
    console.warn(
      '[sbgn-ml] fast-xml-parser unavailable or parse failed; returning empty result',
      error
    )
  }

  return { glyphs, arcs }
}

function collectStatesFromDom(el: Element): { variable: string; value?: string }[] {
  const stateVars: { variable: string; value?: string }[] = []
  for (const sEl of el.querySelectorAll('state')) {
    const variable = sEl.getAttribute('variable') ?? ''
    const value = sEl.getAttribute('value') ?? undefined
    stateVars.push({ variable: variable || (value ?? ''), value: variable ? value : undefined })
  }
  return stateVars
}

function collectPortsFromDom(el: Element): Map<string, Vector> {
  const ports = new Map<string, Vector>()
  for (const pEl of el.querySelectorAll('port')) {
    const portId = pEl.getAttribute('id') ?? ''
    const px = safeFloat(pEl.getAttribute('x'), 0)
    const py = safeFloat(pEl.getAttribute('y'), 0)
    if (portId) ports.set(portId, { x: px, y: py })
  }
  return ports
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

    const stateVars = collectStatesFromDom(el)
    const compartment =
      el.getAttribute('compartmentRef') ?? el.getAttribute('compartment') ?? undefined
    const ports = collectPortsFromDom(el)

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
      ports: ports.size > 0 ? ports : undefined
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

    const bendPoints: Vector[] = []
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
      bendPoints: bendPoints.length > 0 ? bendPoints : undefined
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

  const compartments = glyphs.filter((g) => g.class === 'compartment')
  const entities = glyphs.filter((g) => g.class !== 'compartment' && g.class in GLYPH_CLASS_MAP)
  const processes = glyphs.filter((g) => g.class in PROCESS_CLASS_MAP)
  const otherGlyphs = glyphs.filter(
    (g) =>
      g.class !== 'compartment' && !(g.class in GLYPH_CLASS_MAP) && !(g.class in PROCESS_CLASS_MAP)
  )

  for (const spec of compartments) {
    const node = graph.createNode('COMPARTMENT', pageId, {
      name: spec.label ?? spec.id,
      x: spec.x,
      y: spec.y,
      width: spec.w,
      height: spec.h
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
      height: spec.h
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
      height: spec.h
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
      height: spec.h
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
      name: `${spec.source} → ${spec.target}`
    })
    const data: Record<string, unknown> = { arcType, sourceId, targetId }
    if (spec.bendPoints) data.bendPoints = spec.bendPoints
    updatePathwayData(node, data as Partial<PathwayNodeData>)
  }

  return graph
}

function safeFloat(value: string | null | undefined, fallback: number): number {
  if (value == null || value === '') return fallback
  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) ? fallback : parsed
}
