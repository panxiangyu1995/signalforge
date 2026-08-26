# BioPath Implementation Checklist & Specification

> Authoritative execution document · July 2026
>
> Precedence: this document > `biopath-visual-fidelity.md` > `biopath-implementation.md` > `biopath-prd.md`
>
> All tasks are atomic, testable, and ordered by dependency. Each task specifies exact file paths, code patterns, and acceptance criteria.

---

## Conventions

### Code Standards
- No `any`, no `!`, no `Math.random()` — per AGENTS.md
- Use `@signal-forge/scene-graph` types: `Color`, `Vector`, `SceneNode`, `NodeType`
- Use `culori` for color, `crypto.getRandomValues()` for IDs
- No inline comments unless asked
- Follow existing file naming: lowercase/kebab-case for non-component files
- `pluginData` value is `string` — pathway data must be `JSON.stringify()`/`JSON.parse()`

### Testing Standards
- Unit tests: `tests/engine/pathway/*.test.ts`
- Visual tests: `tests/e2e/canvas/pathway-visuals.spec.ts`
- Every task with a `✓` acceptance criterion must have a corresponding test

### Review Gates
- After each phase: `bun run check` must pass (lint + typecheck)
- After each phase: `bun run test:unit` must pass for pathway tests
- Visual changes require Playwright canvas snapshot tests

---

## Phase 1: Glyph Foundation

### 1.1 SceneGraph — Pathway Data Types

**ID**: P1.1
**Depends on**: none
**Files**:
- CREATE `packages/scene-graph/src/pathway-data.ts`
- MODIFY `packages/scene-graph/src/types.ts`
- MODIFY `packages/scene-graph/src/node-defaults.ts`
- MODIFY `packages/scene-graph/src/index.ts`

**Task**: Define pathway data types and add 4 new `NodeType` values.

**Specification**:

`packages/scene-graph/src/types.ts` — add to `NodeType` union (after `'SHAPE_WITH_TEXT'`):
```
  | 'PATHWAY_GLYPH'
  | 'PATHWAY_PROCESS'
  | 'PATHWAY_ARC'
  | 'COMPARTMENT'
```

`packages/scene-graph/src/node-defaults.ts` — add `COMPARTMENT` to `CONTAINER_TYPES` set. Add type-specific defaults in `createDefaultNode()` before the `...overrides` spread:
```typescript
// After the existing fills ternary, add:
width: type === 'PATHWAY_PROCESS' ? 24
     : type === 'PATHWAY_ARC' ? 0
     : type === 'COMPARTMENT' ? 800
     : 100,
height: type === 'PATHWAY_PROCESS' ? 24
      : type === 'PATHWAY_ARC' ? 0
      : type === 'COMPARTMENT' ? 600
      : 100,
```
(Note: Use ternary chain matching the existing single-ternary pattern for `fills`.)

`packages/scene-graph/src/pathway-data.ts` — new file with:
```typescript
export const PATHWAY_PLUGIN_ID = 'signal-forge'
export const PATHWAY_PLUGIN_KEY = 'pathway'

// --- Enum types ---
export type PathwayGlyphType =
  | 'macromolecule' | 'simple_chemical' | 'complex'
  | 'nucleic_acid_feature' | 'unspecified_entity' | 'perturbation'
  | 'phenotype' | 'source_sink'

export type PathwayProcessType =
  | 'process' | 'transport' | 'association' | 'dissociation'
  | 'omitted_process' | 'uncertain_process'

export type PathwayArcType =
  | 'consumption' | 'production' | 'modulation' | 'stimulation'
  | 'catalysis' | 'inhibition' | 'necessary_stimulation' | 'trigger'
  | 'logic_and' | 'logic_or' | 'logic_not' | 'equivalence'

// --- Data shape stored as JSON string in pluginData ---
export interface PathwayNodeData {
  glyphType?: PathwayGlyphType
  processType?: PathwayProcessType
  arcType?: PathwayArcType
  stateVariables?: { variable: string; value?: string }[]
  unitOfInformation?: { text: string }[]
  compartmentRef?: string
  cloneMarker?: boolean
  sourceId?: string
  targetId?: string
  sourcePort?: { side: string; x: number; y: number }
  targetPort?: { side: string; x: number; y: number }
  bendPoints?: { x: number; y: number }[]
  portInfo?: { ports: { side: string; x: number; y: number }[] }
}

// --- Accessor functions ---
export function getPathwayData(node: SceneNode): PathwayNodeData | null {
  const entry = node.pluginData.find(
    e => e.pluginId === PATHWAY_PLUGIN_ID && e.key === PATHWAY_PLUGIN_KEY
  )
  if (!entry) return null
  try { return JSON.parse(entry.value) as PathwayNodeData }
  catch { return null }
}

export function setPathwayData(node: SceneNode, data: PathwayNodeData): void {
  const json = JSON.stringify(data)
  const idx = node.pluginData.findIndex(
    e => e.pluginId === PATHWAY_PLUGIN_ID && e.key === PATHWAY_PLUGIN_KEY
  )
  if (idx >= 0) {
    node.pluginData[idx] = { pluginId: PATHWAY_PLUGIN_ID, key: PATHWAY_PLUGIN_KEY, value: json }
  } else {
    node.pluginData.push({ pluginId: PATHWAY_PLUGIN_ID, key: PATHWAY_PLUGIN_KEY, value: json })
  }
}

export function updatePathwayData(node: SceneNode, partial: Partial<PathwayNodeData>): void {
  const existing = getPathwayData(node) ?? {}
  setPathwayData(node, { ...existing, ...partial })
}
```

