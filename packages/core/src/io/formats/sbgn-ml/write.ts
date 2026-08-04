import type { SceneGraph, SceneNode } from '@signal-forge/scene-graph'
import { getPathwayData } from '@signal-forge/scene-graph'

const GLYPH_TYPE_TO_CLASS: Record<string, string> = {
  'macromolecule': 'macromolecule',
  'simple_chemical': 'simple chemical',
  'complex': 'complex',
  'nucleic_acid_feature': 'nucleic acid feature',
  'unspecified_entity': 'unspecified entity',
  'perturbation': 'perturbing agent',
  'phenotype': 'phenotype',
  'source_sink': 'empty set',
}

const PROCESS_TYPE_TO_CLASS: Record<string, string> = {
  'process': 'process',
  'transport': 'transport',
  'association': 'association',
  'dissociation': 'dissociation',
  'omitted_process': 'omitted process',
  'uncertain_process': 'uncertain process',
}

const ARC_TYPE_TO_CLASS: Record<string, string> = {
  'consumption': 'consumption',
  'production': 'production',
  'modulation': 'modulation',
  'stimulation': 'stimulation',
  'catalysis': 'catalysis',
  'inhibition': 'inhibition',
  'necessary_stimulation': 'necessary stimulation',
  'trigger': 'trigger',
  'logic_and': 'logic arc',
  'logic_or': 'logic arc',
  'logic_not': 'logic arc',
  'equivalence': 'equivalence arc',
}

const LOGIC_ARC_GLYPH_CLASS: Record<string, string> = {
  'logic_and': 'and',
  'logic_or': 'or',
  'logic_not': 'not',
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
  const page = graph.getPages()[0]
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

function collectNodes(graph: SceneGraph, nodeId: string, lines: string[], indent: number): void {
  const node = graph.getNode(nodeId)
  if (!node) return

  const pad = '  '.repeat(indent)
  const data = getPathwayData(node)

  if (node.type === 'COMPARTMENT') {
    const cls = 'compartment'
    lines.push(`${pad}<glyph id="${escapeXml(node.id)}" class="${cls}">`)
    lines.push(`${pad}  <bbox x="${node.x}" y="${node.y}" w="${node.width}" h="${node.height}" />`)
    if (node.name && node.name !== 'Compartment') {
      lines.push(`${pad}  <label text="${escapeXml(node.name)}" />`)
    }
    for (const childId of node.childIds) {
      collectNodes(graph, childId, lines, indent + 1)
    }
    lines.push(`${pad}</glyph>`)
  } else if (node.type === 'PATHWAY_GLYPH' && data?.glyphType) {
    const cls = GLYPH_TYPE_TO_CLASS[data.glyphType] ?? 'unspecified entity'
    const parent = node.parentId ? graph.getNode(node.parentId) : undefined
    const compRef = parent?.type === 'COMPARTMENT' ? ` compartmentRef="${escapeXml(parent.id)}"` : ''
    lines.push(`${pad}<glyph id="${escapeXml(node.id)}" class="${cls}"${compRef}>`)
    lines.push(`${pad}  <bbox x="${node.x}" y="${node.y}" w="${node.width}" h="${node.height}" />`)
    if (node.name) {
      lines.push(`${pad}  <label text="${escapeXml(node.name)}" />`)
    }
    if (data.stateVariables) {
      for (const sv of data.stateVariables) {
        const valueAttr = sv.value ? ` value="${escapeXml(sv.value)}"` : ''
        lines.push(`${pad}  <state variable="${escapeXml(sv.variable)}"${valueAttr} />`)
      }
    }
    lines.push(`${pad}  <port id="${escapeXml(node.id)}-top" x="${node.x + node.width / 2}" y="${node.y}" />`)
    lines.push(`${pad}  <port id="${escapeXml(node.id)}-right" x="${node.x + node.width}" y="${node.y + node.height / 2}" />`)
    lines.push(`${pad}  <port id="${escapeXml(node.id)}-bottom" x="${node.x + node.width / 2}" y="${node.y + node.height}" />`)
    lines.push(`${pad}  <port id="${escapeXml(node.id)}-left" x="${node.x}" y="${node.y + node.height / 2}" />`)
    lines.push(`${pad}</glyph>`)
  } else if (node.type === 'PATHWAY_PROCESS' && data?.processType) {
    const cls = PROCESS_TYPE_TO_CLASS[data.processType] ?? 'process'
    const parent = node.parentId ? graph.getNode(node.parentId) : undefined
    const compRef = parent?.type === 'COMPARTMENT' ? ` compartmentRef="${escapeXml(parent.id)}"` : ''
    lines.push(`${pad}<glyph id="${escapeXml(node.id)}" class="${cls}"${compRef}>`)
    lines.push(`${pad}  <bbox x="${node.x}" y="${node.y}" w="${node.width}" h="${node.height}" />`)
    if (node.name) {
      lines.push(`${pad}  <label text="${escapeXml(node.name)}" />`)
    }
    lines.push(`${pad}  <port id="${escapeXml(node.id)}-top" x="${node.x + node.width / 2}" y="${node.y}" />`)
    lines.push(`${pad}  <port id="${escapeXml(node.id)}-right" x="${node.x + node.width}" y="${node.y + node.height / 2}" />`)
    lines.push(`${pad}  <port id="${escapeXml(node.id)}-bottom" x="${node.x + node.width / 2}" y="${node.y + node.height}" />`)
    lines.push(`${pad}  <port id="${escapeXml(node.id)}-left" x="${node.x}" y="${node.y + node.height / 2}" />`)
    lines.push(`${pad}</glyph>`)
  } else if (node.type === 'PATHWAY_ARC' && data?.arcType) {
    const cls = ARC_TYPE_TO_CLASS[data.arcType] ?? 'modulation'
    const sourceId = data.sourceId ?? ''
    const targetId = data.targetId ?? ''
    lines.push(`${pad}<arc id="${escapeXml(node.id)}" class="${cls}" source="${escapeXml(sourceId)}" target="${escapeXml(targetId)}">`)
    const logicGlyph = LOGIC_ARC_GLYPH_CLASS[data.arcType]
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
}
