# BioPath Implementation Plan — Detailed Technical Guide

> Companion to `biopath-prd.md` · July 2026
>
> This document maps each PRD phase to concrete code changes across the SignalForge monorepo, based on thorough analysis of the existing architecture.

## Architecture Summary (Current State)

Before detailing changes, here is what we're building on:

| Layer | Current Implementation | Key Files |
|-------|----------------------|-----------|
| **SceneGraph** | Flat `Map<string, SceneNode>`, single interface for all 18 node types, `parentId`/`childIds` tree | `packages/scene-graph/src/types.ts`, `node-defaults.ts`, `copy.ts` |
| **Renderer** | CanvasKit/Skia on WebGL2, `renderNodeContent()` dispatches by `node.type` to `renderShape()`/`renderSection()`/`renderComponentSet()`/`renderBooleanOperation()`, shared Paint objects, SkPicture caching | `packages/core/src/canvas/scene.ts`, `shapes.ts`, `fills.ts`, `strokes.ts` |
| **Tools** | `defineTool()` → `ToolDef` with `ParamDef` params, `execute(figma, args)`, `mutates` flag. Two registries: `CORE_TOOLS` (chat), `ALL_TOOLS` (MCP+CLI) | `packages/core/src/tools/schema.ts`, `registry-core.ts`, `registry-extended.ts` |
| **AI Chat** | Vercel AI SDK `ToolLoopAgent`, 50-step budget, system prompt from `system-prompt.md`, `toolsToAI()` adapter with undo/layout/flash hooks | `src/app/ai/chat/`, `packages/core/src/tools/ai-adapter.ts` |
| **MCP** | Thin RPC proxy → browser app, `registerTools()` converts `ToolDef[]` to Zod schemas, adds `automationTargetSchema`, MCP-only tools for file ops | `packages/mcp/src/tool/registration.ts`, `server.ts` |
| **Layout** | Yoga WASM for flex/grid, `computeAllLayouts()` bottom-up, `buildYogaTree()`/`applyYogaLayout()`, text measurement via CanvasKit | `packages/core/src/layout.ts`, `layout/yoga-helpers.ts` |
| **Connections** | `CONNECTOR` type exists in `NodeType` but **not implemented** — no rendering, no properties, no behavior. `LINE` renders as diagonal `(0,0)→(w,h)`. `VECTOR` has full `VectorNetwork` with bezier segments. | `packages/scene-graph/src/types.ts:94`, `packages/core/src/canvas/fills.ts:46` |
| **File I/O** | `IOFormatAdapter` interface, `IORegistry`, `BUILTIN_IO_FORMATS` array. Add adapter → register in array → CLI auto-discovers. | `packages/core/src/io/types.ts`, `formats.ts` |
| **CLI** | `citty` commands, dual-mode (headless file / app RPC), `agentfmt` output, `--json` support | `packages/cli/src/commands/` |

---

## Phase 1 — Glyph Foundation

**Goal**: SBGN PD glyphs render correctly on canvas, can be placed manually, and appear in the glyph palette UI.

### 1.1 SceneGraph: Add Pathway Node Types

**Strategy**: Extend the existing flat `SceneNode` pattern rather than creating discriminated unions. Add new `NodeType` values and use `pluginData` for pathway-specific fields (avoids bloating the core interface).

**Why `pluginData` over new fields**: The current `SceneNode` is already ~80 fields. Adding 10+ pathway-specific fields (glyphType, arcType, stateVariables, etc.) would further bloat every node. Instead, store pathway data in the existing `pluginData: PluginDataEntry[]` field with `pluginId: 'signal-forge'` and a key like `'pathway'`. The renderer and tools read/write this data through helper functions.

**Files to modify**:

#### `packages/scene-graph/src/types.ts`

Add new `NodeType` values to the union:

```typescript
export type NodeType =
  | 'CANVAS'
  | 'FRAME'
  | 'RECTANGLE'
  | 'ROUNDED_RECTANGLE'
  | 'ELLIPSE'
  | 'TEXT'
  | 'LINE'
  | 'STAR'
  | 'POLYGON'
  | 'VECTOR'
  | 'BOOLEAN_OPERATION'
  | 'GROUP'
  | 'SECTION'
  | 'COMPONENT'
  | 'COMPONENT_SET'
  | 'INSTANCE'
  | 'CONNECTOR'          // already exists
  | 'SHAPE_WITH_TEXT'    // already exists
  | 'PATHWAY_GLYPH'      // NEW: SBGN entity (macromolecule, chemical, etc.)
  | 'PATHWAY_PROCESS'    // NEW: SBGN process node (reaction, transport, etc.)
  | 'PATHWAY_ARC'        // NEW: SBGN arc (inhibition, catalysis, inhibition, etc.)
  | 'COMPARTMENT'        // NEW: SBGN compartment container
```

**Rationale for 4 types (not 20+)**: Rather than one `NodeType` per SBGN glyph class (which would add 20+ values), we use 4 structural types and store the specific SBGN class in `pluginData`. This keeps the `NodeType` union manageable and the renderer dispatch simple (4 new render paths, not 20).

#### `packages/scene-graph/src/node-defaults.ts`

Add defaults for the new types in `createDefaultNode()`:

```typescript
// PATHWAY_GLYPH: similar to ROUNDED_RECTANGLE but with specific defaults
case 'PATHWAY_GLYPH':
  return { ...baseDefaults, width: 120, height: 60, cornerRadius: 15, fills: [{ type: 'SOLID', color: WHITE, opacity: 1, visible: true }] }

// PATHWAY_PROCESS: small square
case 'PATHWAY_PROCESS':
  return { ...baseDefaults, width: 24, height: 24, cornerRadius: 0, fills: [{ type: 'SOLID', color: WHITE, opacity: 1, visible: true }] }

// PATHWAY_ARC: thin line-like node
case 'PATHWAY_ARC':
  return { ...baseDefaults, width: 100, height: 0, fills: [], strokes: [{ type: 'SOLID', color: BLACK, opacity: 1, visible: true, weight: 1.5 }] }

// COMPARTMENT: large container, similar to FRAME
case 'COMPARTMENT':
  return { ...baseDefaults, width: 800, height: 600, cornerRadius: 20, fills: [], strokes: [{ type: 'SOLID', color: BLACK, opacity: 1, visible: true, weight: 1.5 }] }
```

Add `COMPARTMENT` to `CONTAINER_TYPES`:

```typescript
export const CONTAINER_TYPES = new Set<NodeType>([
  'CANVAS', 'FRAME', 'GROUP', 'BOOLEAN_OPERATION',
  'SECTION', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE',
  'COMPARTMENT'  // NEW
])
```

#### `packages/scene-graph/src/pathway-data.ts` (NEW)

Helper functions for reading/writing pathway-specific data from `pluginData`:

```typescript
export const PATHWAY_PLUGIN_ID = 'signal-forge'
export const PATHWAY_PLUGIN_KEY = 'pathway'

export type PathwayGlyphType =
  | 'macromolecule'
  | 'simple_chemical'
  | 'complex'
  | 'nucleic_acid_feature'
  | 'unspecified_entity'
  | 'perturbation'
  | 'phenotype'
  | 'source_sink'
  | 'tag'           // SBGN tag glyph
  | 'terminal'      // SBGN terminal glyph

export type PathwayProcessType =
  | 'process'                // generic process (SBGN square)
  | 'biochemical_reaction'   // same visual as process
  | 'transport'              // double-bordered square
  | 'association'            // circle
  | 'dissociation'           // half-circle
  | 'omitted_process'        // dotted square
  | 'uncertain_process'      // dashed square
  | 'phenotype'              // hexagon (as process)

export type PathwayArcType =
  | 'consumption'
  | 'production'
  | 'modulation'
  | 'stimulation'
  | 'catalysis'
  | 'inhibition'
  | 'necessary_stimulation'
  | 'trigger'
  | 'logic_and'
  | 'logic_or'
  | 'logic_not'
  | 'equivalence'

export interface StateVariable {
  variable: string   // e.g. 'p'
  value?: string     // e.g. 'Y705'
}

export interface UnitOfInformation {
  text: string       // e.g. 'ATP', 'Ca2+'
}

export interface PathwayNodeData {
  glyphType?: PathwayGlyphType
  processType?: PathwayProcessType
  arcType?: PathwayArcType
  stateVariables?: StateVariable[]
  unitOfInformation?: UnitOfInformation[]
  compartmentRef?: string       // ID of parent compartment
  cloneMarker?: boolean
  sourcePort?: PortPosition     // for arcs
  targetPort?: PortPosition     // for arcs
  sourceId?: string             // for arcs: source glyph/process ID
  targetId?: string             // for arcs: target glyph/process ID
  bendPoints?: Vector[]         // for arcs: intermediate waypoints
  portInfo?: PortInfo           // for glyphs: connection port positions
}

export interface PortInfo {
  ports: PortPosition[]         // 8 ports: N, NE, E, SE, S, SW, W, NW
}

export interface PortPosition {
  side: 'top' | 'right' | 'bottom' | 'left'
  index: number                 // which port on that side (0, 1, 2, ...)
  x: number                     // absolute position
  y: number
}

export function getPathwayData(node: SceneNode): PathwayNodeData | null {
  const entry = node.pluginData.find(e => e.key === PATHWAY_PLUGIN_KEY)
  if (!entry) return null
  return entry.value as PathwayNodeData
}

export function setPathwayData(node: SceneNode, data: PathwayNodeData): void {
  const idx = node.pluginData.findIndex(e => e.key === PATHWAY_PLUGIN_KEY)
  if (idx >= 0) {
    node.pluginData[idx] = { key: PATHWAY_PLUGIN_KEY, value: data }
  } else {
    node.pluginData.push({ key: PATHWAY_PLUGIN_KEY, value: data })
  }
}

export function updatePathwayData(node: SceneNode, partial: Partial<PathwayNodeData>): void {
  const existing = getPathwayData(node) ?? {}
  setPathwayData(node, { ...existing, ...partial })
}
```

#### `packages/scene-graph/src/copy.ts`

Add pathway data copy logic to `cloneNodeProps()`:

```typescript
// In cloneNodeProps(), after existing pluginData handling:
pluginData: src.pluginData.map(entry => {
  if (entry.key === PATHWAY_PLUGIN_KEY) {
    return { key: entry.key, value: structuredClone(entry.value) }
  }
  return { ...entry }
}),
```

#### `packages/scene-graph/src/index.ts`

Export the new pathway helpers:

```typescript
export {
  PATHWAY_PLUGIN_KEY,
  getPathwayData,
  setPathwayData,
  updatePathwayData,
  type PathwayGlyphType,
  type PathwayProcessType,
  type PathwayArcType,
  type PathwayNodeData,
  type StateVariable,
  type UnitOfInformation,
  type PortInfo,
  type PortPosition,
} from './pathway-data'
```

### 1.2 Renderer: Add Pathway Glyph Paint Routines

**Strategy**: Add a new dispatch branch in `renderNodeContent()` for the 4 pathway node types. Each branch calls dedicated paint functions in a new `pathway/` subdirectory.

**Files to create/modify**:

#### `packages/core/src/canvas/pathway/` (NEW package) vs `packages/core/src/pathway/` (in core)

**Decision: Start in `packages/core/src/pathway/`**. Pathway rendering is tightly coupled to the CanvasKit renderer and SceneGraph, which are both in core. A separate package would create circular dependency issues. If extraction becomes valuable later, we can move to a dedicated package following the pattern used for `@signal-forge/pen`.

#### `packages/core/src/pathway/glyphs.ts` (NEW)

Skia paint routines for each SBGN glyph type. Each function takes `(ck: CanvasKit, canvas: Canvas, node: SceneNode, data: PathwayNodeData)` and draws the glyph:

```typescript
export function paintMacromolecule(ck: CanvasKit, canvas: Canvas, node: SceneNode, data: PathwayNodeData): void {
  // SBGN PD spec: rounded rectangle, corner radius = 1/4 height
  // Fill: white, Stroke: black 1px
  const rect = ck.Rect(0, 0, node.width, node.height)
  const rrect = ck.RRectMake(rect, node.height / 4, node.height / 4, node.height / 4, node.height / 4)
  canvas.drawRRect(rrect, fillPaint)   // white fill
  canvas.drawRRect(rrect, strokePaint) // black stroke
  // Clone marker: filled band at top (if data.cloneMarker)
  // State variable badges: small rounded rects at top-right
  // Label: centered text
}

export function paintSimpleChemical(ck: CanvasKit, canvas: Canvas, node: SceneNode, data: PathwayNodeData): void {
  // SBGN PD spec: circle
  const cx = node.width / 2, cy = node.height / 2
  const r = Math.min(node.width, node.height) / 2
  canvas.drawCircle(cx, cy, r, fillPaint)
  canvas.drawCircle(cx, cy, r, strokePaint)
  // Clone marker, state variables, label
}

export function paintComplex(ck: CanvasKit, canvas: Canvas, node: SceneNode, data: PathwayNodeData): void {
  // SBGN PD spec: nested rounded rectangle (double border)
  // Outer: rounded rect with 1px stroke
  // Inner: rounded rect inset 4px with 1px stroke
  // Clone marker: band at top of outer rect
}

export function paintNucleicAcidFeature(ck: CanvasKit, canvas: Canvas, node: SceneNode, data: PathwayNodeData): void {
  // SBGN PD spec: rectangle with folded corner (top-right)
  // Draw rect, then cut a triangle from top-right corner
}

export function paintPhenotype(ck: CanvasKit, canvas: Canvas, node: SceneNode, data: PathwayNodeData): void {
  // SBGN PD spec: hexagon
}

export function paintPerturbation(ck: CanvasKit, canvas: Canvas, node: SceneNode, data: PathwayNodeData): void {
  // SBGN PD spec: parallelogram
}

export function paintSourceSink(ck: CanvasKit, canvas: Canvas, node: SceneNode, data: PathwayNodeData): void {
  // SBGN PD spec: circle with cross (empty set symbol)
}

export function paintUnspecifiedEntity(ck: CanvasKit, canvas: Canvas, node: SceneNode, data: PathwayNodeData): void {
  // SBGN PD spec: ellipse with dashed border
}
```

#### `packages/core/src/pathway/processes.ts` (NEW)

Paint routines for process nodes:

```typescript
export function paintProcess(ck: CanvasKit, canvas: Canvas, node: SceneNode, data: PathwayNodeData): void {
  // SBGN PD spec: small filled square (12x12 or 24x24)
  // For 'process' and 'biochemical_reaction': solid square
  // For 'transport': double-bordered square
  // For 'association': filled circle
  // For 'dissociation': filled half-circle (lower semicircle)
  // For 'omitted_process': dotted border square
  // For 'uncertain_process': dashed border square
}

export function paintPhenotypeProcess(ck: CanvasKit, canvas: Canvas, node: SceneNode, data: PathwayNodeData): void {
  // Hexagon (same shape as phenotype EPN but used as process)
}
```