`packages/scene-graph/src/index.ts` — add exports:
```typescript
export {
  PATHWAY_PLUGIN_ID, PATHWAY_PLUGIN_KEY,
  getPathwayData, setPathwayData, updatePathwayData,
  type PathwayGlyphType, type PathwayProcessType, type PathwayArcType,
  type PathwayNodeData,
} from './pathway-data'
```

**Acceptance criteria**:
- ✓ `NodeType` union compiles with 22 values (18 existing + 4 new)
- ✓ `CONTAINER_TYPES` includes `'COMPARTMENT'`
- ✓ `getPathwayData()` / `setPathwayData()` round-trip correctly
- ✓ `createDefaultNode('PATHWAY_GLYPH', ...)` produces valid SceneNode
- ✓ `bun run check` passes

---

### 1.2 SceneGraph — Copy Support for Pathway Data

**ID**: P1.2
**Depends on**: P1.1
**Files**:
- MODIFY `packages/scene-graph/src/copy.ts`

**Task**: Ensure `cloneNodeProps()` deep-copies pathway pluginData.

**Specification**: The existing `copySpread` does `{ ...item }` on each `PluginDataEntry`. Since `PluginDataEntry.value` is a `string` (JSON), shallow spread is sufficient — no change needed to `copy.ts` itself. However, verify this with a unit test.

**Acceptance criteria**:
- ✓ Unit test: clone a node with pathway pluginData → cloned node has identical pathway data
- ✓ Cloned pathway data is independent (mutating clone does not affect original)

---

### 1.3 Renderer — SBGN Style Constants

**ID**: P1.3
**Depends on**: P1.1
**Files**:
- CREATE `packages/core/src/pathway/constants.ts`

**Task**: Define all SBGN visual constants extracted from cytoscape-sbgn-stylesheet and sbgnviz.js.

**Specification**: Copy the `SBGN_STYLE` object from `biopath-visual-fidelity.md` Part 1.1, plus the `PUBLICATION_STYLE` object from Part 2.1. Include all exact hex colors, stroke widths, font sizes, default dimensions, shape parameters, multimer offsets, and arc decoration sizes.

**Acceptance criteria**:
- ✓ File compiles without errors
- ✓ All values match the reference specification (no invented values)

---

### 1.4 Renderer — Glyph Paint Routines

**ID**: P1.4
**Depends on**: P1.1, P1.3
**Files**:
- CREATE `packages/core/src/pathway/glyphs.ts`
- CREATE `packages/core/src/pathway/processes.ts`
- CREATE `packages/core/src/pathway/arcs.ts`
- CREATE `packages/core/src/pathway/ports.ts`

**Task**: Implement Skia paint routines for all SBGN glyph types, process types, and arc decorations.

**Specification for `glyphs.ts`**:

Each function signature: `(ck: CanvasKit, canvas: Canvas, node: SceneNode, data: PathwayNodeData, style: 'sbgn' | 'publication') => void`

