import { describe, expect, test } from 'bun:test'

import {
  SceneGraph,
  getPathwayData,
  setPathwayData,
  updatePathwayData,
  PATHWAY_PLUGIN_ID,
  PATHWAY_PLUGIN_KEY,
  type PathwayNodeData
} from '@signal-forge/scene-graph'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

describe('pathway data — accessor round-trip', () => {
  test('getPathwayData returns null for node without pathway data', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('PATHWAY_GLYPH', pageId(graph))
    expect(getPathwayData(node)).toBeNull()
  })

  test('setPathwayData / getPathwayData round-trip', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('PATHWAY_GLYPH', pageId(graph))
    const data: PathwayNodeData = { glyphType: 'macromolecule', cloneMarker: true }
    setPathwayData(node, data)
    const result = getPathwayData(node)
    expect(result).not.toBeNull()
    expect(result?.glyphType).toBe('macromolecule')
    expect(result?.cloneMarker).toBe(true)
  })

  test('updatePathwayData merges partial data', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('PATHWAY_GLYPH', pageId(graph))
    setPathwayData(node, { glyphType: 'simple_chemical' })
    updatePathwayData(node, { cloneMarker: true })
    const result = getPathwayData(node)
    expect(result?.glyphType).toBe('simple_chemical')
    expect(result?.cloneMarker).toBe(true)
  })

  test('updatePathwayData on node without existing data creates new entry', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('PATHWAY_GLYPH', pageId(graph))
    updatePathwayData(node, { glyphType: 'complex' })
    expect(getPathwayData(node)?.glyphType).toBe('complex')
  })
})

describe('pathway data — copy independence', () => {
  test('cloned node has identical pathway data', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const original = graph.createNode('PATHWAY_GLYPH', page, {
      name: 'EGFR',
      pluginData: [
        {
          pluginId: PATHWAY_PLUGIN_ID,
          key: PATHWAY_PLUGIN_KEY,
          value: JSON.stringify({
            glyphType: 'macromolecule',
            stateVariables: [{ variable: 'active', value: 'yes' }]
          })
        }
      ]
    })
    const clone = graph.cloneTree(original.id, page)
    expect(clone).not.toBeNull()
    if (!clone) throw new Error('clone tree not created')

    const origData = getPathwayData(original)
    const cloneData = getPathwayData(clone)
    expect(cloneData).not.toBeNull()
    expect(cloneData?.glyphType).toBe(origData?.glyphType)
    expect(cloneData?.stateVariables).toEqual(origData?.stateVariables)
  })

  test('mutating cloned pathway data does not affect original', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const original = graph.createNode('PATHWAY_GLYPH', page, {
      name: 'TP53',
      pluginData: [
        {
          pluginId: PATHWAY_PLUGIN_ID,
          key: PATHWAY_PLUGIN_KEY,
          value: JSON.stringify({ glyphType: 'macromolecule' })
        }
      ]
    })
    const clone = graph.cloneTree(original.id, page)
    expect(clone).not.toBeNull()
    if (!clone) throw new Error('clone tree not created')

    updatePathwayData(clone, { glyphType: 'phenotype' })
    expect(getPathwayData(original)?.glyphType).toBe('macromolecule')
    expect(getPathwayData(clone)?.glyphType).toBe('phenotype')
  })
})

describe('pathway node types — createDefaultNode', () => {
  test('PATHWAY_GLYPH has default size 100x100', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('PATHWAY_GLYPH', pageId(graph))
    expect(node.width).toBe(100)
    expect(node.height).toBe(100)
  })

  test('PATHWAY_PROCESS has default size 24x24', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('PATHWAY_PROCESS', pageId(graph))
    expect(node.width).toBe(24)
    expect(node.height).toBe(24)
  })

  test('PATHWAY_ARC has default size 0x0', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('PATHWAY_ARC', pageId(graph))
    expect(node.width).toBe(0)
    expect(node.height).toBe(0)
  })

  test('COMPARTMENT has default size 800x600 and is a container', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('COMPARTMENT', pageId(graph))
    expect(node.width).toBe(800)
    expect(node.height).toBe(600)
    expect(graph.isContainer(node.id)).toBe(true)
  })
})