#### `packages/core/src/pathway/arcs.ts` (NEW)

Paint routines for arc types. This is the most complex rendering — arcs have:

1. A line/orthogonal path from source to target
2. A head decoration (arrow, T-bar, circle, triangle, diamond)
3. Optional bend points for routing

```typescript
export function paintPathwayArc(ck: CanvasKit, canvas: Canvas, node: SceneNode, data: PathwayNodeData, graph: SceneGraph): void {
  // 1. Resolve source/target positions from sourceId/targetId
  const sourceNode = graph.getNode(data.sourceId!)
  const targetNode = graph.getNode(data.targetId!)
  if (!sourceNode || !targetNode) return

  // 2. Compute start/end points from port positions
  const start = resolvePortPosition(sourceNode, data.sourcePort)
  const end = resolvePortPosition(targetNode, data.targetPort)

  // 3. Build path: straight line or orthogonal route through bendPoints
  const path = buildArcPath(ck, start, end, data.bendPoints ?? [])

  // 4. Draw the line
  canvas.drawPath(path, strokePaint)

  // 5. Draw head decoration at the end point
  paintArcDecoration(ck, canvas, end, data.arcType!, strokePaint)
}

function paintArcDecoration(ck: CanvasKit, canvas: Canvas, point: Vector, arcType: PathwayArcType, paint: Paint): void {
  switch (arcType) {
    case 'consumption':
    case 'production':
      // Standard arrowhead
      paintArrowhead(ck, canvas, point, paint)
      break
    case 'inhibition':
      // T-bar: short perpendicular line at the endpoint
      paintTBar(ck, canvas, point, paint)
      break
    case 'catalysis':
      // Open circle on the line, near the target
      paintCircleOnLine(ck, canvas, point, paint)
      break
    case 'stimulation':
      // Open triangle on the line
      paintTriangleOnLine(ck, canvas, point, paint)
      break
    case 'necessary_stimulation':
      // Filled triangle on the line
      paintFilledTriangleOnLine(ck, canvas, point, paint)
      break
    case 'modulation':
      // Open diamond on the line
      paintDiamondOnLine(ck, canvas, point, paint)
      break
    case 'trigger':
      // Filled triangle with additional line
      break
    case 'logic_and':
      // Small filled circle (AND gate)
      break
    case 'logic_or':
      // Small filled circle (OR gate, different position)
      break
    case 'logic_not':
      // T-bar with circle
      break
    case 'equivalence':
      // Double arrowhead
      break
  }
}
```

#### `packages/core/src/pathway/ports.ts` (NEW)

Port position computation for glyphs:

```typescript
export function computePortPositions(node: SceneNode, data: PathwayNodeData): PortInfo {
  // For macromolecule (rounded rect): 8 ports on boundary
  // For simple_chemical (circle): 8 ports on circumference
  // For process (square): 4 ports (N, E, S, W)
  // For compartment: 8 ports on inner boundary
  // Port positions are in absolute coordinates
  const { width, height } = node
  const ports: PortPosition[] = [
    { side: 'top',    index: 0, x: width / 2, y: 0 },
    { side: 'right',  index: 0, x: width,     y: height / 2 },
    { side: 'bottom', index: 0, x: width / 2, y: height },
    { side: 'left',   index: 0, x: 0,         y: height / 2 },
    // Additional ports at corners or midpoints for multi-connection glyphs
  ]
  return { ports }
}

export function findNearestPort(node: SceneNode, data: PathwayNodeData, targetPoint: Vector): PortPosition {
  // Find the port on this glyph closest to the target point
  const portInfo = data.portInfo ?? computePortPositions(node, data)
  let nearest = portInfo.ports[0]
  let minDist = Infinity
  for (const port of portInfo.ports) {
    const dx = port.x - targetPoint.x
    const dy = port.y - targetPoint.y
    const dist = dx * dx + dy * dy
    if (dist < minDist) { minDist = dist; nearest = port }
  }
  return nearest
}
```

#### `packages/core/src/canvas/scene.ts` — Modify `renderNodeContent()`

Add dispatch for pathway node types:

```typescript
function renderNodeContent(r, canvas, graph, node, nodeId, overlays) {
  if (node.type === 'SECTION') {
    r.renderSection(canvas, node, graph)
  } else if (node.type === 'COMPONENT_SET') {
    r.renderComponentSet(canvas, node, graph)
  } else if (node.type === 'BOOLEAN_OPERATION') {
    renderBooleanOperation(r, canvas, node, graph)
  } else if (node.type === 'PATHWAY_GLYPH') {
    renderPathwayGlyph(r, canvas, node, graph)    // NEW
  } else if (node.type === 'PATHWAY_PROCESS') {
    renderPathwayProcess(r, canvas, node, graph)   // NEW
  } else if (node.type === 'PATHWAY_ARC') {
    renderPathwayArc(r, canvas, node, graph)       // NEW
  } else if (node.type === 'COMPARTMENT') {
    renderCompartment(r, canvas, node, graph)      // NEW
  } else {
    r.renderShape(canvas, node, graph)
  }
  // ... text edit overlay, drop target highlight
}
```

#### `packages/core/src/canvas/pathway-render.ts` (NEW)

Bridge between the renderer and pathway paint routines:

```typescript
import { getPathwayData } from '@signal-forge/scene-graph'
import { paintGlyphByType } from '../pathway/glyphs'
import { paintProcessByType } from '../pathway/processes'
import { paintPathwayArc } from '../pathway/arcs'

export function renderPathwayGlyph(r: SkiaRenderer, canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
  const data = getPathwayData(node)
  if (!data?.glyphType) return
  // Save canvas state, translate to node position
  canvas.save()
  canvas.translate(node.x, node.y)
  // Paint the glyph
  paintGlyphByType(r.ck, canvas, node, data)
  // Paint label (centered text)
  paintGlyphLabel(r, canvas, node)
  // Paint state variable badges
  paintStateVariables(r, canvas, node, data)
  // Paint clone marker
  if (data.cloneMarker) paintCloneMarker(r.ck, canvas, node)
  canvas.restore()
}

export function renderPathwayProcess(r: SkiaRenderer, canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
  const data = getPathwayData(node)
  if (!data?.processType) return
  canvas.save()
  canvas.translate(node.x, node.y)
  paintProcessByType(r.ck, canvas, node, data)
  canvas.restore()
}

export function renderPathwayArc(r: SkiaRenderer, canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
  const data = getPathwayData(node)
  if (!data?.arcType || !data.sourceId || !data.targetId) return
  // Arcs are drawn in absolute coordinates (not relative to node position)
  paintPathwayArc(r.ck, canvas, node, data, graph)
}

export function renderCompartment(r: SkiaRenderer, canvas: Canvas, node: SceneNode, graph: SceneGraph): void {
  // Compartment: large rounded rectangle with label at top-left
  // Background: very light fill (e.g., rgba(0,0,0,0.03))
  // Border: solid or dashed depending on style
  canvas.save()
  canvas.translate(node.x, node.y)
  // Draw background
  const rect = r.ck.Rect(0, 0, node.width, node.height)
  const rrect = r.ck.RRectMake(rect, node.cornerRadius, ...)
  canvas.drawRRect(rrect, compartmentFillPaint)
  canvas.drawRRect(rrect, compartmentStrokePaint)
  // Draw label
  paintCompartmentLabel(r, canvas, node)
  // Render children (compartment is a container)
  renderChildren(r, canvas, graph, node)
  canvas.restore()
}
```

### 1.3 FigmaAPI: Add Pathway Node Creation Methods