Implement these 8 paint functions with exact paths from `biopath-visual-fidelity.md` Part 1.2:
- `paintMacromolecule` — rounded rect, `cornerRadius = min(w,h) * 0.12`
- `paintSimpleChemical` — stadium, `cornerRadius = min(w/2, h/2)`
- `paintComplex` — octagonal cut-corner, `cornerCut = 24`
- `paintNucleicAcidFeature` — bottom-round-rect, `bottomRadius = 0.3 * h`
- `paintPhenotype` — hexagon
- `paintPerturbation` — concave hexagon
- `paintSourceSink` — circle + diagonal cross
- `paintUnspecifiedEntity` — ellipse

Each function must:
1. Build a CanvasKit `Path` matching the exact shape specification
2. Fill with style-appropriate color (SBGN: `#f6f6f6`, Publication: semantic color from `PUBLICATION_STYLE.entityFills`)
3. Stroke with style-appropriate border (SBGN: `#555`, Publication: semantic border from `PUBLICATION_STYLE.entityBorders`)
4. Use pre-allocated Paint objects from `SkiaRenderer` (not create new Paint per call)

**Specification for `processes.ts`**:

6 paint functions:
- `paintProcess` — 24×24 filled square
- `paintTransport` — double-bordered square (outer stroke + `destination-out` inner stroke)
- `paintAssociation` — filled circle, `#6B6B6B`
- `paintDissociation` — two concentric circles, stroke `#6A6A6A`, 2px
- `paintOmittedProcess` — square with dotted border `[1, 1]`
- `paintUncertainProcess` — square with dashed border `[4, 2]`

**Specification for `arcs.ts`**:

`paintPathwayArc(ck, canvas, node, data, graph, style)` — renders arc line + decoration.

Decoration functions (each renders the appropriate symbol at the arc endpoint):
- `paintArrowhead` — filled triangle (production)
- `paintTBar` — perpendicular line (inhibition)
- `paintCircleOnLine` — hollow circle (catalysis)
- `paintOpenTriangle` — hollow triangle (stimulation)
- `paintFilledTriangle` — filled triangle (necessary stimulation)
- `paintDiamond` — hollow diamond (modulation)
- `paintTriggerDecoration` — filled triangle + perpendicular bar

**Specification for `ports.ts`**:

`computePortPositions(node, data): PortInfo` — returns 4-8 port positions on the glyph boundary.

`findNearestPort(node, data, targetPoint): PortPosition` — finds closest port to a target.

**Acceptance criteria**:
- ✓ Each glyph renders identically to Newt reference screenshots (visual diff <2%)
- ✓ Arc decorations are correctly sized and positioned
- ✓ Port positions are on the glyph boundary
- ✓ No Paint object leaks (all paints are from renderer pre-allocated pool)

---

### 1.5 Renderer — Scene Dispatch Integration

**ID**: P1.5
**Depends on**: P1.4
**Files**:
- CREATE `packages/core/src/pathway/render.ts`
- MODIFY `packages/core/src/canvas/scene.ts`

**Task**: Wire pathway paint routines into the render dispatch.

**Specification for `render.ts`**:

4 bridge functions:
- `renderPathwayGlyph(r, canvas, node, graph)` — reads `getPathwayData(node)`, calls appropriate glyph paint function, paints label, state variables, clone marker
- `renderPathwayProcess(r, canvas, node, graph)` — reads data, calls appropriate process paint function
- `renderPathwayArc(r, canvas, node, graph)` — resolves source/target nodes, calls `paintPathwayArc`
- `renderCompartment(r, canvas, node, graph)` — paints barrel shape, label, renders children

**Specification for `scene.ts` modification**:

In `renderNodeContent()`, add 4 new branches BEFORE the `else { r.renderShape(...) }` fallback:
```typescript
} else if (node.type === 'PATHWAY_GLYPH') {
  renderPathwayGlyph(r, canvas, node, graph)
} else if (node.type === 'PATHWAY_PROCESS') {
  renderPathwayProcess(r, canvas, node, graph)
} else if (node.type === 'PATHWAY_ARC') {
  renderPathwayArc(r, canvas, node, graph)
} else if (node.type === 'COMPARTMENT') {
  renderCompartment(r, canvas, node, graph)
} else {
```

