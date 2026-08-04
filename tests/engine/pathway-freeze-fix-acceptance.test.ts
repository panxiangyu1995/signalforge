import { describe, it, expect } from 'bun:test'

import { SceneGraph } from '@signal-forge/scene-graph'

import { FigmaAPI } from '@signal-forge/core/figma-api'
import { BIOPATH_CORE_TOOLS, type ToolDef } from '@signal-forge/core/tools'

function findTool(name: string): ToolDef {
  const tool = BIOPATH_CORE_TOOLS.find(t => t.name === name)
  expect(tool, `Tool "${name}" not found in BIOPATH_CORE_TOOLS`).toBeDefined()
  return tool!
}

describe('create_pathway Freeze Fix — Acceptance', () => {

  describe('A1: Atomic tools exist and have small params', () => {
    it('begin_pathway exists with no params', () => {
      const tool = findTool('begin_pathway')
      expect(Object.keys(tool.params).length).toBe(0)
    })

    it('end_pathway exists with no params', () => {
      const tool = findTool('end_pathway')
      expect(Object.keys(tool.params).length).toBe(0)
    })

    it('add_entity has name + glyph_type + optional compartment/state_variables/clone_marker', () => {
      const tool = findTool('add_entity')
      expect(tool.params.name.required).toBe(true)
      expect(tool.params.glyph_type.required).toBe(true)
      expect(tool.params.compartment).toBeDefined()
      expect(tool.params.state_variables).toBeDefined()
      expect(tool.params.clone_marker).toBeDefined()
    })

    it('add_process has name + process_type + optional compartment', () => {
      const tool = findTool('add_process')
      expect(tool.params.name.required).toBe(true)
      expect(tool.params.process_type.required).toBe(true)
      expect(tool.params.compartment).toBeDefined()
    })

    it('add_arc has source + target + arc_type', () => {
      const tool = findTool('add_arc')
      expect(tool.params.source).toBeDefined()
      expect(tool.params.target).toBeDefined()
      expect(tool.params.arc_type.required).toBe(true)
    })

    it('add_compartment has name (not label)', () => {
      const tool = findTool('add_compartment')
      expect(tool.params.name).toBeDefined()
      expect(tool.params.name.required).toBe(true)
      expect(tool.params.label).toBeUndefined()
    })
  })

  describe('A2: Batch mode — pathwayBatch flag', () => {
    it('begin_pathway sets pathwayBatch=true, end_pathway clears it', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)

      expect(api.pathwayBatch).toBe(false)
      api.beginPathwayBatch()
      expect(api.pathwayBatch).toBe(true)
      api.endPathwayBatch()
      expect(api.pathwayBatch).toBe(false)
    })

    it('events are muted during batch, unmuted after', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)

      expect(graph.eventsMuted).toBe(false)
      api.beginPathwayBatch()
      expect(graph.eventsMuted).toBe(true)
      api.endPathwayBatch()
      expect(graph.eventsMuted).toBe(false)
    })

    it('end_pathway without begin_pathway returns error', () => {
      const tool = findTool('end_pathway')
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const result = tool.execute(api, {}) as Record<string, unknown>
      expect(result.error).toBeDefined()
    })

    it('nested begin_pathway does not break on end (H2 fix)', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)

      api.beginPathwayBatch()
      api.beginPathwayBatch()
      expect(api.pathwayBatch).toBe(true)

      api.endPathwayBatch()
      expect(api.pathwayBatch).toBe(true)

      api.endPathwayBatch()
      expect(api.pathwayBatch).toBe(false)
    })
  })

  describe('A3: Error recovery — resetPathwayBatch (H1 fix)', () => {
    it('resetPathwayBatch clears stuck batch state', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)

      api.beginPathwayBatch()
      expect(api.pathwayBatch).toBe(true)
      expect(graph.eventsMuted).toBe(true)

      api.resetPathwayBatch()
      expect(api.pathwayBatch).toBe(false)
      expect(graph.eventsMuted).toBe(false)
    })
  })

  describe('A4: add_entity creates node with SBGN canonical sizes', () => {
    it('macromolecule gets 96x48', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const result = findTool('add_entity').execute(api, {
        name: 'JAK2', glyph_type: 'macromolecule'
      }) as Record<string, unknown>
      const node = graph.getNode(result.id as string)!
      expect(node.width).toBe(96)
      expect(node.height).toBe(48)
    })

    it('simple_chemical gets 48x48', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const result = findTool('add_entity').execute(api, {
        name: 'ATP', glyph_type: 'simple_chemical'
      }) as Record<string, unknown>
      const node = graph.getNode(result.id as string)!
      expect(node.width).toBe(48)
      expect(node.height).toBe(48)
    })

    it('process gets 24x24', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const result = findTool('add_process').execute(api, {
        name: 'R', process_type: 'process'
      }) as Record<string, unknown>
      const node = graph.getNode(result.id as string)!
      expect(node.width).toBe(24)
      expect(node.height).toBe(24)
    })
  })

  describe('A5: Compartment containment', () => {
    it('add_entity places node inside compartment', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      findTool('add_compartment').execute(api, { name: 'Cytoplasm' })
      const result = findTool('add_entity').execute(api, {
        name: 'JAK2', glyph_type: 'macromolecule', compartment: 'Cytoplasm'
      }) as Record<string, unknown>
      const node = graph.getNode(result.id as string)!
      expect(node.parentId).not.toBe(graph.getPages()[0].id)
      const parent = graph.getNode(node.parentId!)!
      expect(parent.type).toBe('COMPARTMENT')
      expect(parent.name).toBe('Cytoplasm')
    })

    it('add_entity warns when compartment not found (H4 fix)', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const result = findTool('add_entity').execute(api, {
        name: 'X', glyph_type: 'macromolecule', compartment: 'NonExistent'
      }) as Record<string, unknown>
      expect(result.warnings).toBeDefined()
      expect((result.warnings as string[]).some(w => w.includes('not found'))).toBe(true)
    })
  })

  describe('A6: add_arc name-based lookup', () => {
    it('finds nodes by name and creates arc', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      findTool('add_entity').execute(api, { name: 'JAK2', glyph_type: 'macromolecule' })
      findTool('add_process').execute(api, { name: 'R', process_type: 'process' })
      const result = findTool('add_arc').execute(api, {
        source: 'JAK2', target: 'R', arc_type: 'consumption'
      }) as Record<string, unknown>
      expect(result.id).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('returns explicit error when source not found (H3 fix)', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const result = findTool('add_arc').execute(api, {
        source: 'Ghost', target: 'AlsoGhost', arc_type: 'consumption'
      }) as Record<string, unknown>
      expect(result.error).toBeDefined()
      expect((result.error as string).includes('not found')).toBe(true)
    })

    it('warns on ambiguous (duplicate) names (H5 fix)', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      findTool('add_entity').execute(api, { name: 'STAT3', glyph_type: 'macromolecule' })
      findTool('add_entity').execute(api, { name: 'STAT3', glyph_type: 'macromolecule' })
      findTool('add_process').execute(api, { name: 'R', process_type: 'process' })
      const result = findTool('add_arc').execute(api, {
        source: 'STAT3', target: 'R', arc_type: 'catalysis'
      }) as Record<string, unknown>
      expect(result.warnings).toBeDefined()
      expect((result.warnings as string[]).some(w => w.includes('Multiple'))).toBe(true)
    })
  })

  describe('A7: create_pathway backward compat', () => {
    it('create_pathway exists with string params', () => {
      const tool = findTool('create_pathway')
      expect(tool.params.compartments.type).toBe('string')
    })

    it('description mentions simple pathways', () => {
      const tool = findTool('create_pathway')
      expect(tool.description.toLowerCase().includes('simple')).toBe(true)
    })
  })

  describe('A8: Step budget', () => {
    it('MAX_AGENT_STEPS is 100', async () => {
      const mod = await import('@/app/ai/tools')
      expect(mod.MAX_AGENT_STEPS).toBe(100)
    })
  })

  describe('A9: Full JAK-STAT workflow', () => {
    it('begin → add × N → end creates valid pathway', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const begin = findTool('begin_pathway')
      const end = findTool('end_pathway')
      const addComp = findTool('add_compartment')
      const addEnt = findTool('add_entity')
      const addProc = findTool('add_process')
      const addArc = findTool('add_arc')

      begin.execute(api, {})
      addComp.execute(api, { name: 'Cytoplasm' })
      addComp.execute(api, { name: 'Nucleus' })

      addEnt.execute(api, { name: 'JAK2', glyph_type: 'macromolecule', compartment: 'Cytoplasm' })
      addEnt.execute(api, { name: 'STAT3', glyph_type: 'macromolecule', compartment: 'Cytoplasm' })
      addEnt.execute(api, { name: 'pSTAT3', glyph_type: 'macromolecule', compartment: 'Nucleus' })
      addEnt.execute(api, { name: 'SOCS3', glyph_type: 'macromolecule', compartment: 'Cytoplasm' })
      addEnt.execute(api, { name: 'ATP', glyph_type: 'simple_chemical', compartment: 'Cytoplasm' })
      addEnt.execute(api, { name: 'Target Gene', glyph_type: 'nucleic_acid_feature', compartment: 'Nucleus' })

      addProc.execute(api, { name: 'JAK2 activation', process_type: 'process', compartment: 'Cytoplasm' })
      addProc.execute(api, { name: 'STAT3 phosphorylation', process_type: 'process', compartment: 'Cytoplasm' })
      addProc.execute(api, { name: 'STAT3 dimerization', process_type: 'process' })
      addProc.execute(api, { name: 'Nuclear translocation', process_type: 'transport' })
      addProc.execute(api, { name: 'Transcription', process_type: 'process', compartment: 'Nucleus' })
      addProc.execute(api, { name: 'SOCS3 inhibition', process_type: 'process', compartment: 'Cytoplasm' })

      addArc.execute(api, { source: 'JAK2', target: 'JAK2 activation', arc_type: 'consumption' })
      addArc.execute(api, { source: 'ATP', target: 'JAK2 activation', arc_type: 'consumption' })
      addArc.execute(api, { source: 'JAK2 activation', target: 'JAK2', arc_type: 'production' })
      addArc.execute(api, { source: 'JAK2', target: 'STAT3 phosphorylation', arc_type: 'catalysis' })
      addArc.execute(api, { source: 'STAT3', target: 'STAT3 phosphorylation', arc_type: 'consumption' })
      addArc.execute(api, { source: 'STAT3 phosphorylation', target: 'pSTAT3', arc_type: 'production' })
      addArc.execute(api, { source: 'SOCS3', target: 'SOCS3 inhibition', arc_type: 'consumption' })
      addArc.execute(api, { source: 'SOCS3 inhibition', target: 'JAK2', arc_type: 'inhibition' })
      addArc.execute(api, { source: 'pSTAT3', target: 'Transcription', arc_type: 'catalysis' })
      addArc.execute(api, { source: 'Transcription', target: 'Target Gene', arc_type: 'production' })

      const endResult = end.execute(api, {}) as Record<string, unknown>
      expect(endResult.status).toBe('batch ended')

      const page = graph.getPages()[0]
      let glyphCount = 0, processCount = 0, arcCount = 0, compCount = 0
      const stack = [...page.childIds]
      while (stack.length > 0) {
        const id = stack.pop()!
        const node = graph.getNode(id)
        if (!node) continue
        if (node.type === 'COMPARTMENT') compCount++
        else if (node.type === 'PATHWAY_GLYPH') glyphCount++
        else if (node.type === 'PATHWAY_PROCESS') processCount++
        else if (node.type === 'PATHWAY_ARC') arcCount++
        stack.push(...node.childIds)
      }

      expect(compCount).toBe(2)
      expect(glyphCount).toBe(6)
      expect(processCount).toBe(6)
      expect(arcCount).toBe(10)
    })
  })

  describe('A10: BFS on cyclic arcs (H7 fix)', () => {
    it('create_pathway with cyclic arcs completes within 2s', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const tool = findTool('create_pathway')

      const compartments = JSON.stringify([{ name: 'C' }])
      const entities = JSON.stringify([
        { name: 'A', glyph_type: 'macromolecule', compartment: 'C' },
        { name: 'B', glyph_type: 'macromolecule', compartment: 'C' },
        { name: 'C_node', glyph_type: 'macromolecule', compartment: 'C' },
      ])
      const processes = JSON.stringify([
        { name: 'P1', process_type: 'process', compartment: 'C' },
        { name: 'P2', process_type: 'process', compartment: 'C' },
        { name: 'P3', process_type: 'process', compartment: 'C' },
      ])
      const arcs = JSON.stringify([
        { source: 'A', target: 'P1', arc_type: 'consumption' },
        { source: 'P1', target: 'B', arc_type: 'production' },
        { source: 'B', target: 'P2', arc_type: 'consumption' },
        { source: 'P2', target: 'C_node', arc_type: 'production' },
        { source: 'C_node', target: 'P3', arc_type: 'consumption' },
        { source: 'P3', target: 'A', arc_type: 'production' },
      ])

      const start = Date.now()
      const result = tool.execute(api, { compartments, entities, processes, arcs }) as Record<string, unknown>
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(2000)
      expect(result.error).toBeUndefined()
    })
  })
})
