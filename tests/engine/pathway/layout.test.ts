import { describe, it, expect } from 'bun:test'
import { SceneGraph, getPathwayData } from '@signal-forge/scene-graph'
import { FigmaAPI } from '@signal-forge/core/figma-api'
import { BIOPATH_CORE_TOOLS } from '@signal-forge/core/tools'
import { hierarchicalLayout } from '@signal-forge/core/pathway/layout/hierarchical'
import { computeOrthogonalBendPoints } from '@signal-forge/core/pathway/layout/orthogonal'

function findTool(name: string) {
  const tool = BIOPATH_CORE_TOOLS.find(t => t.name === name)
  if (!tool) throw new Error(`Tool not found: ${name}`)
  return tool
}

function createCompartmentPathway(api: FigmaAPI) {
  const begin = findTool('begin_pathway')
  const addComp = findTool('add_compartment')
  const addEnt = findTool('add_entity')
  const addProc = findTool('add_process')
  const addArc = findTool('add_arc')

  begin.execute(api, {})
  addComp.execute(api, { name: 'Cytoplasm' })
  addEnt.execute(api, { name: 'JAK2', glyph_type: 'macromolecule', compartment: 'Cytoplasm' })
  addEnt.execute(api, { name: 'STAT3', glyph_type: 'macromolecule', compartment: 'Cytoplasm' })
  addProc.execute(api, { name: 'phosphorylation', process_type: 'biochemical_reaction', compartment: 'Cytoplasm' })
  addArc.execute(api, { source: 'JAK2', target: 'phosphorylation', arc_type: 'consumption' })
  addArc.execute(api, { source: 'phosphorylation', target: 'STAT3', arc_type: 'production' })
  api.endPathwayBatch()
}

function countOverlaps(graph: SceneGraph): number {
  const positions: Array<{ absX: number; absY: number; w: number; h: number }> = []
  for (const [, node] of graph.nodes) {
    if (node.type === 'PATHWAY_GLYPH' || node.type === 'PATHWAY_PROCESS') {
      const abs = graph.getAbsolutePosition(node.id)
      positions.push({ absX: abs.x, absY: abs.y, w: node.width, h: node.height })
    }
  }
  let count = 0
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i]
      const b = positions[j]
      const overlapX = Math.abs((a.absX + a.w / 2) - (b.absX + b.w / 2)) < (a.w + b.w) / 2
      const overlapY = Math.abs((a.absY + a.h / 2) - (b.absY + b.h / 2)) < (a.h + b.h) / 2
      if (overlapX && overlapY) count++
    }
  }
  return count
}

function verifyCompartmentContainment(graph: SceneGraph): string[] {
  const violations: string[] = []
  for (const [, node] of graph.nodes) {
    if (node.type !== 'COMPARTMENT') continue
    const compAbs = graph.getAbsolutePosition(node.id)
    for (const gcId of node.childIds) {
      const gc = graph.getNode(gcId)
      if (!gc) continue
      const gcAbs = graph.getAbsolutePosition(gcId)
      if (gcAbs.x < compAbs.x) violations.push(`${gc.name} left edge outside ${node.name}`)
      if (gcAbs.y < compAbs.y) violations.push(`${gc.name} top edge outside ${node.name}`)
      if (gcAbs.x + gc.width > compAbs.x + node.width) violations.push(`${gc.name} right edge outside ${node.name}`)
      if (gcAbs.y + gc.height > compAbs.y + node.height) violations.push(`${gc.name} bottom edge outside ${node.name}`)
    }
  }
  return violations
}

function verifyLocalCoords(graph: SceneGraph): string[] {
  const violations: string[] = []
  for (const [, node] of graph.nodes) {
    if (node.type !== 'COMPARTMENT') continue
    const compAbs = graph.getAbsolutePosition(node.id)
    for (const gcId of node.childIds) {
      const gc = graph.getNode(gcId)
      if (!gc) continue
      const gcAbs = graph.getAbsolutePosition(gcId)
      const expectedLocalX = gcAbs.x - compAbs.x
      const expectedLocalY = gcAbs.y - compAbs.y
      if (Math.abs(gc.x - expectedLocalX) > 0.5) violations.push(`${gc.name} local x=${gc.x} expected=${expectedLocalX}`)
      if (Math.abs(gc.y - expectedLocalY) > 0.5) violations.push(`${gc.name} local y=${gc.y} expected=${expectedLocalY}`)
    }
  }
  return violations
}