**Acceptance criteria**:
- ✓ Placing a PATHWAY_GLYPH node on canvas renders the correct SBGN shape
- ✓ PATHWAY_ARC renders with correct decoration
- ✓ COMPARTMENT renders with children inside
- ✓ Existing node types (RECTANGLE, TEXT, etc.) still render correctly (regression)

---

### 1.6 FigmaAPI — Pathway Node Creation Methods

**ID**: P1.6
**Depends on**: P1.1
**Files**:
- MODIFY `packages/core/src/figma-api/index.ts`

**Task**: Add `createPathwayGlyph()`, `createPathwayProcess()`, `createPathwayArc()`, `createCompartment()` methods to FigmaAPI.

**Specification**: Follow the existing pattern (`createFrame()`, `createRectangle()`, etc.):

```typescript
createPathwayGlyph(glyphType: PathwayGlyphType, overrides?: Partial<SceneNode>): FigmaNodeProxy {
  const node = this.graph.createNode('PATHWAY_GLYPH', this._currentPageId, overrides)
  updatePathwayData(node, { glyphType })
  return this.wrapNode(node.id)
}

createPathwayProcess(processType: PathwayProcessType, overrides?: Partial<SceneNode>): FigmaNodeProxy {
  const node = this.graph.createNode('PATHWAY_PROCESS', this._currentPageId, overrides)
  updatePathwayData(node, { processType })
  return this.wrapNode(node.id)
}

createPathwayArc(arcType: PathwayArcType, sourceId: string, targetId: string, overrides?: Partial<SceneNode>): FigmaNodeProxy {
  const node = this.graph.createNode('PATHWAY_ARC', this._currentPageId, overrides)
  updatePathwayData(node, { arcType, sourceId, targetId })
  return this.wrapNode(node.id)
}

createCompartment(label: string, overrides?: Partial<SceneNode>): FigmaNodeProxy {
  const node = this.graph.createNode('COMPARTMENT', this._currentPageId, { name: label, ...overrides })
  return this.wrapNode(node.id)
}
```

**Acceptance criteria**:
- ✓ `figma.createPathwayGlyph('macromolecule', { name: 'JAK2', x: 100, y: 200 })` creates a node with correct type and pathway data
- ✓ `figma.createPathwayArc('inhibition', srcId, tgtId)` creates an arc with source/target references

---

### 1.7 Kiwi I/O — Round-trip Support

**ID**: P1.7
**Depends on**: P1.1
**Files**:
- MODIFY `packages/core/src/kiwi/fig/node-change/convert.ts`

**Task**: Add new node types to `NODE_TYPE_MAP` so `.fig` files with pathway nodes can be saved/reopened.

**Specification**: Add 4 entries to `NODE_TYPE_MAP`:
```typescript
PATHWAY_GLYPH: 'PATHWAY_GLYPH',
PATHWAY_PROCESS: 'PATHWAY_PROCESS',
PATHWAY_ARC: 'PATHWAY_ARC',
COMPARTMENT: 'COMPARTMENT',
```

**Acceptance criteria**:
- ✓ Save a document with pathway nodes → reopen → pathway data preserved
- ✓ `pluginData` (containing pathway JSON) survives round-trip

---

### 1.8 UI — Glyph Palette Component

**ID**: P1.8
**Depends on**: P1.5
**Files**:
- CREATE `src/components/pathway/GlyphPalette.vue`
- CREATE `src/components/pathway/GlyphButton.vue`
- CREATE `src/components/pathway/ArcButton.vue`

**Task**: Create a sidebar panel showing SBGN glyph types for manual placement.

**Specification**:
- `GlyphPalette.vue` — 3 sections: Entities, Processes, Arcs. Each section shows a grid of buttons.
- `GlyphButton.vue` — renders a small SVG preview of the glyph shape + label. On click, sets the active drawing tool.
- `ArcButton.vue` — renders a small SVG preview of the arc decoration + label. On click, sets the active arc tool.
- Use Tailwind CSS 4 for styling. Follow existing sidebar panel patterns in the codebase.
- SVG previews are static inline SVGs (not CanvasKit renders) for performance.

