import {
  getPathwayData,
  type PathwayArcType,
  type PathwayGlyphType,
  type PathwayProcessType,
  type SceneGraph,
  type SceneNode,
  type Vector
} from '@signal-forge/scene-graph'

const GLYPH_TYPE_TO_CLASS: Record<string, string> = {
  macromolecule: 'macromolecule',
  simple_chemical: 'simple chemical',
  complex: 'complex',
  nucleic_acid_feature: 'nucleic acid feature',
  unspecified_entity: 'unspecified entity',
  perturbation: 'perturbing agent',
  phenotype: 'phenotype',
  source_sink: 'empty set'
}

const PROCESS_TYPE_TO_CLASS: Record<string, string> = {
  process: 'process',
  transport: 'transport',
  association: 'association',
  dissociation: 'dissociation',
  omitted_process: 'omitted process',
  uncertain_process: 'uncertain process'
}

const ARC_TYPE_TO_CLASS: Record<string, string> = {
  consumption: 'consumption',
  production: 'production',
  modulation: 'modulation',
  stimulation: 'stimulation',
  catalysis: 'catalysis',
  inhibition: 'inhibition',
  necessary_stimulation: 'necessary stimulation',
  trigger: 'trigger',
  logic_and: 'logic arc',
  logic_or: 'logic arc',
  logic_not: 'logic arc',
  equivalence: 'equivalence arc'
}

const LOGIC_ARC_GLYPH_CLASS: Record<string, string> = {
  logic_and: 'and',
  logic_or: 'or',
  logic_not: 'not'
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function writeSbgnMl(graph: SceneGraph): string {
  const page = graph.getPages().at(0)
  if (!page) return '<sbgn></sbgn>'

  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<sbgn>')
  lines.push('  <map language="process description">')

  for (const childId of page.childIds) {
    collectNodes(graph, childId, lines, 2)
  }

  lines.push('  </map>')
  lines.push('</sbgn>')
  return lines.join('\n')
}

function appendBBox(lines: string[], pad: string, node: SceneNode): void {
  lines.push(`${pad}  <bbox x="${node.x}" y="${node.y}" w="${node.width}" h="${node.height}" />`)
}

function appendPorts(lines: string[], pad: string, node: SceneNode): void {
  lines.push(
    `${pad}  <port id="${escapeXml(node.id)}-top" x="${node.x + node.width / 2}" y="${node.y}" />`
  )
  lines.push(
    `${pad}  <port id="${escapeXml(node.id)}-right" x="${node.x + node.width}" y="${node.y + node.height / 2}" />`
  )
  lines.push(
    `${pad}  <port id="${escapeXml(node.id)}-bottom" x="${node.x + node.width / 2}" y="${node.y + node.height}" />`
  )
  lines.push(
    `${pad}  <port id="${escapeXml(node.id)}-left" x="${node.x}" y="${node.y + node.height / 2}" />`
  )
}

function compartmentRefAttr(graph: SceneGraph, node: SceneNode): string {
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  return parent?.type === 'COMPARTMENT' ? ` compartmentRef="${escapeXml(parent.id)}"` : ''
}

function writeCompartmentNode(
  graph: SceneGraph,
  node: SceneNode,
  lines: string[],
  pad: string,
  indent: number
): void {
  lines.push(`${pad}<glyph id="${escapeXml(node.id)}" class="compartment">`)
  appendBBox(lines, pad, node)
  if (node.name && node.name !== 'Compartment') {
    lines.push(`${pad}  <label text="${escapeXml(node.name)}" />`)
  }
  for (const childId of node.childIds) {
    collectNodes(graph, childId, lines, indent + 1)
  }
  lines.push(`${pad}</glyph>`)
}

function writeEntityGlyph(
  graph: SceneGraph,
  node: SceneNode,
  glyphType: PathwayGlyphType,
  data: { stateVariables?: { variable: string; value?: string }[] },
  lines: string[],
  pad: string
): void {
  const cls = GLYPH_TYPE_TO_CLASS[glyphType] ?? 'unspecified entity'
  const compRef = compartmentRefAttr(graph, node)
  lines.push(`${pad}<glyph id="${escapeXml(node.id)}" class="${cls}"${compRef}>`)
  appendBBox(lines, pad, node)
  if (node.name) {
    lines.push(`${pad}  <label text="${escapeXml(node.name)}" />`)
  }
  if (data.stateVariables) {
    for (const sv of data.stateVariables) {
      const valueAttr = sv.value ? ` value="${escapeXml(sv.value)}"` : ''
      lines.push(`${pad}  <state variable="${escapeXml(sv.variable)}"${valueAttr} />`)
    }
  }
  appendPorts(lines, pad, node)
  lines.push(`${pad}</glyph>`)
}

function writeProcessGlyph(
  graph: SceneGraph,
  node: SceneNode,
  processType: PathwayProcessType,
  lines: string[],
  pad: string
): void {
  const cls = PROCESS_TYPE_TO_CLASS[processType] ?? 'process'
  const compRef = compartmentRefAttr(graph, node)
  lines.push(`${pad}<glyph id="${escapeXml(node.id)}" class="${cls}"${compRef}>`)
  appendBBox(lines, pad, node)
  if (node.name) {
    lines.push(`${pad}  <label text="${escapeXml(node.name)}" />`)
  }
  appendPorts(lines, pad, node)
  lines.push(`${pad}</glyph>`)
}

function writeArc(
  node: SceneNode,
  arcType: PathwayArcType,
  data: { sourceId?: string; targetId?: string; bendPoints?: Vector[] },
  lines: string[],
  pad: string
): void {
  const cls = ARC_TYPE_TO_CLASS[arcType] ?? 'modulation'
  const sourceId = data.sourceId ?? ''
  const targetId = data.targetId ?? ''
  lines.push(
    `${pad}<arc id="${escapeXml(node.id)}" class="${cls}" source="${escapeXml(sourceId)}" target="${escapeXml(targetId)}">`
  )
  const logicGlyph = LOGIC_ARC_GLYPH_CLASS[arcType]
  if (logicGlyph) {
    lines.push(`${pad}  <glyph id="${escapeXml(node.id)}-logic" class="${logicGlyph}" />`)
  }
  if (data.bendPoints) {
    for (const bp of data.bendPoints) {
      lines.push(`${pad}  <point x="${bp.x}" y="${bp.y}" />`)
    }
  }
  lines.push(`${pad}</arc>`)
}

function collectNodes(graph: SceneGraph, nodeId: string, lines: string[], indent: number): void {
  const node = graph.getNode(nodeId)
  if (!node) return

  const pad = '  '.repeat(indent)
  const data = getPathwayData(node)

  if (node.type === 'COMPARTMENT') {
    writeCompartmentNode(graph, node, lines, pad, indent)
  } else if (node.type === 'PATHWAY_GLYPH' && data?.glyphType) {
    writeEntityGlyph(graph, node, data.glyphType, data, lines, pad)
  } else if (node.type === 'PATHWAY_PROCESS' && data?.processType) {
    writeProcessGlyph(graph, node, data.processType, lines, pad)
  } else if (node.type === 'PATHWAY_ARC' && data?.arcType) {
    writeArc(node, data.arcType, data, lines, pad)
  }
}