describe('Pathway layout', () => {
  it('positions nodes inside Compartment correctly (top-bottom)', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    createCompartmentPathway(api)

    const pageId = api.currentPage.id
    const result = hierarchicalLayout(graph, pageId, { direction: 'top-bottom', spacing: 60 })

    expect(result.positioned).toBe(3)
    expect(result.layers).toBeGreaterThanOrEqual(2)
    expect(countOverlaps(graph)).toBe(0)
    expect(verifyCompartmentContainment(graph)).toEqual([])
    expect(verifyLocalCoords(graph)).toEqual([])
  })

  it('positions nodes inside Compartment correctly (left-right)', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    createCompartmentPathway(api)

    const pageId = api.currentPage.id
    const result = hierarchicalLayout(graph, pageId, { direction: 'left-right', spacing: 60 })

    expect(result.positioned).toBe(3)
    expect(result.layers).toBeGreaterThanOrEqual(2)
    expect(countOverlaps(graph)).toBe(0)
    expect(verifyCompartmentContainment(graph)).toEqual([])
    expect(verifyLocalCoords(graph)).toEqual([])
  })

  it('positions nodes without Compartment correctly', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)

    const begin = findTool('begin_pathway')
    const addEnt = findTool('add_entity')
    const addProc = findTool('add_process')
    const addArc = findTool('add_arc')

    begin.execute(api, {})
    addEnt.execute(api, { name: 'A', glyph_type: 'macromolecule' })
    addEnt.execute(api, { name: 'B', glyph_type: 'macromolecule' })
    addProc.execute(api, { name: 'r1', process_type: 'biochemical_reaction' })
    addArc.execute(api, { source: 'A', target: 'r1', arc_type: 'consumption' })
    addArc.execute(api, { source: 'r1', target: 'B', arc_type: 'production' })
    api.endPathwayBatch()

    const pageId = api.currentPage.id
    const result = hierarchicalLayout(graph, pageId, { direction: 'top-bottom', spacing: 60 })

    expect(result.positioned).toBe(3)
    expect(result.layers).toBeGreaterThanOrEqual(2)
    expect(countOverlaps(graph)).toBe(0)
  })

  it('computes orthogonal bend points after layout', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    createCompartmentPathway(api)

    const pageId = api.currentPage.id
    hierarchicalLayout(graph, pageId, { direction: 'top-bottom', spacing: 60 })
    const updated = computeOrthogonalBendPoints(graph, pageId, 'top-bottom')

    expect(updated).toBeGreaterThan(0)

    let hasBendPoints = false
    for (const [, node] of graph.nodes) {
      if (node.type === 'PATHWAY_ARC') {
        const data = getPathwayData(node)
        if (data?.bendPoints && data.bendPoints.length > 0) hasBendPoints = true
      }
    }
    expect(hasBendPoints).toBe(true)
  })

  it('handles multiple compartments with cross-compartment arcs', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)

    const begin = findTool('begin_pathway')
    const addComp = findTool('add_compartment')
    const addEnt = findTool('add_entity')
    const addProc = findTool('add_process')
    const addArc = findTool('add_arc')

    begin.execute(api, {})
    addComp.execute(api, { name: 'Cytoplasm' })
    addComp.execute(api, { name: 'Nucleus' })
    addEnt.execute(api, { name: 'JAK2', glyph_type: 'macromolecule', compartment: 'Cytoplasm' })
    addEnt.execute(api, { name: 'STAT3_p', glyph_type: 'macromolecule', compartment: 'Nucleus' })
    addProc.execute(api, { name: 'translocation', process_type: 'transport', compartment: 'Cytoplasm' })
    addArc.execute(api, { source: 'JAK2', target: 'translocation', arc_type: 'consumption' })
    addArc.execute(api, { source: 'translocation', target: 'STAT3_p', arc_type: 'production' })
    api.endPathwayBatch()

    const pageId = api.currentPage.id
    const result = hierarchicalLayout(graph, pageId, { direction: 'top-bottom', spacing: 60 })

    expect(result.positioned).toBe(3)
    expect(result.layers).toBeGreaterThanOrEqual(2)
    expect(countOverlaps(graph)).toBe(0)
    expect(verifyCompartmentContainment(graph)).toEqual([])
    expect(verifyLocalCoords(graph)).toEqual([])
  })

  it('handles feedback cycles without infinite loop', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)

    const begin = findTool('begin_pathway')
    const addEnt = findTool('add_entity')
    const addProc = findTool('add_process')
    const addArc = findTool('add_arc')

    begin.execute(api, {})
    addEnt.execute(api, { name: 'A', glyph_type: 'macromolecule' })
    addEnt.execute(api, { name: 'B', glyph_type: 'macromolecule' })
    addProc.execute(api, { name: 'r1', process_type: 'biochemical_reaction' })
    addProc.execute(api, { name: 'r2', process_type: 'biochemical_reaction' })
    addArc.execute(api, { source: 'A', target: 'r1', arc_type: 'consumption' })
    addArc.execute(api, { source: 'r1', target: 'B', arc_type: 'production' })
    addArc.execute(api, { source: 'B', target: 'r2', arc_type: 'consumption' })
    addArc.execute(api, { source: 'r2', target: 'A', arc_type: 'production' })
    api.endPathwayBatch()

    const pageId = api.currentPage.id
    const result = hierarchicalLayout(graph, pageId, { direction: 'top-bottom', spacing: 60 })

    expect(result.positioned).toBe(4)
    expect(result.layers).toBeGreaterThanOrEqual(2)
    expect(countOverlaps(graph)).toBe(0)
  })

  it('handles disconnected nodes', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)

    const begin = findTool('begin_pathway')
    const addEnt = findTool('add_entity')
    const addProc = findTool('add_process')
    const addArc = findTool('add_arc')

    begin.execute(api, {})
    addEnt.execute(api, { name: 'A', glyph_type: 'macromolecule' })
    addEnt.execute(api, { name: 'B', glyph_type: 'macromolecule' })
    addEnt.execute(api, { name: 'orphan', glyph_type: 'macromolecule' })
    addProc.execute(api, { name: 'r1', process_type: 'biochemical_reaction' })
    addArc.execute(api, { source: 'A', target: 'r1', arc_type: 'consumption' })
    addArc.execute(api, { source: 'r1', target: 'B', arc_type: 'production' })
    api.endPathwayBatch()

    const pageId = api.currentPage.id
    const result = hierarchicalLayout(graph, pageId, { direction: 'top-bottom', spacing: 60 })

    expect(result.positioned).toBe(4)
    expect(result.layers).toBeGreaterThanOrEqual(1)
    expect(countOverlaps(graph)).toBe(0)
  })

  it('verifies Compartment local coordinates after layout', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    createCompartmentPathway(api)

    const pageId = api.currentPage.id
    hierarchicalLayout(graph, pageId, { direction: 'top-bottom', spacing: 60 })

    for (const [, node] of graph.nodes) {
      if (node.type !== 'COMPARTMENT') continue
      const compAbs = graph.getAbsolutePosition(node.id)
      for (const gcId of node.childIds) {
        const gc = graph.getNode(gcId)
        if (!gc) continue
        const gcAbs = graph.getAbsolutePosition(gcId)
        const reconstructedAbsX = compAbs.x + gc.x
        const reconstructedAbsY = compAbs.y + gc.y
        expect(Math.abs(reconstructedAbsX - gcAbs.x)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(reconstructedAbsY - gcAbs.y)).toBeLessThanOrEqual(0.5)
      }
    }
  })
})