**File**: `packages/core/src/figma-api/index.ts`

Add creation methods following the existing pattern (`createFrame()`, `createRectangle()`, etc.):

```typescript
createPathwayGlyph(glyphType: PathwayGlyphType, overrides?: Partial<SceneNode>): FigmaNodeProxy {
  const node = this.graph.createNode('PATHWAY_GLYPH', this.currentPageId, overrides)
  updatePathwayData(node, { glyphType, portInfo: computePortPositions(node, {}) })
  return this.wrapNode(node.id)
}

createPathwayProcess(processType: PathwayProcessType, overrides?: Partial<SceneNode>): FigmaNodeProxy {
  const node = this.graph.createNode('PATHWAY_PROCESS', this.currentPageId, overrides)
  updatePathwayData(node, { processType })
  return this.wrapNode(node.id)
}

createPathwayArc(arcType: PathwayArcType, sourceId: string, targetId: string, overrides?: Partial<SceneNode>): FigmaNodeProxy {
  const sourceNode = this.graph.getNode(sourceId)
  const targetNode = this.graph.getNode(targetId)
  if (!sourceNode || !targetNode) throw new NodeNotFoundError(...)
  // Compute initial position and size from source/target
  const sourceData = getPathwayData(sourceNode)
  const targetData = getPathwayData(targetNode)
  const sourcePort = findNearestPort(sourceNode, sourceData, getAbsolutePosition(targetNode, this.graph))
  const targetPort = findNearestPort(targetNode, targetData, getAbsolutePosition(sourceNode, this.graph))
  const node = this.graph.createNode('PATHWAY_ARC', this.currentPageId, overrides)
  updatePathwayData(node, { arcType, sourceId, targetId, sourcePort, targetPort })
  return this.wrapNode(node.id)
}

createCompartment(label: string, overrides?: Partial<SceneNode>): FigmaNodeProxy {
  const node = this.graph.createNode('COMPARTMENT', this.currentPageId, { name: label, ...overrides })
  return this.wrapNode(node.id)
}
```

### 1.4 UI: Glyph Palette UI: Glyph Palette Component

**File**: `src/components/pathway/GlyphPalette.vue` (NEW)

A sidebar panel showing all available SBGN glyph types. Clicking a glyph sets it as the active drawing tool.

```vue
<template>
  <div class="pathway-palette">
    <div class="palette-section">
      <h3>Entities</h3>
      <div class="palette-grid">
        <GlyphButton v-for="glyph in entityGlyphs" :key="glyph.type"
          :glyph-type="glyph.type" :label="glyph.label"
          :active="activeGlyphType === glyph.type"
          @select="selectGlyph(glyph.type)" />
      </div>
    </div>
    <div class="palette-section">
      <h3>Processes</h3>
      <div class="palette-grid">
        <GlyphButton v-for="proc in processGlyphs" :key="proc.type"
          :glyph-type="proc.type" :label="proc.label"
          :active="activeProcessType === proc.type"
          @select="selectProcess(proc.type)" />
      </div>
    </div>
    <div class="palette-section">
      <h3>Arcs</h3>
      <div class="palette-grid">
        <ArcButton v-for="arc in arcTypes" :key="arc.type"
          :arc-type="arc.type" :label="arc.label"
          :active="activeArcType === arc.type"
          @select="selectArc(arc.type)" />
      </div>
    </div>
  </div>
</template>
```

Each `GlyphButton` renders a small SVG preview of the SBGN glyph shape (not a CanvasKit render — use static SVG icons for the palette).

### 1.5 Editor: Pathway Drawing Tools

**File**: `packages/core/src/editor/shapes/pathway.ts` (NEW)

Drawing tool handlers for placing pathway glyphs on canvas:

```typescript
export function createPathwayGlyphTool(ctx: EditorContext, glyphType: PathwayGlyphType): void {
  // On mousedown on canvas: create a PATHWAY_GLYPH node at click position
  // On drag: resize the glyph
  // On mouseup: finalize, compute ports, select the node
}

export function createPathwayArcTool(ctx: EditorContext, arcType: PathwayArcType): void {
  // On mousedown on a glyph/process: start arc from that node's nearest port
  // On mousemove: show preview line to cursor
  // On mouseup on another glyph/process: create arc, compute port positions
  // On mouseup on empty space: cancel
}
```

### 1.6 Kiwi I/O: Round-trip Support

**Files**: `packages/core/src/kiwi/fig/node-change/convert.ts`, `serialize.ts`

Add the new node types to the Kiwi protocol mapping so `.fig` files containing pathway nodes can be saved and reopened:

```typescript
// In the node type → Kiwi enum mapping:
'PATHWAY_GLYPH': 20,
'PATHWAY_PROCESS': 21,
'PATHWAY_ARC': 22,
'COMPARTMENT': 23,
```

The `pluginData` field is already serialized in the Kiwi format, so pathway data stored there will be preserved automatically.

### 1.7 Phase 1 File Summary

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `packages/scene-graph/src/types.ts` | Add 4 new `NodeType` values |
| MODIFY | `packages/scene-graph/src/node-defaults.ts` | Add defaults for new types, add COMPARTMENT to CONTAINER_TYPES |
| CREATE | `packages/scene-graph/src/pathway-data.ts` | Pathway data types, pluginData helpers, port types |
| MODIFY | `packages/scene-graph/src/copy.ts` | Deep-copy pathway pluginData |
| MODIFY | `packages/scene-graph/src/index.ts` | Export pathway types and helpers |
| CREATE | `packages/core/src/pathway/glyphs.ts` | Skia paint routines for 10 SBGN glyph types |
| CREATE | `packages/core/src/pathway/processes.ts` | Skia paint routines for 8 SBGN process types |
| CREATE | `packages/core/src/pathway/arcs.ts` | Skia paint routines for 12 SBGN arc types + decorations |
| CREATE | `packages/core/src/pathway/ports.ts` | Port position computation |
| CREATE | `packages/core/src/canvas/pathway-render.ts` | Renderer bridge functions |
| MODIFY | `packages/core/src/canvas/scene.ts` | Add pathway dispatch in `renderNodeContent()` |
| MODIFY | `packages/core/src/figma-api/index.ts` | Add `createPathwayGlyph()`, `createPathwayProcess()`, `createPathwayArc()`, `createCompartment()` |
| CREATE | `packages/core/src/editor/shapes/pathway.ts` | Drawing tool handlers |
| CREATE | `src/components/pathway/GlyphPalette.vue` | Glyph palette UI |
| MODIFY | `packages/core/src/kiwi/fig/node-change/convert.ts` | Add Kiwi enum mappings for new types |

---

## Phase 2 — AI Generation

**Goal**: Users can describe a pathway in natural language and the AI generates a complete SBGN-compliant diagram. MCP agents can do the same programmatically.

### 2.1 Pathway AI Tools

**Strategy**: Define pathway tools using the existing `defineTool()` pattern. Add them to both `CORE_TOOLS` (for chat) and `EXTENDED_TOOLS` (for MCP/CLI).

**Files to create**:

#### `packages/core/src/tools/pathway/create.ts` (NEW)

