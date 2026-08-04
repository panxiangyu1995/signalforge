# BioPath Visual Quality Optimization — From "Flat B&W" to "Publication-Quality 拟物风格"

> Root cause analysis + concrete optimization plan · July 2026
>
> Based on: first-run testing feedback (layout chaos, flat B&W style, glyphs don't look like biological structures)
> Audited against: current implementation in `packages/core/src/pathway/` + existing specs in `biopath-visual-fidelity.md`, `biopath-refinement.md`

---

## Problem Diagnosis

After auditing the current code, the two user-reported problems have clear root causes:

### Problem 1: "黑白风格" (Flat B&W Style)

**Root cause**: The default rendering style is `'sbgn'`, which uses `#f6f6f6` (flat gray) fill + `#555` (dark gray) border for ALL glyph types. The `PUBLICATION_STYLE` with semantic colors exists in `constants.ts` but is **never activated by default**.

Evidence:
- `glyphs.ts:16` — `glyphFill()` falls through to `SBGN_STYLE.nodeBackgroundColor` (`#f6f6f6`) when style is `'sbgn'`
- `render.ts:22` — `r.pathwayStyle` reads from renderer, which defaults to `'sbgn'`
- `create.ts` — `create_pathway` tool never calls `set_pathway_style`
- No gradient fills exist anywhere — all fills are flat solid colors
- No drop shadows exist — no `ImageFilter.MakeDropShadow()` calls
- No membrane lines — `paintMembraneLine()` is specified in visual-fidelity.md but never implemented
- No multimer ghost rendering — `multimer` field exists in data but no paint routine

**The gap**: The code has the *infrastructure* for two styles but the "publication" style is just flat pastel colors. True "拟物风格" requires **gradient fills, drop shadows, membrane textures, and depth cues** — none of which exist.

### Problem 2: "布局错乱" (Layout Chaos)

**Root cause**: The hierarchical layout algorithm is too naive for real pathway diagrams.

Evidence:
- `hierarchical.ts` — simple BFS topological sort, no crossing minimization, no barycenter ordering
- `orthogonal.ts` — naive midpoint routing: just two bend points at `(sx, midY)` and `(tx, midY)`, no obstacle avoidance
- `create.ts` — AI tool creates entities at `x: 0, y: 0` when no position specified, causing all nodes to stack at origin
- No force-directed refinement step after initial placement
- No port-aware routing — arcs go center-to-center when ports aren't pre-computed
- Compartments auto-expand but only after all nodes are placed, so initial positions may be outside compartment bounds

---

## Optimization Plan

### V1: Default to Publication Style + Gradient Fills (Highest Impact)

**Why**: This is the single biggest visual improvement. Switching from flat gray to semantic gradient fills transforms the diagram from "technical schematic" to "publication figure."

**Files**:
- MODIFY `packages/core/src/pathway/constants.ts`
- MODIFY `packages/core/src/pathway/glyphs.ts`
- MODIFY `packages/core/src/pathway/render.ts`
- MODIFY `packages/core/src/tools/pathway/create.ts`

#### V1.1 Add Gradient Definitions to PUBLICATION_STYLE

In `constants.ts`, add gradient specs for each entity type:

```typescript
export const PUBLICATION_STYLE = {
  // ... existing entityFills, entityBorders, etc. ...

  entityGradients: {
    macromolecule: { top: '#D4E6F1', bottom: '#A9CCE3' },
    simple_chemical: { top: '#FADBD8', bottom: '#F5B7B1' },
    nucleic_acid_feature: { top: '#D5F5E3', bottom: '#ABEBC6' },
    complex: { top: '#E8DAEF', bottom: '#D2B4DE' },
    perturbation: { top: '#D1F2EB', bottom: '#A3E4D7' },
    phenotype: { top: '#FEF9E7', bottom: '#F9E79F' },
    source_sink: { top: '#F2F3F4', bottom: '#D5D8DC' },
    unspecified_entity: { top: '#F2F3F4', bottom: '#D5D8DC' },
  },

  dropShadow: {
    offset: { x: 1, y: 2 },
    blur: 3,
    color: 'rgba(0, 0, 0, 0.15)',
  },

  compartmentShadow: {
    offset: { x: 2, y: 4 },
    blur: 8,
    color: 'rgba(0, 0, 0, 0.08)',
  },
} as const
```

#### V1.2 Implement Gradient Fill in Glyph Painters

In `glyphs.ts`, replace flat fill with gradient fill when style is `'publication'`:

```typescript
function glyphFillPaint(
  ck: CanvasKit,
  glyphType: PathwayGlyphType | undefined,
  style: PathwayStyle,
  nodeHeight: number
): Float32Array | CanvasShader {
  if (style === 'publication' && glyphType) {
    const grad = PUBLICATION_STYLE.entityGradients[glyphType]
    if (grad) {
      const shader = ck.Shader.MakeLinearGradient(
        0, 0, 0, nodeHeight,
        [hexToCKColor(ck, grad.top), hexToCKColor(ck, grad.bottom)],
        [0, 1],
        ck.TileMode.Clamp
      )
      return shader
    }
  }
  return hexToCKColor(ck, SBGN_STYLE.nodeBackgroundColor)
}
```

Each glyph painter needs to:
1. Create gradient shader → set on fillPaint via `fillPaint.setShader(shader)`
2. Draw the fill path
3. Reset shader to null (`fillPaint.setShader(null)`)
4. Draw the stroke path (no gradient on stroke)

#### V1.3 Add Drop Shadow to Entities

In `render.ts`, before painting each glyph, apply a drop shadow image filter:

```typescript
if (style === 'publication') {
  const shadowSpec = PUBLICATION_STYLE.dropShadow
  const shadowFilter = ck.ImageFilter.MakeDropShadow(
    shadowSpec.offset.x, shadowSpec.offset.y,
    shadowSpec.blur, shadowSpec.blur,
    hexToCKColor(ck, shadowSpec.color)
  )
  r.fillPaint.setImageFilter(shadowFilter)
  // ... paint glyph ...
  r.fillPaint.setImageFilter(null)
  shadowFilter.delete()
}
```

#### V1.4 Default to Publication Style

In `create.ts`, after creating all nodes, automatically set the style to `'publication'`:

```typescript
figma.setPathwayStyle('publication')
```

Also change the renderer default from `'sbgn'` to `'publication'` so manually placed glyphs also look good.

**Acceptance criteria**:
- ✓ New pathway diagrams render with gradient fills by default
- ✓ Each glyph type has a distinct color (blue=protein, pink=metabolite, green=DNA, purple=complex)
- ✓ Subtle drop shadow creates depth perception
- ✓ SBGN strict style still available via `set_pathway_style(style='sbgn')`

---

### V2: Compartment Visual Upgrade (High Impact)

**Why**: Compartments are the largest visual elements. Flat transparent rectangles look like "boxes" — not like cell structures.

**Files**:
- MODIFY `packages/core/src/pathway/render.ts`
- MODIFY `packages/core/src/pathway/constants.ts`
- CREATE `packages/core/src/pathway/membrane.ts`

#### V2.1 Compartment Gradient Background

Replace flat `rgba(0,0,0,0.03)` fill with compartment-type-specific gradient:

```typescript
function compartmentFillPaint(
  ck: CanvasKit,
  compartmentName: string,
  width: number,
  height: number
): CanvasShader | Float32Array {
  const compType = inferCompartmentType(compartmentName)
  const fill = PUBLICATION_STYLE.compartmentFills[compType]
    ?? PUBLICATION_STYLE.compartmentFills.default

  // Parse rgba → top color (slightly more opaque) → bottom color (base opacity)
  // Create vertical gradient shader
  const topColor = adjustAlpha(fill, 1.3)  // slightly more visible at top
  const bottomColor = fill
  return ck.Shader.MakeLinearGradient(
    0, 0, 0, height,
    [parseRgbaToCKColor(ck, topColor), parseRgbaToCKColor(ck, bottomColor)],
    [0, 1],
    ck.TileMode.Clamp
  )
}
```

#### V2.2 Compartment Type Inference

```typescript
type CompartmentType = 'extracellular' | 'membrane' | 'cytoplasm' | 'nucleus' |
  'mitochondria' | 'endoplasmic_reticulum' | 'golgi' | 'default'

function inferCompartmentType(name: string): CompartmentType {
  const lower = name.toLowerCase()
  if (lower.includes('extracellul')) return 'extracellular'
  if (lower.includes('membrane') || lower.includes('plasma')) return 'membrane'
  if (lower.includes('cytoplasm') || lower.includes('cytosol')) return 'cytoplasm'
  if (lower.includes('nucleus') || lower.includes('nuclear')) return 'nucleus'
  if (lower.includes('mitochondr')) return 'mitochondria'
  if (lower.includes('endoplasm') || lower.includes('er')) return 'endoplasmic_reticulum'
  if (lower.includes('golgi')) return 'golgi'
  return 'default'
}
```

#### V2.3 Membrane Line Rendering

Create `membrane.ts` with `paintMembraneLine()`:

- **Plasma membrane**: thick line (3px) at compartment top boundary + lipid bilayer ticks (short perpendicular lines every 8px)
- **Nuclear membrane**: double line with periodic gaps (nuclear pores every 40px)
- **Mitochondrial membrane**: double membrane (outer smooth, inner folded with cristae-like zigzag)

The membrane line is rendered INSIDE the compartment, at the top boundary, creating the visual effect of entities straddling the membrane.

#### V2.4 Compartment Drop Shadow

Apply a larger, softer shadow to compartments (behind entities):

```typescript
const shadowSpec = PUBLICATION_STYLE.compartmentShadow
const shadowFilter = ck.ImageFilter.MakeDropShadow(
  shadowSpec.offset.x, shadowSpec.offset.y,
  shadowSpec.blur, shadowSpec.blur,
  hexToCKColor(ck, shadowSpec.color)
)
```

**Acceptance criteria**:
- ✓ Cytoplasm compartment has light green gradient background
- ✓ Nucleus compartment has light purple gradient background
- ✓ Membrane compartment shows lipid bilayer texture
- ✓ Nuclear membrane shows double-line with pore gaps
- ✓ Compartments have subtle drop shadow creating depth

---

### V3: Layout Algorithm Overhaul (High Impact)

**Why**: The current hierarchical layout produces overlapping nodes, wrong flow direction, and no crossing minimization.

**Files**:
- MODIFY `packages/core/src/pathway/layout/hierarchical.ts`
- MODIFY `packages/core/src/pathway/layout/orthogonal.ts`
- MODIFY `packages/core/src/tools/pathway/create.ts`
- MODIFY `packages/core/src/tools/pathway/layout.ts`

#### V3.1 Smart Default Positioning in create_pathway

The biggest layout issue: AI creates entities at `(0, 0)` when no position is given. Fix by computing initial positions based on the graph structure BEFORE creating nodes:

```typescript
// In create_pathway, after parsing all specs but BEFORE creating nodes:
// 1. Build adjacency graph from arc specs
// 2. Topological sort to assign layers
// 3. Compute positions for each layer
// 4. Use computed positions as defaults when spec.x/spec.y are missing
```

This means the `create_pathway` tool should:
1. Parse all specs
2. Build a virtual graph (names only, no SceneGraph nodes yet)
3. Run layout on the virtual graph to get positions
4. Create nodes at the computed positions
5. Then run `auto_layout_pathway` for fine-tuning

#### V3.2 Barycenter Ordering in Hierarchical Layout

Replace the current "just use the order they appear" with barycenter heuristic:

```typescript
// After assigning layers, for each layer:
// 1. For each node in the layer, compute the average position (barycenter)
//    of its neighbors in the adjacent layer
// 2. Sort nodes in the layer by barycenter value
// 3. Repeat for 3-5 iterations (sweeping up then down)
```

This dramatically reduces edge crossings.

#### V3.3 Port-Aware Orthogonal Routing

Replace naive midpoint routing with port-aware routing:

```typescript
export function computeOrthogonalBendPoints(
  graph: SceneGraph,
  pageId: string
): number {
  const arcs = collectPathwayArcs(graph, pageId)
  let updated = 0

  for (const arc of arcs) {
    const data = getPathwayData(arc)
    if (!data?.sourceId || !data?.targetId) continue

    const sourceNode = graph.getNode(data.sourceId)
    const targetNode = graph.getNode(data.targetId)
    if (!sourceNode || !targetNode) continue

    // Use port positions instead of centers
    const sourceData = getPathwayData(sourceNode)
    const targetData = getPathwayData(targetNode)
    const sourceAbs = graph.getAbsolutePosition(data.sourceId)
    const targetAbs = graph.getAbsolutePosition(data.targetId)

    // Find the ports that face each other
    const sourcePort = data.sourcePort ?? findNearestPort(sourceNode, sourceData ?? {}, {
      x: targetAbs.x + targetNode.width / 2 - sourceAbs.x,
      y: targetAbs.y + targetNode.height / 2 - sourceAbs.y
    })
    const targetPort = data.targetPort ?? findNearestPort(targetNode, targetData ?? {}, {
      x: sourceAbs.x + sourceNode.width / 2 - targetAbs.x,
      y: sourceAbs.y + sourceNode.height / 2 - targetAbs.y
    })

    const sx = sourceAbs.x + sourcePort.x
    const sy = sourceAbs.y + sourcePort.y
    const tx = targetAbs.x + targetPort.x
    const ty = targetAbs.y + targetPort.y

    // Route based on port sides
    const bendPoints = routeFromPorts(sourcePort, targetPort, sx, sy, tx, ty)
    updatePathwayData(arc, { bendPoints, sourcePort, targetPort })
    updated++
  }

  return updated
}

function routeFromPorts(
  sourcePort: PortPosition,
  targetPort: PortPosition,
  sx: number, sy: number,
  tx: number, ty: number
): Vector[] {
  const bendPoints: Vector[] = []
  const exitLen = 20  // minimum exit segment length

  // Exit source port perpendicular to its side
  switch (sourcePort.side) {
    case 'bottom': bendPoints.push({ x: sx, y: sy + exitLen }); break
    case 'top':    bendPoints.push({ x: sx, y: sy - exitLen }); break
    case 'right':  bendPoints.push({ x: sx + exitLen, y: sy }); break
    case 'left':   bendPoints.push({ x: sx - exitLen, y: sy }); break
  }

  // Enter target port perpendicular to its side
  const lastBend = bendPoints[bendPoints.length - 1] ?? { x: sx, y: sy }
  let entryX = tx, entryY = ty
  switch (targetPort.side) {
    case 'top':    entryY = ty - exitLen; break
    case 'bottom': entryY = ty + exitLen; break
    case 'left':   entryX = tx - exitLen; break
    case 'right':  entryX = tx + exitLen; break
  }

  // Connect exit to entry with at most 2 additional bends
  if (lastBend.x !== entryX && lastBend.y !== entryY) {
    // Need a corner: prefer vertical-horizontal-vertical
    bendPoints.push({ x: lastBend.x, y: entryY })
  }
  bendPoints.push({ x: entryX, y: entryY })

  return bendPoints
}
```

#### V3.4 Force-Directed Refinement

After hierarchical placement, run a short force-directed refinement (50 iterations) to:
- Push overlapping nodes apart
- Pull connected nodes closer
- Keep nodes inside their compartment

```typescript
function forceDirectedRefinement(
  graph: SceneGraph,
  pageId: string,
  iterations: number = 50
): void {
  const repulsion = 4500
  const attraction = 0.01
  const idealLength = 80

  for (let iter = 0; iter < iterations; iter++) {
    const displacements = new Map<string, { dx: number; dy: number }>()

    // Repulsion between all node pairs
    // Attraction along arcs
    // Compartment containment force
    // Apply displacements with cooling schedule
  }
}
```

**Acceptance criteria**:
- ✓ `create_pathway` produces non-overlapping initial layout
- ✓ Signal flows top-to-bottom by default
- ✓ Arcs route orthogonally from port to port
- ✓ No edge crossings in simple linear pathways
- ✓ Compartments contain their children

---

### V4: Multimer + Active State Rendering (Medium Impact)

**Why**: These are specified in visual-fidelity.md but not implemented. Multimer stacking is a key visual cue for "this is a complex of multiple copies."

**Files**:
- MODIFY `packages/core/src/pathway/glyphs.ts`
- MODIFY `packages/core/src/pathway/render.ts`

#### V4.1 Multimer Ghost Rendering

Before painting the main glyph, if `data.multimer === true`, paint a ghost copy offset by `(5-16, 5-16)`:

```typescript
const MULTIMER_OFFSETS: Record<PathwayGlyphType, { x: number; y: number }> = {
  macromolecule: { x: 12, y: 12 },
  simple_chemical: { x: 5, y: 5 },
  complex: { x: 16, y: 16 },
  nucleic_acid_feature: { x: 12, y: 12 },
  phenotype: { x: 8, y: 8 },
  perturbation: { x: 8, y: 8 },
  source_sink: { x: 5, y: 5 },
  unspecified_entity: { x: 8, y: 8 },
}
```

In `renderPathwayGlyph`, before the main glyph paint:

```typescript
if (data.multimer) {
  canvas.save()
  const offset = MULTIMER_OFFSETS[data.glyphType ?? 'unspecified_entity'] ?? { x: 8, y: 8 }
  canvas.translate(offset.x, offset.y)
  paintPathwayGlyph(ck, canvas, node, data, style, r)  // ghost
  canvas.restore()
}
// Then paint main glyph on top
paintPathwayGlyph(ck, canvas, node, data, style, r)
```

#### V4.2 Active State Dashed Border

If `data.activeState === true`, draw a larger dashed border around the glyph:

```typescript
if (data.activeState) {
  const pad = SBGN_STYLE.activePadding
  const dashPath = buildExpandedGlyphPath(ck, node, data, pad)
  r.strokePaint.setStrokeWidth(SBGN_STYLE.defaultBorderWidth)
  r.strokePaint.setPathEffect(ck.PathEffect.MakeDash(SBGN_STYLE.activeDashPattern, 0))
  canvas.drawPath(dashPath, r.strokePaint)
  r.strokePaint.setPathEffect(null)
  dashPath.delete()
}
```

**Acceptance criteria**:
- ✓ Multimer entities show stacked ghost behind main shape
- ✓ Active state entities show dashed border expansion
- ✓ Ghost offset varies by glyph type (matching cytoscape-sbgn-stylesheet)

---

### V5: Unit of Information Badge Rendering (Medium Impact)

**Why**: `unitOfInformation` field exists in `PathwayNodeData` but `paintStateVariables()` only handles state variables. Units of information (like "MT:mtDNA", "charge:2+") are essential for pathway semantics.

**Files**:
- MODIFY `packages/core/src/pathway/labels.ts`
- MODIFY `packages/core/src/pathway/render.ts`

#### V5.1 Render Unit of Information Badges

Add `paintUnitOfInformation()` to `labels.ts`:

- Same stadium/pill shape as state variables
- Positioned BELOW state variables (or above if no state variables)
- White fill, gray border, 10px font
- Label format: raw text (e.g., "MT:mtDNA")

In `render.ts`, add after `paintStateVariables()`:

```typescript
if (data.unitOfInformation && data.unitOfInformation.length > 0) {
  paintUnitOfInformation(ck, canvas, node, data, r)
}
```

**Acceptance criteria**:
- ✓ Entity with `unitOfInformation: [{ text: 'MT:mtDNA' }]` renders badge
- ✓ Badge positioned below state variable badges
- ✓ Badge is stadium shape with white fill, gray border

---

### V6: Z-Order / Multi-Pass Rendering (Medium Impact)

**Why**: Currently, arcs and entities render in SceneGraph child order. Arcs behind entities get hidden by entity fills. Arc decorations (T-bar, circle) get hidden behind target nodes.

**Files**:
- MODIFY `packages/core/src/canvas/scene.ts`
- MODIFY `packages/core/src/pathway/render.ts`

#### V6.1 Four-Pass Rendering for Pathway Pages

When the current page contains pathway nodes, render in 4 passes:

```
Pass 1: Compartment fills (background)
Pass 2: Arc lines (behind entities)
Pass 3: Entity + process fills + strokes
Pass 4: Arc decorations + labels + badges (on top of everything)
```

Implementation: In `renderNodeContent()`, detect if the page has pathway nodes. If so, collect all pathway nodes into buckets and render in pass order instead of child-order.

**Acceptance criteria**:
- ✓ Arc lines render behind entity fills
- ✓ Arc decorations (T-bar, circle, triangle) render on top of target nodes
- ✓ Labels and badges render on top of everything
- ✓ Non-pathway nodes render normally (no regression)

---

### V7: AI Prompt Enhancement (Medium Impact)

**Why**: The AI doesn't know about visual quality expectations, so it generates diagrams with wrong sizes, no compartments, and no style preference.

**Files**:
- MODIFY `src/app/ai/chat/system-prompt.md`

#### V7.1 Add Visual Quality Rules to System Prompt

Add a `## Visual Quality Rules` section:

1. Always call `set_pathway_style(style='publication')` after creating a pathway
2. Always call `auto_layout_pathway(direction='top-bottom')` after creating all nodes
3. Entity sizing defaults (macromolecule ~100×50, simple_chemical ~50×50, etc.)
4. Process sizing (24×24 for all)
5. Spacing rules (60px between entities and processes, 80px between cascading processes)
6. Compartment creation order (compartments first, entities inside)
7. State variable formatting ("VALUE@VARIABLE")
8. Arc routing preferences (consumption downward, production downward, modulation from side)

**Acceptance criteria**:
- ✓ AI chat generates pathways with publication style by default
- ✓ AI chat calls auto_layout after creation
- ✓ Generated diagrams have correct entity sizes and spacing

---

## Execution Priority

| Priority | Item | Visual Impact | Effort |
|----------|------|---------------|--------|
| **1** | V1: Default publication style + gradients + shadows | Transformative | 2-3 days |
| **2** | V3: Layout overhaul (smart positioning + barycenter + port routing) | Transformative | 3-4 days |
| **3** | V2: Compartment visual upgrade (gradients + membrane lines) | High | 2 days |
| **4** | V6: Z-order multi-pass rendering | High | 1-2 days |
| **5** | V4: Multimer + active state rendering | Medium | 1 day |
| **6** | V7: AI prompt enhancement | Medium | 0.5 day |
| **7** | V5: Unit of information badges | Low-Medium | 0.5 day |

**Recommended execution order**: V1 → V3 → V2 → V6 → V4 → V7 → V5

V1 and V3 are the two transformative changes that directly address the user's complaints. V1 fixes the "flat B&W" problem; V3 fixes the "layout chaos" problem.

---

## Visual Comparison: Before vs After

### Before (Current State)
```
┌─────────────┐     ┌─────────────┐
│  JAK2       │─────│  STAT3      │     ← flat gray fill, gray border
└─────────────┘     └─────────────┘     ← no gradient, no shadow
       │                   │             ← center-to-center arcs
       ▼                   ▼             ← no port awareness
    ┌────┐             ┌────┐           ← process nodes same visual weight
    │    │             │    │           ← as entity nodes
    └────┘             └────┘           ← no compartment context
                                       ← all same gray color
```

### After (With V1+V2+V3)
```
╔══════════════════════════════════════════╗
║  Cytoplasm                               ║  ← green gradient background
║                                          ║  ← subtle shadow
║  ┌─────────────┐    ┌─────────────┐     ║
║  │▓▓▓▓▓▓▓▓▓▓▓▓▓│    │▓▓▓▓▓▓▓▓▓▓▓▓▓│     ║  ← blue gradient (protein)
║  │  JAK2       │    │  STAT3  P@Y│     ║  ← state variable badge
║  │▓▓▓▓▓▓▓▓▓▓▓▓▓│    │▓▓▓▓▓▓▓▓▓▓▓▓▓│     ║  ← drop shadow
║  └──────┬──────┘    └──────┬──────┘     ║
║         │                   │            ║  ← port-aware orthogonal arcs
║         ▼                   ▼            ║  ← blue color (activation)
║      ┌────┐             ┌────┐          ║
║      │    │             │    │          ║  ← small process nodes
║      └────┘             └────┘          ║  ← proper visual hierarchy
╚══════════════════════════════════════════╝
```

---

## Key Design Decisions

1. **Default to publication style** — SBGN strict gray is for standards compliance testing, not for user-facing output. Users expect colorful, professional diagrams.

2. **Gradient fills, not flat colors** — The "拟物" (skeuomorphic) effect comes from top-to-bottom gradients that suggest 3D volume. This is what BioRender, CellDesigner, and Reactome all do.

3. **Drop shadows for depth** — Even a 1-2px shadow creates a sense of layering that flat rendering lacks. Compartments behind entities, entities behind labels.

4. **Smart initial positioning** — The AI tool should compute layout BEFORE creating nodes, not after. This prevents the "all nodes at (0,0)" problem.

5. **Port-aware routing** — Arcs must exit/enter glyphs perpendicular to the boundary, not diagonally from center. This is the #1 visual difference between amateur and professional pathway diagrams.

6. **Membrane lines** — The single most distinctive visual element of cell signaling diagrams. Without them, a "JAK-STAT pathway" looks like a generic flowchart.

7. **Multi-pass rendering** — Arcs behind entities, decorations on top. This is non-negotiable for visual correctness.
