/**
 * BioPath MCP Tool Refactoring — Acceptance Test
 *
 * Validates that all review fixes are correct and the refactoring
 * achieves its goals: BioPath tools replace design tools for
 * AI/MCP/CLI surfaces without breaking the build.
 */
import { describe, it, expect } from 'bun:test'

import { SceneGraph } from '@signal-forge/scene-graph'
import {
  getPathwayData,
  setPathwayData,
  updatePathwayData,
  ANNOTATION_PLUGIN_KEY,
  PATHWAY_PLUGIN_ID,
  type PathwayNodeData,
  type PathwayAnnotation,
  type PathwayAnnotationType,
} from '@signal-forge/scene-graph'

import { FigmaAPI } from '@signal-forge/core/figma-api'
import {
  BIOPATH_CORE_TOOLS,
  BIOPATH_EXTENDED_TOOLS,
  BIOPATH_TOOLS,
  type ToolDef,
  type ParamType,
} from '@signal-forge/core/tools'

const VALID_PARAM_TYPES: ReadonlySet<string> = new Set<string>([
  'string', 'number', 'boolean', 'color', 'string[]'
])

describe('BioPath MCP Tool Refactoring — Acceptance', () => {

  describe('T1: BIOPATH_TOOLS registry completeness', () => {
    it('BIOPATH_TOOLS has correct tool count (core + extended, no overlap)', () => {
      expect(BIOPATH_CORE_TOOLS.length).toBe(36)
      expect(BIOPATH_EXTENDED_TOOLS.length).toBe(29)
      expect(BIOPATH_TOOLS.length).toBe(65)
    })

    it('BIOPATH_TOOLS = CORE + EXTENDED with no overlap', () => {
      const coreNames = new Set(BIOPATH_CORE_TOOLS.map(t => t.name))
      const extNames = new Set(BIOPATH_EXTENDED_TOOLS.map(t => t.name))
      for (const name of coreNames) {
        expect(extNames.has(name)).toBe(false)
      }
      expect(BIOPATH_TOOLS.length).toBe(coreNames.size + extNames.size)
    })

    it('all tools have required fields', () => {
      for (const tool of BIOPATH_TOOLS) {
        expect(typeof tool.name).toBe('string')
        expect(tool.name.length).toBeGreaterThan(0)
        expect(typeof tool.description).toBe('string')
        expect(tool.description.length).toBeGreaterThan(0)
        expect(typeof tool.params).toBe('object')
        expect(typeof tool.execute).toBe('function')
      }
    })
  })

  describe('T2: Tool param schema legality — no unsupported types', () => {
    it('every param type is in ParamType union', () => {
      for (const tool of BIOPATH_TOOLS) {
        for (const [key, param] of Object.entries(tool.params)) {
          expect(
            VALID_PARAM_TYPES.has(param.type),
            `${tool.name}.${key} has invalid param type "${param.type}"`
          ).toBe(true)
        }
      }
    })
  })

  describe('T3: P0 fix validation — runtime API correctness', () => {
    it('removeArc uses graph.deleteNode (not removeNode)', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const page = api.currentPage

      const entity = api.createPathwayGlyph('macromolecule', { name: 'A' })
      page.appendChild(entity)
      const process = api.createPathwayProcess('process', { name: 'R' })
      page.appendChild(process)
      const arc = api.createPathwayArc('consumption', entity.id, process.id)
      page.appendChild(arc)

      expect(typeof graph.deleteNode).toBe('function')
      expect(typeof (graph as Record<string, unknown>).removeNode).toBe('undefined')

      const removeArcTool = BIOPATH_TOOLS.find(t => t.name === 'remove_arc')!
      const result = removeArcTool.execute(api, { node_id: arc.id }) as Record<string, unknown>
      expect(result.removed).toBe(true)
      expect(graph.getNode(arc.id)).toBeUndefined()
    })

    it('modifyArc does not call requestRender (FigmaAPI has no such method)', () => {
      expect(typeof (FigmaAPI.prototype as Record<string, unknown>).requestRender).toBe('undefined')
    })

    it('importSbgnMl uses getPages() not rootPageIds (SceneGraph has no rootPageIds)', () => {
      const graph = new SceneGraph()
      expect(typeof graph.getPages).toBe('function')
      expect(typeof (graph as Record<string, unknown>).rootPageIds).toBe('undefined')
    })

    it('splitPathway creates page without name arg + renames', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const page = api.currentPage

      const comp = api.createCompartment('Cytoplasm', { x: 0, y: 0, width: 800, height: 600 })
      page.appendChild(comp)
      const entity = api.createPathwayGlyph('macromolecule', { name: 'EGFR' })
      comp.appendChild(entity)

      const splitTool = BIOPATH_TOOLS.find(t => t.name === 'split_pathway')!
      const result = splitTool.execute(api, { strategy: 'by_compartment' }) as Record<string, unknown>

      expect(result.pages_created).toBe(1)
      const pages = result.pages as Array<{ page_name: string; entity_count: number }>
      expect(pages[0].page_name).toBe('Cytoplasm')
      expect(pages[0].entity_count).toBe(1)

      const newPage = graph.getPages().find(p => p.name === 'Cytoplasm')
      expect(newPage).toBeDefined()
    })

    it('overlayExpressionData accepts string JSON (not object)', () => {
      const overlayTool = BIOPATH_TOOLS.find(t => t.name === 'overlay_expression_data')!
      const dataParam = overlayTool.params.data_json
      expect(dataParam.type).toBe('string')

      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const result = overlayTool.execute(api, {
        data_json: '{"EGFR": 0.5}'
      }) as Record<string, unknown>
      expect(result.entities_in_data).toBe(1)

      const badResult = overlayTool.execute(api, {
        data_json: 'not-json'
      }) as Record<string, unknown>
      expect(badResult.error).toBeDefined()
    })
  })

  describe('T4: PathwayNodeData multimer + activeState fields', () => {
    it('multimer field can be set and read', () => {
      const graph = new SceneGraph()
      const page = graph.getPages()[0]
      const node = graph.createNode('PATHWAY_GLYPH', page.id, { name: 'EGFR' })

      updatePathwayData(node, { multimer: true })
      expect(getPathwayData(node)?.multimer).toBe(true)

      updatePathwayData(node, { multimer: false })
      expect(getPathwayData(node)?.multimer).toBe(false)
    })

    it('activeState field can be set and read', () => {
      const graph = new SceneGraph()
      const page = graph.getPages()[0]
      const node = graph.createNode('PATHWAY_GLYPH', page.id, { name: 'JAK2' })

      updatePathwayData(node, { activeState: true })
      expect(getPathwayData(node)?.activeState).toBe(true)

      updatePathwayData(node, { activeState: false })
      expect(getPathwayData(node)?.activeState).toBe(false)
    })

    it('setCloneMarker tool writes cloneMarker field', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const page = api.currentPage
      const entity = api.createPathwayGlyph('macromolecule', { name: 'STAT3' })
      page.appendChild(entity)

      const tool = BIOPATH_TOOLS.find(t => t.name === 'set_clone_marker')!
      const result = tool.execute(api, { node_id: entity.id, enabled: true }) as Record<string, unknown>
      expect(result.clone_marker).toBe(true)

      const rawNode = graph.getNode(entity.id)
      expect(getPathwayData(rawNode!)?.cloneMarker).toBe(true)
    })

    it('addMultimer tool writes multimer field', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const page = api.currentPage
      const entity = api.createPathwayGlyph('simple_chemical', { name: 'ATP' })
      page.appendChild(entity)

      const tool = BIOPATH_TOOLS.find(t => t.name === 'add_multimer')!
      const result = tool.execute(api, { node_id: entity.id, enabled: true }) as Record<string, unknown>
      expect(result.multimer).toBe(true)

      const rawNode = graph.getNode(entity.id)
      expect(getPathwayData(rawNode!)?.multimer).toBe(true)
    })

    it('setActiveState tool writes activeState field', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const page = api.currentPage
      const entity = api.createPathwayGlyph('macromolecule', { name: 'JAK2' })
      page.appendChild(entity)

      const tool = BIOPATH_TOOLS.find(t => t.name === 'set_active_state')!
      const result = tool.execute(api, { node_id: entity.id, enabled: true }) as Record<string, unknown>
      expect(result.active_state).toBe(true)

      const rawNode = graph.getNode(entity.id)
      expect(getPathwayData(rawNode!)?.activeState).toBe(true)
    })
  })

  describe('T5: PathwayAnnotation type export', () => {
    it('ANNOTATION_PLUGIN_KEY is exported', () => {
      expect(ANNOTATION_PLUGIN_KEY).toBe('pathway-annotations')
    })

    it('annotation data round-trips through pluginData', () => {
      const graph = new SceneGraph()
      const page = graph.getPages()[0]
      const node = graph.createNode('PATHWAY_GLYPH', page.id, { name: 'TP53' })

      const annotation: PathwayAnnotation = { type: 'doi', value: '10.1234/test' }
      const idx = node.pluginData.findIndex(
        e => e.pluginId === PATHWAY_PLUGIN_ID && e.key === ANNOTATION_PLUGIN_KEY
      )
      const entry = { pluginId: PATHWAY_PLUGIN_ID, key: ANNOTATION_PLUGIN_KEY, value: JSON.stringify([annotation]) }
      if (idx !== -1) node.pluginData[idx] = entry
      else node.pluginData.push(entry)

      const stored = node.pluginData.find(
        e => e.pluginId === PATHWAY_PLUGIN_ID && e.key === ANNOTATION_PLUGIN_KEY
      )
      expect(stored).toBeDefined()
      const parsed = JSON.parse(stored!.value) as PathwayAnnotation[]
      expect(parsed[0].type).toBe('doi')
      expect(parsed[0].value).toBe('10.1234/test')
    })

    it('annotatePathway tool validates empty value', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const page = api.currentPage
      const entity = api.createPathwayGlyph('macromolecule', { name: 'BRCA1' })
      page.appendChild(entity)

      const tool = BIOPATH_TOOLS.find(t => t.name === 'annotate_pathway')!
      const result = tool.execute(api, {
        node_id: entity.id,
        type: 'doi',
        value: '   '
      }) as Record<string, unknown>
      expect(result.error).toBeDefined()
    })

    it('annotatePathway tool validates max length', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const page = api.currentPage
      const entity = api.createPathwayGlyph('macromolecule', { name: 'BRCA1' })
      page.appendChild(entity)

      const tool = BIOPATH_TOOLS.find(t => t.name === 'annotate_pathway')!
      const result = tool.execute(api, {
        node_id: entity.id,
        type: 'url',
        value: 'x'.repeat(2049)
      }) as Record<string, unknown>
      expect(result.error).toBeDefined()
    })

    it('annotatePathway tool rejects invalid type', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const page = api.currentPage
      const entity = api.createPathwayGlyph('macromolecule', { name: 'BRCA1' })
      page.appendChild(entity)

      const tool = BIOPATH_TOOLS.find(t => t.name === 'annotate_pathway')!
      const result = tool.execute(api, {
        node_id: entity.id,
        type: 'invalid_type',
        value: 'test'
      }) as Record<string, unknown>
      expect(result.error).toBeDefined()
    })
  })

  describe('T6: handleNewDocument template=pathway creates compartments', () => {
    it('FigmaAPI.createCompartment works and creates COMPARTMENT nodes', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const page = api.currentPage

      const extracellular = api.createCompartment('Extracellular', { x: 0, y: 0, width: 1200, height: 200 })
      page.appendChild(extracellular)
      const cytoplasm = api.createCompartment('Cytoplasm', { x: 0, y: 200, width: 1200, height: 500 })
      page.appendChild(cytoplasm)

      const rawPage = graph.getNode(page.id)
      expect(rawPage!.childIds.length).toBe(2)

      const comp1 = graph.getNode(extracellular.id)
      expect(comp1?.type).toBe('COMPARTMENT')
      expect(comp1?.name).toBe('Extracellular')

      const comp2 = graph.getNode(cytoplasm.id)
      expect(comp2?.type).toBe('COMPARTMENT')
      expect(comp2?.name).toBe('Cytoplasm')
    })
  })

  describe('T7: All BIOPATH tool params use only valid ParamType values (MCP/AI compatible)', () => {
    it('every param type is in the valid set that paramToZod/paramToValibot handle', () => {
      const validTypes = new Set<string>(['string', 'number', 'boolean', 'color', 'string[]'])
      for (const tool of BIOPATH_TOOLS) {
        for (const [key, param] of Object.entries(tool.params)) {
          expect(
            validTypes.has(param.type),
            `${tool.name}.${key} has unsupported param type "${param.type}" — paramToZod/paramToValibot will crash`
          ).toBe(true)
        }
      }
    })
  })

  describe('T8: Tool names are unique', () => {
    it('no duplicate tool names in BIOPATH_TOOLS', () => {
      const names = BIOPATH_TOOLS.map(t => t.name)
      const unique = new Set(names)
      expect(unique.size).toBe(names.length)
    })

    it('no duplicate tool names across CORE and EXTENDED', () => {
      const coreNames = BIOPATH_CORE_TOOLS.map(t => t.name)
      const extNames = BIOPATH_EXTENDED_TOOLS.map(t => t.name)
      const overlap = coreNames.filter(n => extNames.includes(n))
      expect(overlap.length).toBe(0)
    })
  })

  describe('T9: validatePathway/autoLayoutPathway/queryPathwayDb in CORE', () => {
    it('validatePathway is in BIOPATH_CORE_TOOLS', () => {
      expect(BIOPATH_CORE_TOOLS.some(t => t.name === 'validate_pathway')).toBe(true)
    })

    it('autoLayoutPathway is in BIOPATH_CORE_TOOLS', () => {
      expect(BIOPATH_CORE_TOOLS.some(t => t.name === 'auto_layout_pathway')).toBe(true)
    })

    it('queryPathwayDb is in BIOPATH_CORE_TOOLS', () => {
      expect(BIOPATH_CORE_TOOLS.some(t => t.name === 'query_pathway_db')).toBe(true)
    })
  })

  describe('T10: validate_pathway tool functional test', () => {
    it('detects arc-between-entities error', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const page = api.currentPage

      const e1 = api.createPathwayGlyph('macromolecule', { name: 'A' })
      page.appendChild(e1)
      const e2 = api.createPathwayGlyph('macromolecule', { name: 'B' })
      page.appendChild(e2)
      const arc = api.createPathwayArc('modulation', e1.id, e2.id)
      page.appendChild(arc)

      const tool = BIOPATH_TOOLS.find(t => t.name === 'validate_pathway')!
      const result = tool.execute(api, {}) as Record<string, unknown>
      expect(result.valid).toBe(false)

      const errors = result.errors as Array<{ rule: string }>
      expect(errors.some(e => e.rule === 'arc-between-entities')).toBe(true)
    })

    it('returns valid=true for compliant pathway', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const page = api.currentPage

      const comp = api.createCompartment('Cytoplasm', { x: 0, y: 0, width: 800, height: 600 })
      page.appendChild(comp)
      const e1 = api.createPathwayGlyph('macromolecule', { name: 'A' })
      comp.appendChild(e1)
      const proc = api.createPathwayProcess('process', { name: 'R' })
      comp.appendChild(proc)
      const e2 = api.createPathwayGlyph('simple_chemical', { name: 'B' })
      comp.appendChild(e2)

      const consumption = api.createPathwayArc('consumption', e1.id, proc.id)
      comp.appendChild(consumption)
      const production = api.createPathwayArc('production', proc.id, e2.id)
      comp.appendChild(production)

      const tool = BIOPATH_TOOLS.find(t => t.name === 'validate_pathway')!
      const result = tool.execute(api, {}) as Record<string, unknown>
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })
  })

  describe('T11: modify_arc runtime validation', () => {
    it('rejects invalid arc_type', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const page = api.currentPage

      const e1 = api.createPathwayGlyph('macromolecule', { name: 'A' })
      page.appendChild(e1)
      const proc = api.createPathwayProcess('process', { name: 'R' })
      page.appendChild(proc)
      const arc = api.createPathwayArc('consumption', e1.id, proc.id)
      page.appendChild(arc)

      const tool = BIOPATH_TOOLS.find(t => t.name === 'modify_arc')!
      const result = tool.execute(api, {
        node_id: arc.id,
        arc_type: 'not_a_real_type'
      }) as Record<string, unknown>
      expect(result.error).toBeDefined()
      expect((result.error as string).includes('Invalid arc_type')).toBe(true)
    })

    it('accepts valid arc_type change', () => {
      const graph = new SceneGraph()
      const api = new FigmaAPI(graph)
      const page = api.currentPage

      const e1 = api.createPathwayGlyph('macromolecule', { name: 'A' })
      page.appendChild(e1)
      const proc = api.createPathwayProcess('process', { name: 'R' })
      page.appendChild(proc)
      const arc = api.createPathwayArc('consumption', e1.id, proc.id)
      page.appendChild(arc)

      const tool = BIOPATH_TOOLS.find(t => t.name === 'modify_arc')!
      const result = tool.execute(api, {
        node_id: arc.id,
        arc_type: 'catalysis'
      }) as Record<string, unknown>
      expect(result.id).toBe(arc.id)
      expect((result.updated as string[])).toContain('arcType')

      const rawNode = graph.getNode(arc.id)
      expect(getPathwayData(rawNode!)?.arcType).toBe('catalysis')
    })
  })

  describe('T12: export_sbgn_ml tool', () => {
    it('has no page_id param (removed per H3)', () => {
      const tool = BIOPATH_TOOLS.find(t => t.name === 'export_sbgn_ml')!
      expect(Object.keys(tool.params)).not.toContain('page_id')
      expect(Object.keys(tool.params).length).toBe(0)
    })
  })
})