```typescript
export const createPathway = defineTool({
  name: 'create_pathway',
  description: 'Create a signaling pathway diagram. Creates compartments, entities, processes, and arcs in one call.',
  mutates: true,
  params: {
    compartments: {
      type: 'string',
      description: 'JSON array of compartment objects: [{"name":"cytoplasm","x":10,"y":10,"width":800,"height":600}]',
      required: true
    },
    entities: {
      type: 'string',
      description: 'JSON array of entity objects: [{"name":"JAK2","type":"macromolecule","compartment":"cytoplasm","x":100,"y":200}]',
      required: true
    },
    processes: {
      type: 'string',
      description: 'JSON array of process objects: [{"type":"process","label":"phosphorylation","x":300,"y":220}]',
      required: true
    },
    arcs: {
      type: 'string',
      description: 'JSON array of arc objects: [{"type":"catalysis","source":"JAK2","target":"phosphorylation"}]',
      required: true
    }
  },
  execute: (figma, args) => {
    const compartments = JSON.parse(String(args.compartments))
    const entities = JSON.parse(String(args.entities))
    const processes = JSON.parse(String(args.processes))
    const arcs = JSON.parse(String(args.arcs))

    const created = { compartments: [], entities: [], processes: [], arcs: [] }

    // 1. Create compartments
    for (const comp of compartments) {
      const node = figma.createCompartment(comp.name, {
        name: comp.name, x: comp.x, y: comp.y,
        width: comp.width, height: comp.height: comp.height
      })
      created.compartments.push({ id: node.id, name: comp.name })
    }

    // 2. Create entities (look up compartment by name for parentId)
    const nameToId = new Map<string, string>()
    for (const comp of created.compartments) nameToId.set(comp.name, comp.id)

    for (const ent of entities) {
      const parentId = ent.compartment ? nameToId.get(ent.compartment) : figma.currentPageId
      const node = figma.createPathwayGlyph(ent.type as PathwayGlyphType, {
        name: ent.name, x: ent.x, y: ent.y, parentId
      })
      nameToId.set(ent.name, node.id)
      created.entities.push({ id: node.id, name: ent.name, type: ent.type })
    }

    // 3. Create processes
    for (const proc of processes) {
      const node = figma.createPathwayProcess(proc.type as PathwayProcessType, {
        name: proc.label || proc.type, x: proc.x, y: proc.y
      })
      nameToId.set(proc.label || proc.type, node.id)
      created.processes.push({ id: node.id, label: proc.label, type: proc.type })
    }

    // 4. Create arcs (look up source/target by name)
    for (const arc of arcs) {
      const sourceId = nameToId.get(arc.source)
      const targetId = nameToId.get(arc.target)
      if (!sourceId || !targetId) continue
      const node = figma.createPathwayArc(arc.type as PathwayArcType, sourceId, targetId)
      created.arcs.push({ id: node.id, type: arc.type, source: arc.source, target: arc.target })
    }

    return { created, summary: `Created ${created.compartments.length} compartments, ${created.entities.length} entities, ${created.processes.length} processes, ${created.arcs.length} arcs` }
  }
})
```

#### `packages/core/src/tools/pathway/modify.ts` (NEW)

Individual modification tools:

```typescript
export const addEntity = defineTool({
  name: 'add_entity',
  description: 'Add a single SBGN entity to the current pathway diagram',
  mutates: true,
  params: {
    name: { type: 'string', description: 'Entity name (e.g. "JAK2", "ATP")', required: true },
    type: { type: 'string', description: 'SBGN glyph type', required: true,
      enum: ['macromolecule', 'simple_chemical', 'complex', 'nucleic_acid_feature', 'unspecified_entity', 'perturbation', 'phenotype', 'source_sink'] },
    compartment_id: { type: 'string', description: 'Parent compartment node ID' },
    x: { type: 'number', description: 'X position' },
    y: { type: 'number', description: 'Y position' },
    state_variables: { type: 'string', description: 'JSON array: [{"variable":"p","value":"Y705"}]' }
  },
  execute: (figma, args) => { /* ... */ }
})

export const addProcess = defineTool({ /* similar pattern */ })
export const addArc = defineTool({ /* similar pattern */ })
export const addCompartment = defineTool({ /* similar pattern */ })
export const setStateVariable = defineTool({ /* ... */ })
export const setUnitOfInformation = defineTool({ /* ... */ })
```

#### `packages/core/src/tools/pathway/layout.ts` (NEW)

```typescript
export const autoLayoutPathway = defineTool({
  name: 'auto_layout_pathway',
  description: 'Apply automatic layout to the current pathway diagram. Arranges entities, processes, and arcs with SBGN-aware constraints.',
  mutates: true,
  params: {
    direction: { type: 'string', description: 'Primary signal flow direction', enum: ['top-bottom', 'left-right'], default: 'top-bottom' },
    spacing: { type: 'number', description: 'Minimum spacing between nodes in pixels', default: 60 }
  },
  execute: (figma, args) => {
    // 1. Collect all pathway nodes on the current page
    // 2. Build a graph model (adjacency list from arcs)
    // 3. Apply layered/hierarchical layout
    // 4. Update node positions
    // 5. Recompute arc routes
    // Return summary of layout changes
  }
})
```

#### `packages/core/src/tools/pathway/query.ts` (NEW)

```typescript
export const queryPathwayDb = defineTool({
  name: 'query_pathway_db',
  description: 'Query Reactome or Pathway Commons for pathway data. Returns entities, reactions, and interactions.',
  params: {
    source: { type: 'string', description: 'Data source', enum: ['reactome', 'pathway_commons'], required: true },
    query_type: { type: 'string', description: 'Type of query', enum: ['search_pathway', 'gene_to_pathway', 'pathway_details', 'pathway_reactions', 'protein_interactions'], required: true },
    query: { type: 'string', description: 'Search query (pathway name, gene symbol, or pathway ID)', required: true },
    species: { type: 'string', description: 'Species (default: Homo sapiens)' }
  },
  execute: async (figma, args) => {
    // Fetch from Reactome REST API or Pathway Commons API
    // Return structured data that the AI can use with create_pathway
  }
})
```

#### `packages/core/src/tools/pathway/index.ts` (NEW)

Export all pathway tools:

```typescript
export const PATHWAY_TOOLS: ToolDef[] = [
  createPathway,
  addEntity, addProcess, addArc, addCompartment,
  setStateVariable, setUnitOfInformation,
  autoLayoutPathway,
  queryPathwayDb,
]
```

### 2.2 Tool Registration

**File**: `packages/core/src/tools/registry-core.ts`

Add pathway tools to `CORE_TOOLS` so they're available in AI chat:

```typescript
import { PATHWAY_TOOLS } from './pathway'

export const CORE_TOOLS: ToolDef[] = [
  // ... existing tools ...
  ...PATHWAY_TOOLS,
]
```

Pathway tools are automatically included in `ALL_TOOLS` (which is `CORE_TOOLS + EXTENDED_TOOLS`), so MCP and CLI get them too.

### 2.3 AI System Prompt

**File**: `src/app/ai/chat/system-prompt.md`

Add a pathway-specific section to the system prompt. The key is giving the AI the SBGN vocabulary and construction rules:

```markdown
## Pathway Diagram Mode

When the user asks to draw a biological signaling pathway, use the pathway tools instead of generic shapes.

### SBGN Glyph Vocabulary

**Entities** (use `add_entity` with these types):
- `macromolecule` — proteins, enzymes, receptors (rounded rectangle)
- `simple_chemical` — small molecules, ions (circle)
- `complex` — protein complexes (double-bordered rounded rectangle)
- `nucleic_acid_feature` — DNA, genes, RNA (rectangle with folded corner)
- `phenotype` — biological outcomes (hexagon)
- `perturbation` — drugs, stimuli (parallelogram)
- `source_sink` — empty set (circle with cross)

**Processes** (use `add_process` with these types):
- `process` — generic biochemical process (small square)
- `transport` — cross-compartment transport (double-bordered square)
- `association` — complex formation (small circle)
- `dissociation` — complex breakup (half-circle)

**Arcs** (use `add_arc` with these types):
- `consumption` — entity consumed by process (arrow to process)
- `production` — entity produced by process (arrow from process)
- `catalysis` — enzyme catalyzes process (circle-on-line)
- `inhibition` — entity inhibits process (T-bar)
- `stimulation` — entity stimulates process (triangle-on-line)
- `necessary_stimulation` — required activation (filled triangle)
- `modulation` — entity modulates process (diamond-on-line)

### Construction Rules

1. **Every arc connects an entity to a process** (or vice versa). Never draw an arc directly between two entities.
2. **Consumption/production arcs** connect entities to process nodes. An entity consumed by a process gets a `consumption` arc; an entity produced gets a `production` arc.
3. **Modulation arcs** (catalysis, inhibition, stimulation, etc.) connect a regulator entity to a process node.
4. **Compartments** contain entities. Create compartments first, then place entities inside them.
5. **State variables** indicate post-translational modifications (e.g., phosphorylation at Y705). Use `set_state_variable` after creating the entity.

### Workflow

1. Use `query_pathway_db` to look up pathway data from Reactome if unsure about the biology
2. Use `create_pathway` to create the entire diagram in one call (preferred for new diagrams)
3. Use `add_entity`/`add_process`/`add_arc` for incremental modifications
4. Use `auto_layout_pathway` to arrange the diagram
5. Use `set_state_variable` to add phosphorylation/ubiquitination states

### Example

User: "Draw the JAK-STAT signaling pathway"

1. query_pathway_db(source="reactome", query_type="search_pathway", query="JAK STAT signaling")
2. create_pathway(
     compartments=[{"name":"extracellular","x":0,"y":0,"width":900,"height":100},{"name":"membrane","x":0,"y":100,"width":900,"height":80},{"name":"cytoplasm","x":0,"y":180,"width":900,"height":400},{"name":"nucleus","x":0,"y":580,"width":900,"height":200}],
     entities=[{"name":"Cytokine Receptor","type":"macromolecule","compartment":"membrane","x":400,"y":120},{"name":"JAK2","type":"macromolecule","compartment":"membrane","x":400,"y":160},{"name":"STAT3","type":"macromolecule","compartment":"cytoplasm","x":400,"y":300},{"name":"STAT3-p","type":"macromolecule","compartment":"cytoplasm","x":400,"y":400},{"name":"SOCS1","type":"macromolecule","compartment":"cytoplasm","x":200,"y":250}],
     processes=[{"type":"process","label":"phosphorylation","x":400,"y":240},{"type":"process","label":"dimerization","x":400,"y":350},{"type":"process","label":"nuclear_import","x":400,"y":500}],
     arcs=[{"type":"catalysis","source":"JAK2","target":"phosphorylation"},{"type":"consumption","source":"STAT3","target":"phosphorylation"},{"type":"production","source":"phosphorylation","target":"STAT3-p"},{"type":"consumption","source":"STAT3-p","target":"dimerization"},{"type":"production","source":"dimerization","target":"STAT3-p"},{"type":"inhibition","source":"SOCS1","target":"JAK2"},{"type":"consumption","source":"STAT3-p","target":"nuclear_import"},{"type":"production","source":"nuclear_import","target":"STAT3-p"}]
   )
3. set_state_variable(id="<STAT3-p-id>", variable="p", value="Y705")
4. auto_layout_pathway(direction="top-bottom")
```

### 2.4 Basic Auto-Layout Implementation

**File**: `packages/core/src/pathway/layout/hierarchical.ts` (NEW)

A simple hierarchical layout for signaling cascades:

```typescript
export function layoutPathwayHierarchical(
  graph: SceneGraph,
  pageId: string,
  direction: 'top-bottom' | 'left-right',
  spacing: number
): Map<string, { x: number, y: number }> {
  // 1. Collect all pathway nodes on the page
  const glyphs: Map<string, SceneNode> = new Map()
  const processes: Map<string, SceneNode> = new Map()
  const arcs: Array<{ sourceId: string, targetId: string, arcType: PathwayArcType }> = []

  // 2. Build adjacency graph
  //    - Production arcs: process → entity (downstream)
  //    - Consumption arcs: entity → process (upstream)
  //    - Modulation arcs: regulator → process (side branch)

  // 3. Topological sort (processes as intermediate nodes)
  //    - Assign layers based on longest path from sources

  // 4. Position nodes by layer
  //    - Each layer gets a y-coordinate (top-bottom) or x-coordinate (left-right)
  //    - Nodes within a layer are centered

  // 5. Compartment containment
  //    - After positioning, expand compartments to contain their children

  // 6. Return new positions
  return newPositions
}
```

**File**: `packages/core/src/pathway/layout/orthogonal.ts` (NEW)

Orthogonal edge routing for arcs:

```typescript
export function routeArcsOrthogonal(
  graph: SceneGraph,
  arcNodes: SceneNode[],
  spacing: number
): Map<string, Vector[]> {
  // For each arc:
  // 1. Get source port position and target port position
  // 2. Route through bend points using orthogonal segments
  //    - Prefer horizontal-then-vertical or vertical-then-horizontal
  //    - Avoid overlapping with other nodes
  // 3. Return bend points per arc
  return bendPoints
}
```

### 2.5 Phase 2 File Summary

| Action | File | Description |
|--------|------|-------------|
| CREATE | `packages/core/src/tools/pathway/create.ts` | `create_pathway` tool |
| CREATE | `packages/core/src/tools/pathway/modify.ts` | `add_entity`, `add_process`, `add_arc`, `add_compartment`, `set_state_variable`, `set_unit_of_information` tools |
| CREATE | `packages/core/src/tools/pathway/layout.ts` | `auto_layout_pathway` tool |
| CREATE | `packages/core/src/tools/pathway/query.ts` | `query_pathway_db` tool |
| CREATE | `packages/core/src/tools/pathway/index.ts` | Export `PATHWAY_TOOLS` array |
| MODIFY | `packages/core/src/tools/registry-core.ts` | Add `PATHWAY_TOOLS` to `CORE_TOOLS` |
| MODIFY | `src/app/ai/chat/system-prompt.md` | Add SBGN vocabulary, construction rules, workflow, examples |
| CREATE | `packages/core/src/pathway/layout/hierarchical.ts` | Hierarchical layout algorithm |
| CREATE | `packages/core/src/pathway/layout/orthogonal.ts` | Orthogonal edge routing |

---

## Phase 3 — Interoperability

**Goal**: SBGN-ML import/export, Reactome integration, CLI pathway commands.

### 3.1 SBGN-ML Import/Export

**Strategy**: Implement as an `IOFormatAdapter` following the existing pattern.

#### `packages/core/src/io/formats/sbgn-ml/` (NEW directory)

**`adapter.ts`**:

```typescript
export const sbgnmlAdapter: IOFormatAdapter = {
  id: 'sbgn-ml',
  label: 'SBGN-ML',
  role: 'interchange-document',
  category: 'document',
  extensions: ['sbgn'],
  mimeTypes: ['application/xml', 'text/xml'],
  support: { read: true, write: true, export: true },
  matchesFile(fileName) { return fileName.endsWith('.sbgn') || fileName.endsWith('.sbgnml') },
  readDocument: readSbgnMl,
  writeDocument: writeSbgnMl,
  exportContent: exportSbgnMl,
}
```

**`read.ts`** — Parse SBGN-ML XML → SceneGraph:

```typescript
export function readSbgnMl(input: IOInput, context?: IOContext): SceneGraph {
  // 1. Parse XML using DOMParser (browser) or xml2js (Node)
  // 2. For each <glyph> element:
  //    - Determine SBGN class (macromolecule, process, compartment, etc.)
  //    - Map to NodeType (PATHWAY_GLYPH, PATHWAY_PROCESS, COMPARTMENT)
  //    - Extract bbox, label, state variables, unit of information
  //    - Create SceneNode with pathway data in pluginData
  // 3. For each <arc> elements:
  //    - Map class to PathwayArcType
  //    - Create PATHWAY_ARC node with source/target references
  // 4. Return populated SceneGraph
}
```

**`write.ts`** — SceneGraph → SBGN-ML XML:

```typescript
export function writeSbgnMl(graph: SceneGraph, options?, context?): Uint8Array {
  // 1. Create XML document
  // 2. For each PATHWAY_GLYPH node: create <glyph class="macromolecule"> with bbox, label, state
  // 3. For each PATHWAY_PROCESS node: create <glyph class="process"> with bbox
  // 4. For each COMPARTMENT node: create <glyph class="compartment"> with bbox, label
  // 5. For each PATHWAY_ARC node: create <arc class="catalysis"> with start/end points
  // 6. Serialize to XML string, encode to UTF-8
}
```

**Register in `packages/core/src/io/formats.ts`**:

```typescript
import { sbgnmlAdapter } from './sbgn-ml/adapter'

export const BUILTIN_IO_FORMATS: IOFormatAdapter[] = [
  figAdapter,
  penAdapter,
  pngAdapter,
  // ... existing formats ...
  sbgnmlAdapter,  // NEW
]
```

### 3.2 Reactome API Integration

**File**: `packages/core/src/pathway/knowledge/reactome.ts` (NEW)

```typescript
const REACTOME_API = 'https://reactome.org/ContentService'

export async function searchPathways(query: string, species = 'Homo sapiens'): Promise<ReactomePathway[]> {
  const response = await fetch(`${REACTOME_API}/search/query?query=${encodeURIComponent(query)}&species=${encodeURIComponent(species)}&types=Pathway`)
  return response.json()
}

export async function getPathwayDetails(stableId: string): Promise<ReactomePathwayDetail> {
  const response = await fetch(`${REACTOME_API}/data/detail/${stableId}`)
  return response.json()
}

export async function getPathwayParticipants(stableId: string): Promise<ReactomeParticipant[]> {
  const response = await fetch(`${REACTOME_API}/data/participants/${stableId}`)
  return response.json()
}

export async function getPathwayReactions(stableId: string): Promise<ReactomeReaction[]> {
  const response = await fetch(`${REACTOME_API}/data/participants/${stableId}`)
  return response.json()
}

export async function findPathwaysByGene(gene: string, species = 'Homo sapiens'): Promise<ReactomePathway[]> {
  const response = await fetch(`${REACTOME_API}/data/mapping/UniProt/${gene}/pathways`)
  return response.json()
}
```

**File**: `packages/core/src/pathway/knowledge/pathway-commons.ts` (NEW)

```typescript
const PC_API = 'https://www.pathwaycommons.org/pc2'

export async function searchInteractions(source: string, target?: string): Promise<PCInteraction[]> {
  // GET /search?q=<source>[&q=<target>]
}

export async function getGraph(uri: string, kind = 'PATHSFROMTO'): Promise<string> {
  // GET /get?uri=<uri>&format=SBGN  (returns SBGN-ML directly!)
}
```

**Key insight**: Pathway Commons can return SBGN-ML directly via `format=SBGN`. This means we can import pathway diagrams from Pathway Commons with zero conversion — just fetch SBGN-ML and use our existing reader.

### 3.3 CLI Pathway Commands

**File**: `packages/cli/src/commands/pathway.ts` (NEW)

```typescript
export default defineCommand({
  meta: { description: 'Pathway diagram operations' },
  subCommands: {
    import: defineCommand({
      meta: { description: 'Import SBGN-ML file' },
      args: {
        file: { type: 'positional', description: 'SBGN-ML file path', required: true },
        output: { type: 'string', alias: 'o', description: 'Output .fig file path' },
      },
      async run({ args }) {
        // Read SBGN-ML → SceneGraph → write as .fig
      }
    }),
    export: defineCommand({
      meta: { description: 'Export as SBGN-ML' },
      args: {
        file: { type: 'positional', description: 'Input .fig file path', required: true },
        output: { type: 'string', alias: 'o', description: 'Output SBGN-ML file path' },
      },
      async run({ args }) {
        // Read .fig → SceneGraph → write as SBGN-ML
      }
    }),
    layout: defineCommand({
      meta: { description: 'Apply auto-layout to pathway diagram' },
      args: {
        file: { type: 'positional', description: 'Input file path', required: true },
        direction: { type: 'string', description: 'Layout direction', default: 'top-bottom' },
        output: { type: 'string', alias: 'o', description: 'Output file path' },
      },
      async run({ args }) {
        // Read file → SceneGraph → apply layout → write file
      }
    }),
    query: defineCommand({
      meta: { description: 'Query pathway databases' },
      args: {
        source: { type: 'string', description: 'Data source (reactome, pathway_commons)', required: true },
        type: { type: 'string', description: 'Query type (search, gene, reactions)', required: true },
        query: { type: 'string', description: 'Search query', required: true },
        json: { type: 'boolean', description: 'Output as JSON' },
      },
      async run({ args }) {
        // Query Reactome/Pathway Commons, format with agentfmt
      }
    }),
  }
})
```

Register in `packages/cli/src/index.ts`:

```typescript
import pathway from './commands/pathway'

subCommands: {
  // ... existing commands ...
  pathway,
}
```

### 3.4 Phase 3 File Summary

| Action | File | Description |
|--------|------|-------------|
| CREATE | `packages/core/src/io/formats/sbgn-ml/adapter.ts` | IOFormatAdapter for SBGN-ML |
| CREATE | `packages/core/src/io/formats/sbgn-ml/read.ts` | SBGN-ML XML → SceneGraph parser |
| CREATE | `packages/core/src/io/formats/sbgn-ml/write.ts` | SceneGraph → SBGN-ML XML serializer |
| MODIFY | `packages/core/src/io/formats.ts` | Register `sbgnmlAdapter` in `BUILTIN_IO_FORMATS` |
| CREATE | `packages/core/src/pathway/knowledge/reactome.ts` | Reactome REST API client |
| CREATE | `packages/core/src/pathway/knowledge/pathway-commons.ts` | Pathway Commons API client |
| CREATE | `packages/cli/src/commands/pathway.ts` | CLI pathway sub-commands |
| MODIFY | `packages/cli/src/index.ts` | Register `pathway` command |

---

## Phase 4 — Enhanced UX

**Goal**: Data overlay, advanced layout, publication export, pathway validation.

### 4.1 Data Overlay

**Strategy**: Use the existing `fills` system on `SceneNode`. When expression data is loaded, update the fill color of each `PATHWAY_GLYPH` node based on its fold-change value.

**File**: `src/components/pathway/DataOverlayPanel.vue` (NEW)

UI for loading CSV/TSV expression data and mapping genes to entities.

**File**: `packages/core/src/pathway/overlay.ts` (NEW)

```typescript
export function applyExpressionOverlay(
  graph: SceneGraph,
  pageId: string,
  data: Map<string, number>,  // gene name → fold change
  colorScale: (value: number) => Color  // e.g. blue-white-red gradient
): void {
  // For each PATHWAY_GLYPH node on the page:
  // 1. Get entity name from node.name
  // 2. Look up fold change in data map
  // 3. Compute fill color from colorScale
  // 4. Update node fills
}
```

