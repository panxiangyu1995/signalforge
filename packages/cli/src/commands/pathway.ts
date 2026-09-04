import { readFileSync } from 'node:fs'

import { defineCommand } from 'citty'

import { readSbgnMl } from '@signal-forge/core/io'
import {
  findPathwaysByGene,
  getPathwayDetails,
  getPathwayParticipants,
  searchPathways
} from '@signal-forge/core/pathway'

import { ok, printError } from '#cli/format'
import { appTargetOptions } from '#cli/app-target'
import { loadRpcData } from '#cli/rpc-data'

const importCmd = defineCommand({
  meta: { description: 'Import SBGN-ML file to .fig' },
  args: {
    input: { type: 'positional', description: 'SBGN-ML file path', required: true },
    output: { type: 'string', alias: 'o', description: 'Output .fig file path' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const xml = readFileSync(args.input, 'utf-8')
      const graph = readSbgnMl(xml)

      const nodeCount = [...graph.getAllNodes()].length
      const result = { nodes: nodeCount, message: 'SBGN-ML imported successfully' }

      if (args.json) {
        console.log(JSON.stringify(result, null, 2))
      } else {
        console.log(ok(`Imported ${nodeCount} nodes from ${args.input}`))
      }
    } catch (err) {
      printError(err instanceof Error ? err.message : 'Import failed')
      process.exit(1)
    }
  }
})

const exportCmd = defineCommand({
  meta: { description: 'Export .fig to SBGN-ML' },
  args: {
    input: { type: 'positional', description: 'Document file path', required: true },
    output: { type: 'string', alias: 'o', description: 'Output SBGN-ML file path' },
    ...appTargetOptions,
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      const data = await loadRpcData<{ graph: unknown }>(args.input, 'export', {}, args)
      if ('error' in data) {
        printError('Failed to load document')
        process.exit(1)
      }

      console.log('Export to SBGN-ML requires a loaded SceneGraph — use the MCP server or app')
    } catch (err) {
      printError(err instanceof Error ? err.message : 'Export failed')
      process.exit(1)
    }
  }
})

const queryCmd = defineCommand({
  meta: { description: 'Query pathway databases (Reactome)' },
  args: {
    source: { type: 'string', description: 'Database source', default: 'reactome' },
    type: {
      type: 'string',
      description:
        'Query type: search_pathway, gene_to_pathway, pathway_details, pathway_reactions',
      required: true
    },
    query: { type: 'positional', description: 'Search term', required: true },
    species: { type: 'string', description: 'Species filter' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    try {
      let result: unknown
      switch (args.type) {
        case 'search_pathway':
          result = await searchPathways(args.query, args.species)
          break
        case 'gene_to_pathway':
          result = await findPathwaysByGene(args.query, args.species)
          break
        case 'pathway_details':
          result = await getPathwayDetails(args.query)
          break
        case 'pathway_reactions':
          result = await getPathwayParticipants(args.query)
          break
        default:
          printError(`Unknown query type: ${args.type}`)
          process.exit(1)
      }

      console.log(JSON.stringify(result, null, 2))
    } catch (err) {
      printError(err instanceof Error ? err.message : 'Query failed')
      process.exit(1)
    }
  }
})

const layoutCmd = defineCommand({
  meta: { description: 'Auto-layout pathway diagram' },
  args: {
    input: { type: 'positional', description: 'Document file path', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run() {
    try {
      console.log('Layout requires an active editor session — use the MCP server or app')
    } catch (err) {
      printError(err instanceof Error ? err.message : 'Layout failed')
      process.exit(1)
    }
  }
})

export default defineCommand({
  meta: {
    description: 'Pathway diagram operations: import, export, layout, query'
  },
  subCommands: {
    import: importCmd,
    export: exportCmd,
    query: queryCmd,
    layout: layoutCmd
  }
})