**Acceptance criteria**:
- ✓ Glyph palette renders in sidebar
- ✓ Clicking a glyph button activates the pathway drawing tool
- ✓ Palette is visible only when pathway mode is active

---

### 1.9 Editor — Pathway Drawing Tools

**ID**: P1.9
**Depends on**: P1.5, P1.8
**Files**:
- CREATE `packages/core/src/editor/shapes/pathway-glyph.ts`
- CREATE `packages/core/src/editor/shapes/pathway-arc.ts`

**Task**: Implement canvas interaction handlers for placing pathway glyphs and drawing arcs.

**Specification for `pathway-glyph.ts`**:
- On mousedown on canvas: create a `PATHWAY_GLYPH` node at click position with the active `glyphType`
- On drag: resize the glyph
- On mouseup: finalize, compute ports, select the node

**Specification for `pathway-arc.ts`**:
- On mousedown on a glyph/process: start arc from that node's nearest port
- On mousemove: show preview line to cursor
- On mouseup on another glyph/process: create arc, compute port positions
- On mouseup on empty space: cancel

**Acceptance criteria**:
- ✓ Click canvas with macromolecule tool → glyph appears at click position
- ✓ Drag from glyph A to glyph B → arc created with correct source/target
- ✓ Arc preview shown during drag

---

## Phase 2: AI Generation

### 2.1 Pathway AI Tools — Create

**ID**: P2.1
**Depends on**: P1.6
**Files**:
- CREATE `packages/core/src/tools/pathway/create.ts`

**Task**: Implement `create_pathway` tool.

**Specification**: Follow `defineTool()` pattern. Params are all `type: 'string'` (JSON arrays), matching existing tools like `batch_update`. The `execute` function:
1. Parse JSON params
2. Create compartments, then entities (with compartment parent lookup), then processes, then arcs
3. Build a `nameToId` map for arc source/target resolution
4. Return `{ created: { compartments, entities, processes, arcs }, summary }`

**Acceptance criteria**:
- ✓ `create_pathway` with valid JSON creates all nodes on canvas
- ✓ Entities are placed inside their specified compartments
- ✓ Arcs reference correct source/target nodes
- ✓ Undo works (Ctrl+Z restores previous state)

---

### 2.2 Pathway AI Tools — Modify

**ID**: P2.2
**Depends on**: P1.6
**Files**:
- CREATE `packages/core/src/tools/pathway/modify.ts`

**Task**: Implement `add_entity`, `add_process`, `add_arc`, `add_compartment`, `set_state_variable` tools.

**Specification**: Each tool follows `defineTool()` pattern with `mutates: true`. Use `enum` on string params for `glyphType`, `processType`, `arcType`.

**Acceptance criteria**:
- ✓ Each tool creates the correct node type with correct pathway data
- ✓ `set_state_variable` adds state variable badge data to an existing entity
- ✓ All tools return node ID and summary

---

### 2.3 Pathway AI Tools — Layout

**ID**: P2.3
**Depends on**: P1.1
**Files**:
- CREATE `packages/core/src/tools/pathway/layout.ts`
- CREATE `packages/core/src/pathway/layout/hierarchical.ts`
- CREATE `packages/core/src/pathway/layout/orthogonal.ts`

**Task**: Implement `auto_layout_pathway` tool with hierarchical layout and orthogonal edge routing.

**Specification for `hierarchical.ts`**:
1. Collect all pathway nodes on the page
2. Build adjacency graph from arcs (production = downstream, consumption = upstream)
3. Topological sort → assign layers
4. Position nodes by layer (vertical spacing = 80px, horizontal centering)
5. Expand compartments to contain children + 40px padding
6. Apply positions via `graph.updateNode()`

**Specification for `orthogonal.ts`**:
- For each arc: compute 2-3 bend points for right-angle routing
- Prefer vertical-horizontal-vertical path (for top-to-bottom flow)
- Store bend points in pathway data

**Acceptance criteria**:
- ✓ After `auto_layout_pathway`, nodes don't overlap
- ✓ Signal flows top-to-bottom (or left-to-right)
- ✓ Arcs have orthogonal bend points
- ✓ Compartments contain their children

---

### 2.4 Pathway AI Tools — Query