### 4.2 Advanced Layout: ELK.js Integration

**Strategy**: Add `elkjs` as a dependency and implement an ELK-based layout algorithm that respects SBGN constraints.

**File**: `packages/core/src/pathway/layout/elk.ts` (NEW)

```typescript
import ELK from 'elkjs/lib/elk.bundled.js'

export async function layoutPathwayElk(
  graph: SceneGraph,
  pageId: string,
  direction: 'DOWN' | 'RIGHT'
): Promise<void> {
  // 1. Build ELK graph from pathway nodes
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    },
    children: [],  // pathway glyphs and processes as ELK nodes
    edges: [],     // pathway arcs as ELK edges
  }

  // 2. Add compartment children as ELK groups
  // 3. Run ELK layout
  const result = await elk.layout(elkGraph)

  // 4. Apply positions back to SceneGraph
  // 5. Route arcs orthogonally
}
```

### 4.3 Pathway Validation/Linting

**File**: `packages/core/src/pathway/lint.ts` (NEW)

SBGN compliance rules as lint checks:

```typescript
export const PATHWAY_LINT_RULES = [
  {
    id: 'arc-between-entities',
    message: 'Arcs must connect an entity to a process, not directly between two entities',
    check: (graph, pageId) => {
      // Find PATHWAY_ARC nodes where both source and target are PATHWAY_GLYPH
    }
  },
  {
    id: 'missing-compartment-ref',
    message: 'Entities should be inside a compartment',
    check: (graph, pageId) => {
      // Find PATHWAY_GLYPH nodes not inside a COMPARTMENT
    }
  },
  {
    id: 'orphan-process',
    message: 'Process nodes should have at least one consumption and one production arc',
    check: (graph, pageId) => { /* ... */ }
  },
  {
    id: 'invalid-arc-type',
    message: 'Arc type is not valid for the source/target combination',
    check: (graph, pageId) => { /* ... */ }
  },
]
```

Integrate with the existing lint system in `packages/core/src/lint/`.

### 4.4 Phase 4 File Summary

| Action | File | Description |
|--------|------|-------------|
| CREATE | `src/components/pathway/DataOverlayPanel.vue` | Expression data overlay UI |
| CREATE | `packages/core/src/pathway/overlay.ts` | Expression data → fill color mapping |
| CREATE | `packages/core/src/pathway/layout/elk.ts` | ELK.js layout integration |
| CREATE | `packages/core/src/pathway/lint.ts` | SBGN compliance lint rules |
| MODIFY | `packages/core/src/lint/` | Register pathway lint rules |

---

## Phase 5 — Advanced Features

**Goal**: Sketch-to-SBGN, pathway merging, SBGN AF/ER, simulation, collaboration.

### 5.1 Sketch-to-SBGN

**Strategy**: Use multimodal LLM (GPT-4o, Claude) to analyze uploaded pathway sketches and convert to structured pathway data.

**File**: `packages/core/src/tools/pathway/sketch.ts` (NEW)

```typescript
export const sketchToPathway = defineTool({
  name: 'sketch_to_pathway',
  description: 'Convert a hand-drawn pathway sketch image into a structured pathway diagram',
  mutates: true,
  params: {
    image_data: { type: 'string', description: 'Base64-encoded image of the hand-drawn sketch', required: true },
    description: { type: 'string', description: 'Optional text description of what the sketch shows' },
  },
  execute: async (figma, args) => {
    // 1. Send image to multimodal LLM with SBGN extraction prompt
    // 2. Parse LLM response into structured pathway data
    // 3. Call create_pathway with the extracted data
    // 4. Return the created diagram
  }
})
```

This follows the SBGNFlow approach: image → multimodal LLM → SBGN-ML → diagram.

### 5.2 Pathway Merging

**File**: `packages/core/src/pathway/merge.ts` (NEW)

```typescript
export function mergePathways(
  graph: SceneGraph,
  sourcePageId: string,
  targetPageId: string,
  options: { entityMatching: 'name' | 'uniprot' }
): MergeResult {
  // 1. Find matching entities across pathways (same name or UniProt ID)
  // 2. Merge matching entities (keep one, redirect arcs)
  // 3. Position non-overlapping entities
  // 4. Re-route arcs
  // 5. Return merge report
}
```

### 5.3 SBGN AF and ER Languages

**Strategy**: Add `language` field to pathway data. The renderer dispatches to different paint routines based on the language:

- **PD** (Phase 1-4): Full process description with process nodes
- **AF**: Simpler — entities directly influence each other, no process nodes. Arcs connect entities directly.
- **ER**: Entity-relationship — focuses on relationships rather than processes

**File**: `packages/core/src/pathway/af-glyphs.ts` (NEW) — AF-specific glyph shapes
**File**: `packages/core/src/pathway/er-glyphs.ts` (NEW) — ER-specific glyph shapes

### 5.4 Phase 5 File Summary

| Action | File | Description |
|--------|------|-------------|
| CREATE | `packages/core/src/tools/pathway/sketch.ts` | Sketch-to-SBGN tool |
| CREATE | `packages/core/src/pathway/merge.ts` | Pathway merging algorithm |
| CREATE | `packages/core/src/pathway/af-glyphs.ts` | SBGN AF glyph paint routines |
| CREATE | `packages/core/src/pathway/er-glyphs.ts` | SBGN ER glyph paint routines |
| MODIFY | `packages/core/src/canvas/scene.ts` | Dispatch by language type |

---

## Cross-Cutting Concerns

### Testing Strategy

| Test Type | Location | What to Test |
|-----------|----------|-------------|
| **Unit** | `tests/engine/pathway/` | Glyph data types, port computation, pathway data read/write, SBGN-ML parsing |
| **Visual** | `tests/e2e/canvas/pathway-visuals.spec.ts` | Canvas snapshots for each glyph type, arc decoration, compartment rendering |
| **Integration** | `tests/e2e/ai/pathway-generation.spec.ts` | AI tool execution: create_pathway, add_entity, auto_layout |
| **Round-trip** | `tests/engine/sbgn-ml-roundtrip.test.ts` | SBGN-ML → SceneGraph → SBGN-ML fidelity |

### Dependency Additions

| Package | Phase | Purpose |
|---------|-------|---------|
| `elkjs` | Phase 4 | Advanced graph layout |
| `fast-xml-parser` | Phase 3 | SBGN-ML XML parsing (browser + Node compatible) |
| No new deps | Phase 1-2 | All rendering uses existing CanvasKit, all tools use existing infrastructure |

### Performance Considerations

1. **Glyph rendering**: Pre-compute glyph path templates (CanvasKit `Path` objects) and cache them. Only rebuild when node size changes.
2. **Arc routing**: Cache bend points. Invalidate only when source/target nodes move.
3. **Layout**: Run layout in a Web Worker for large pathways (>100 nodes).
4. **SBGN-ML parsing**: Stream-parse large files; don't hold entire XML DOM in memory.

### Migration Path for Existing Users

- The new node types (`PATHWAY_GLYPH`, `PATHWAY_PROCESS`, `PATHWAY_ARC`, `COMPARTMENT`) are additive — existing documents are unaffected.
- The pathway tools are added to `CORE_TOOLS`, increasing the AI chat tool count. The system prompt section is conditional — only included when the user's first message mentions pathway/biological terms, or when explicitly in "pathway mode".
- The SBGN-ML format adapter is registered alongside existing formats — no conflicts.
