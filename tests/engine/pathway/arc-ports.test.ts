import { describe, expect, it } from 'bun:test'

import { getPathwayData } from '@signal-forge/scene-graph'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { getTool, setupToolTest, type ToolResult } from '#tests/helpers/tools'

describe('pathway arc ports stay derived', () => {
  it('add_arc does not freeze creation-time port snapshots', () => {
    const { graph, figma } = setupToolTest()
    getTool('add_entity').execute(figma, { name: 'STAT3', glyph_type: 'macromolecule' })
    getTool('add_process').execute(figma, { name: 'R', process_type: 'process' })

    const result = getTool('add_arc').execute(figma, {
      source: 'STAT3',
      target: 'R',
      arc_type: 'catalysis'
    }) as ToolResult
    expect(result.error).toBeUndefined()

    const arc = getNodeOrThrow(graph, result.id)
    const data = getPathwayData(arc)
    expect(data?.sourceId).toBeDefined()
    expect(data?.targetId).toBeDefined()
    expect(data?.sourcePort).toBeUndefined()
    expect(data?.targetPort).toBeUndefined()
  })

  it('moving a glyph after arc creation leaves no stale port data behind', () => {
    const { graph, figma } = setupToolTest()
    getTool('add_entity').execute(figma, { name: 'A', glyph_type: 'macromolecule' })
    getTool('add_entity').execute(figma, { name: 'B', glyph_type: 'macromolecule' })

    const result = getTool('add_arc').execute(figma, {
      source: 'A',
      target: 'B',
      arc_type: 'consumption'
    }) as ToolResult
    expect(result.error).toBeUndefined()

    const source = getNodeOrThrow(graph, graph.getPages()[0].childIds[0])
    graph.updateNode(source.id, { x: source.x + 500, y: source.y + 300 })

    const arc = getNodeOrThrow(graph, result.id)
    const data = getPathwayData(arc)
    expect(data?.sourcePort).toBeUndefined()
    expect(data?.targetPort).toBeUndefined()
  })

  it('FigmaAPI.createPathwayArc keeps ports derived as well', () => {
    const { graph, figma } = setupToolTest()
    const source = figma.createPathwayGlyph('macromolecule', { name: 'A' })
    const target = figma.createPathwayGlyph('macromolecule', { name: 'B' })

    const arc = figma.createPathwayArc('production', source.id, target.id)
    const data = getPathwayData(getNodeOrThrow(graph, arc.id))
    expect(data?.arcType).toBe('production')
    expect(data?.sourcePort).toBeUndefined()
    expect(data?.targetPort).toBeUndefined()
  })
})