**ID**: P2.4
**Depends on**: none
**Files**:
- CREATE `packages/core/src/tools/pathway/query.ts`
- CREATE `packages/core/src/pathway/knowledge/reactome.ts`

**Task**: Implement `query_pathway_db` tool with Reactome API integration.

**Specification for `reactome.ts`**: REST API client for Reactome ContentService:
- `searchPathways(query, species)` → `GET /search/query`
- `getPathwayDetails(stableId)` → `GET /data/detail/{id}`
- `getPathwayParticipants(stableId)` → `GET /data/participants/{id}`
- `findPathwaysByGene(gene, species)` → `GET /data/mapping/UniProt/{gene}/pathways`

**Specification for `query.ts`**: `defineTool()` with `source` param (enum: `reactome`), `query_type` param (enum: `search_pathway`, `gene_to_pathway`, `pathway_details`, `pathway_reactions`), `query` param.

**Acceptance criteria**:
- ✓ `query_pathway_db(source='reactome', query_type='search_pathway', query='JAK STAT')` returns pathway list
- ✓ `query_pathway_db(source='reactome', query_type='gene_to_pathway', query='BRCA1')` returns pathways containing BRCA1
- ✓ Network errors return `{ error: string }` not thrown exceptions

---

### 2.5 Tool Registration

**ID**: P2.5
**Depends on**: P2.1, P2.2, P2.3, P2.4
**Files**:
- CREATE `packages/core/src/tools/pathway/index.ts`
- MODIFY `packages/core/src/tools/registry-core.ts`

**Task**: Export pathway tools and add to `CORE_TOOLS`.

**Specification for `index.ts`**:
```typescript
export const PATHWAY_TOOLS: ToolDef[] = [
  createPathway, addEntity, addProcess, addArc, addCompartment,
  setStateVariable, autoLayoutPathway, queryPathwayDb,
]
```

**Specification for `registry-core.ts`**: Add `...PATHWAY_TOOLS` at the end of the `CORE_TOOLS` array, after `viewportZoomToFit`.

**Acceptance criteria**:
- ✓ `CORE_TOOLS` includes all 8 pathway tools
- ✓ `ALL_TOOLS` (used by MCP) includes them automatically
- ✓ `bun run check` passes

---

### 2.6 AI System Prompt

**ID**: P2.6
**Depends on**: P2.5
**Files**:
- MODIFY `src/app/ai/chat/system-prompt.md`

**Task**: Add SBGN vocabulary, construction rules, and workflow to the system prompt.

**Specification**: Append a `## Pathway Diagram Mode` section (from `biopath-implementation.md` Section 2.3) containing:
1. SBGN glyph vocabulary (entity types, process types, arc types with descriptions)
2. Construction rules (arcs connect entity↔process, not entity↔entity)
3. Visual rendering rules (sizes, spacing, compartments first)
4. Workflow (query → create → layout)
5. Complete JAK-STAT example

**Acceptance criteria**:
- ✓ AI chat responds to "Draw the JAK-STAT signaling pathway" by calling `create_pathway`
- ✓ Generated diagram has correct SBGN structure (entities, processes, arcs)
- ✓ No arcs directly between two entities (all arcs go through process nodes)

---

## Phase 3: Interoperability

### 3.1 SBGN-ML Import

**ID**: P3.1
**Depends on**: P1.1
**Files**:
- CREATE `packages/core/src/io/formats/sbgn-ml/adapter.ts`
- CREATE `packages/core/src/io/formats/sbgn-ml/read.ts`
- MODIFY `packages/core/src/io/formats.ts`

**Task**: Implement SBGN-ML XML → SceneGraph parser and register as IOFormatAdapter.

**Specification for `read.ts`**:
1. Parse XML using `DOMParser` (browser) or `fast-xml-parser` (Node)
2. For each `<glyph>` element: map `class` attribute to NodeType + pathway data, create SceneNode
3. For each `<arc>` element: create PATHWAY_ARC with source/target from `source`/`target` attributes
4. Handle `<port>` elements for arc connection points
5. Handle `<state>` and `<label>` sub-elements

**Specification for `adapter.ts`**:
```typescript
export const sbgnmlFormat: IOFormatAdapter = {
  id: 'sbgn-ml',
  label: 'SBGN-ML',
  role: 'interchange-document',
  category: 'document',
  extensions: ['sbgn', 'sbgnml'],
  mimeTypes: ['application/xml'],
  support: { read: true, write: false, export: false },
  matchesFile: (name) => name.endsWith('.sbgn') || name.endsWith('.sbgnml'),
  readDocument: readSbgnMl,
}
```

**Specification for `formats.ts`**: Add `sbgnmlFormat` to `BUILTIN_IO_FORMATS` array.

**Acceptance criteria**:
- ✓ Import a valid SBGN-ML file → SceneGraph with correct node types and pathway data
- ✓ Imported diagram renders correctly on canvas
- ✓ Handles `<port>` references in arcs

---

### 3.2 SBGN-ML Export

**ID**: P3.2
**Depends on**: P3.1
**Files**:
- CREATE `packages/core/src/io/formats/sbgn-ml/write.ts`
- MODIFY `packages/core/src/io/formats/sbgn-ml/adapter.ts`

**Task**: Implement SceneGraph → SBGN-ML XML serializer.

**Specification for `write.ts`**:
1. Create XML document with `<sbgn>` root and `<map language="process description">`
2. For each COMPARTMENT: `<glyph class="compartment">` with bbox and label
3. For each PATHWAY_GLYPH: `<glyph class="macromolecule">` (etc.) with bbox, label, state, ports
4. For each PATHWAY_PROCESS: `<glyph class="process">` with bbox
5. For each PATHWAY_ARC: `<arc class="catalysis">` (etc.) with start/end points and bend points
6. Serialize to XML string

Update `adapter.ts` to set `support: { read: true, write: true, export: true }` and add `writeDocument` and `exportContent`.

**Acceptance criteria**:
- ✓ Export a pathway diagram → valid SBGN-ML XML
- ✓ Round-trip: import → export → import produces equivalent diagram
- ✓ Exported SBGN-ML validates against the SBGN-ML schema

---

### 3.3 CLI Pathway Commands

**ID**: P3.3
**Depends on**: P3.1, P3.2
**Files**:
- CREATE `packages/cli/src/commands/pathway.ts`
- MODIFY `packages/cli/src/index.ts`

**Task**: Add `pathway` CLI command with `import`, `export`, `layout`, `query` sub-commands.

**Specification**: Follow existing command pattern (`defineCommand` from `citty`, `loadRpcData` for dual-mode, `agentfmt` for output).

**Acceptance criteria**:
- ✓ `signalforge pathway import diagram.sbgn -o output.fig` converts SBGN-ML to .fig
- ✓ `signalforge pathway export diagram.fig -o output.sbgn` converts .fig to SBGN-ML
- ✓ `signalforge pathway query --source reactome --type search_pathway --query "JAK STAT"` returns results
- ✓ `--json` flag produces machine-readable output

---

## Phase 4: Enhanced UX

### 4.1 Data Overlay

**ID**: P4.1
**Depends on**: P1.1
**Files**:
- CREATE `packages/core/src/pathway/overlay.ts`
- CREATE `src/components/pathway/DataOverlayPanel.vue`

**Task**: Implement expression data overlay on pathway entities.

**Specification for `overlay.ts`**: `applyExpressionOverlay(graph, pageId, data: Map<string, number>, colorScale)` — for each PATHWAY_GLYPH, look up `node.name` in data map, compute fill color from fold-change value, update `node.fills`.

**Specification for `DataOverlayPanel.vue`**: UI to load CSV/TSV, map gene names to entities, select color scale (blue-white-red, green-brown), apply overlay.

**Acceptance criteria**:
- ✓ Load CSV with gene → fold-change → entity fill colors update
- ✓ Blue-white-red gradient: down-regulated = blue, neutral = white, up-regulated = red

---

### 4.2 Advanced Layout — ELK.js

**ID**: P4.2
**Depends on**: P2.3
**Files**:
- CREATE `packages/core/src/pathway/layout/elk.ts`
- MODIFY `package.json` (add `elkjs` dependency)

**Task**: Integrate ELK.js for advanced layered layout.

**Specification**: Build ELK graph from pathway nodes, configure with `'elk.algorithm': 'layered'`, `'elk.direction': 'DOWN'`, run layout, apply positions.

**Acceptance criteria**:
- ✓ ELK layout produces less crossings than simple hierarchical layout
- ✓ Compartment containment preserved
- ✓ `auto_layout_pathway` tool uses ELK when available

---

### 4.3 Pathway Validation/Linting

**ID**: P4.3
**Depends on**: P1.1
**Files**:
- CREATE `packages/core/src/pathway/lint.ts`

**Task**: Implement SBGN compliance lint rules.

**Specification**: Rules:
1. `arc-between-entities` — arcs must connect entity↔process, not entity↔entity
2. `missing-compartment` — entities should be inside a compartment
3. `orphan-process` — processes should have ≥1 consumption and ≥1 production arc
4. `invalid-arc-type` — arc type must be valid for source/target combination

**Acceptance criteria**:
- ✓ Invalid diagrams produce lint warnings
- ✓ Valid SBGN PD diagrams pass all rules

---

### 4.4 Publication Export

**ID**: P4.4
**Depends on**: P1.5
**Files**:
- MODIFY `packages/core/src/io/formats/svg/` (extend for pathway-aware SVG export)

**Task**: Ensure SVG/PDF/PNG export produces publication-quality output for pathway diagrams.

**Acceptance criteria**:
- ✓ SVG export preserves glyph shapes (not rasterized)
- ✓ PDF export at 300 DPI is print-ready
- ✓ PNG export at 2x scale is crisp

---

## Phase 5: Advanced Features

### 5.1 Sketch-to-SBGN

**ID**: P5.1
**Depends on**: P2.1
**Files**:
- CREATE `packages/core/src/tools/pathway/sketch.ts`

**Task**: Implement `sketch_to_pathway` tool using multimodal LLM.

**Specification**: Send uploaded image to vision model with SBGN extraction prompt → parse structured response → call `create_pathway`.

**Acceptance criteria**:
- ✓ Upload a hand-drawn sketch → generates a pathway diagram
- ✓ Generated diagram has correct entity types and relationships

---

### 5.2 Pathway Merging

**ID**: P5.2
**Depends on**: P1.1
**Files**:
- CREATE `packages/core/src/pathway/merge.ts`

**Task**: Implement pathway diagram merging with entity matching.

**Acceptance criteria**:
- ✓ Merge two diagrams sharing a protein → single node with arcs from both diagrams
- ✓ No duplicate entities after merge

---

### 5.3 SBGN AF Language

**ID**: P5.3
**Depends on**: P1.4
**Files**:
- CREATE `packages/core/src/pathway/af-glyphs.ts`

**Task**: Add Activity Flow language support (simpler: entities influence each other directly, no process nodes).

**Acceptance criteria**:
- ✓ AF diagrams render with AF-specific shapes
- ✓ Language switcher toggles between PD and AF

---

## Execution Order

```
Phase 1 (Glyph Foundation):
  P1.1 → P1.2 → P1.3 → P1.4 → P1.5 → P1.6 → P1.7 → P1.8 → P1.9

Phase 2 (AI Generation) — can start P2.1-P2.4 in parallel after P1.6:
  P2.1 ┐
  P2.2 ┤ → P2.5 → P2.6
  P2.3 ┤
  P2.4 ┘

Phase 3 (Interoperability):
  P3.1 → P3.2 → P3.3

Phase 4 (Enhanced UX) — can start in parallel:
  P4.1 ┐
  P4.2 ┤
  P4.3 ┤
  P4.4 ┘

Phase 5 (Advanced) — independent:
  P5.1, P5.2, P5.3
```

## Estimated Effort

| Phase | Tasks | Estimated Time |
|-------|-------|---------------|
| Phase 1 | P1.1–P1.9 | 4–6 weeks |
| Phase 2 | P2.1–P2.6 | 3–4 weeks |
| Phase 3 | P3.1–P3.3 | 2–3 weeks |
| Phase 4 | P4.1–P4.4 | 3–4 weeks |
| Phase 5 | P5.1–P5.3 | ongoing |

## Review Gates

After each phase completion:
1. `bun run check` — zero errors
2. `bun run test:unit` — all pathway tests pass
3. Visual regression tests pass (Phase 1+)
4. Manual review: AI chat generates correct pathway diagrams (Phase 2+)
5. SBGN-ML round-trip test passes (Phase 3+)
