# SignalForge

AI-native biological signaling pathway diagram editor. Generates **SBGN Process Description (PD) Level 1 Version 2.1** compliant diagrams from natural language, with knowledge base integration (Reactome / Pathway Commons), gene expression data overlay, and a programmable MCP/CLI toolkit for headless automation. Built on the open-source SignalForge design editor foundation; also opens `.fig` and `.pen` design files, includes 100+ general-purpose design tools, and ships with a headless Vue SDK.

> **Status:** Active development. Usable today for pathway authoring, with some advanced SBGN features evolving. General-purpose design tools are production-ready.

**[Try it online →](https://app.signalforge.dev/demo)** · [Download](https://github.com/panxiangyu1995/signalforge/releases/latest) · [Documentation](https://signalforge.dev) · [llms.txt](https://signalforge.dev/llms.txt) · [SBGN PD Reference](https://sbgn.github.io/specifications/PD/)

![SignalForge](packages/docs/public/screenshot.png)

## Installation

**macOS (Homebrew):**

```sh
brew install signalforge
```

Or download from the [releases page](https://github.com/panxiangyu1995/signalforge/releases/latest), or [use the web app](https://app.signalforge.dev) — no install needed.

## What it does

- **AI builds SBGN pathways** — describe your pathway in plain language (e.g. *"JAK2 phosphorylates STAT3 at Y705, which then dimerizes and translocates to the nucleus to transcriptionally activate SOCS3"*) and SignalForge decomposes it into SBGN-compliant entities, process nodes, typed arcs, compartments, and labels. 90+ pathway-specific tools plus general design tools. Bring your own API key for OpenRouter, Anthropic, OpenAI, Google AI, Z.ai, MiniMax, or compatible endpoints. No backend, no account.
- **Full SBGN PD vocabulary** — every element is a typed glyph rendered from a canonical Skia paint routine (not user-drawn), so a protein always looks like a protein. Supports macromolecules, simple chemicals, complexes, nucleic acid features, perturbations, phenotypes, source/sink entities, plus process nodes (reactions, transport, association/dissociation) and typed arcs (consumption, production, catalysis, inhibition, stimulation, necessary stimulation, modulation, trigger, logic gates).
- **Knowledge base integration** — query Reactome and Pathway Commons directly from the editor. Import curated pathways as starter diagrams, resolve gene/protein identifiers, pull references and annotations, then refine with AI or manual editing.
- **Data overlay on pathways** — load gene expression matrices (CSV/TSV) and map fold-changes or p-values onto pathway entities via color scales, heatmap badges, or violin plots alongside labels and state variables. Export overlay figures as publication-quality PNG/SVG/PDF.
- **SBGN-ML round-trip** — import and export SBGN-ML files with full fidelity for interoperability with Newt, CellDesigner, PathVisio, and libSBGN. Every export is validated against the SBGN PD schema. Native `.bio-path` format extends the document model with pathway-specific fields and always embeds a valid SBGN-ML subset.
- **Pathway layout & arc routing** — compartment-aware layout algorithms (force-directed + SBGN-specific heuristics, with ELK.js integration planned), orthogonal arc routing with minimal crossings, and 8-port boundary connections per glyph so arcs always terminate on SBGN-standard ports.
- **State variables & units of information** — add phosphorylation sites (e.g. *pY705*), subcellular location tags, mutation markers, multimer/clone markers, and arbitrary unit-of-information badges that render as child nodes on SBGN entities.
- **Pathway validation** — one-click SBGN PD compliance check: catches common AI hallucinations such as direct EPN↔EPN arcs without a process node, invalid source/target/arc-type combinations, dangling compartment references, and malformed state variable syntax.
- **Opens `.fig` and `.pen` files** — read and write native Figma files, open supported Pencil documents, copy & paste nodes between apps, use alongside pathway diagrams on the same canvas.
- **Fully programmable** — headless CLI, XPath queries, Figma Plugin API via `eval`, MCP server for AI coding agents (Claude Code, Cursor, Windsurf), and desktop agent integrations (Claude Code, Codex, Gemini CLI). All pathway operations are exposed through the same ToolDef interface.
- **Vue SDK for custom editors** — headless components and composables for embedding SignalForge into scientific workflow apps or building lab-specific editing surfaces. [Read the SDK docs →](https://signalforge.dev/programmable/sdk/)
- **Real-time collaboration** — P2P via WebRTC, no server, no account. Cursors, presence, follow mode. Share a link and co-edit pathways with your lab.
- **Design-to-code export** — export selections or whole pathways as JSX/Tailwind, standalone HTML, or publication-ready PNG/JPG/SVG/PDF. General-purpose design tokens and Figma-style component system also available.
- **~7 MB desktop app** — Tauri v2 for macOS, Windows, Linux. Also runs in the browser as a PWA.

## SBGN glyph vocabulary (quick reference)

| Category | Types |
|----------|-------|
| **Entity pool nodes (EPNs)** | `macromolecule` (rounded rectangle), `simple_chemical` (circle), `complex` (black-bordered rectangle with subunit ports), `nucleic_acid_feature` (half-rounded bottom), `unspecified_entity` (square), `perturbation` (hexagon), `phenotype` (hexagon w/ label band), `source_sink` (empty circle) |
| **Process nodes** | `biochemical_reaction` (square), `transport` (two squares connected), `association` (merged-circle), `dissociation` (split-circle), `omitted_process` (oval), `uncertain_process` (diamond), `phenotype_process` (tagged) |
| **Typed arcs** | `consumption` (plain line → process), `production` (filled arrow from process), `catalysis` (circle-on-line decoration), `inhibition` (T-bar decoration), `stimulation` (open triangle), `necessary_stimulation` (filled triangle), `modulation` (diamond-on-line), `trigger` (open arrow w/ crossbar), `logic_and`, `logic_or`, `logic_not` |
| **Compartments** | Rounded rectangles with curved-corner rendering; entities snap into compartments and move with them; nested compartments supported |
| **Decorations** | State variables (small subunit rectangles w/ labels like *pY705*), units of information (bottom badges), clone markers, multimer indicators |

Reference implementation: [cytoscape-sbgn-stylesheet](https://github.com/PathwayCommons/cytoscape-sbgn-stylesheet) and [sbgnviz.js](https://github.com/iVis-at-Bilkent/sbgnviz.js) for canonical SBGN visual properties.

## CLI

```sh
npm install -g @signal-forge/cli
# or: bun add -g @signal-forge/cli
```

### Pathway-specific commands

Inspect, validate, and convert pathway documents headlessly:

```sh
signalforge pathway info pathway.sbgnml                    # SBGN-ML summary
signalforge pathway validate pathway.sbgnml                # SBGN PD compliance check
signalforge pathway import pathway.sbgnml -o diagram.fig   # SBGN-ML → .fig
signalforge pathway export diagram.fig -o pathway.sbgnml   # .fig → SBGN-ML
signalforge pathway layout diagram.fig --style flow-tb    # Re-layout (top→bottom signal flow)
signalforge pathway query-reactome "JAK-STAT" -o out.fig   # Pull pathway from Reactome
```

### Inspect design & pathway files

Browse node trees, search by glyph type, dig into SBGN arc properties, find state variables — all without opening the editor:

```sh
signalforge tree design.fig
signalforge find pathway.bio-path --type pathway_glyph --glyph macromolecule
signalforge find pathway.bio-path --arc inhibition
signalforge node design.fig --id 1:23
signalforge info design.fig
```

```
[0] [page] "JAK-STAT Signaling" (0:46566)
  [0] [compartment] "Cytoplasm" (0:46567)
    [0] [pathway_glyph:macromolecule] "JAK2" (0:46568)
    [0] [pathway_process:biochemical_reaction] "phosphorylation" (0:46569)
    [0] [pathway_arc:catalysis] → (0:46568→0:46569)
```

### Query with XPath

Use XPath selectors to find pathway elements and design nodes by type, attributes, and structure:

```sh
signalforge query pathway.bio-path "//PATHWAY_GLYPH[@glyphType='macromolecule']"
signalforge query pathway.bio-path "//PATHWAY_ARC[@arcType='inhibition']"
signalforge query pathway.bio-path "//COMPARTMENT//*[contains(@name, 'STAT')]"
signalforge query design.fig "//FRAME[@width < 300]"
signalforge query design.fig "//*[@cornerRadius > 0]"
```

### Export

Render pathways to publication-quality PNG, JPG, WEBP, SVG, PDF — or export selections/pages as `.fig`, SBGN-ML, `.bio-path`, or code:

```sh
signalforge export pathway.bio-path                           # PNG
signalforge export pathway.bio-path -f svg                    # Vector SVG
signalforge export pathway.bio-path -f pdf -s 2               # 2x PDF for publication
signalforge export pathway.bio-path -f sbgnml                 # SBGN-ML
signalforge export design.fig -f jsx --style tailwind         # Tailwind JSX
signalforge export design.fig -f html --html standalone       # Standalone HTML
signalforge convert pathway.sbgnml output.bio-path            # Convert between formats
signalforge import page.html --css styles.css -o page.fig     # HTML/CSS → editable .fig
```

### Validate pathways

Catch SBGN PD compliance issues, common AI hallucinations, and connection errors from the terminal:

```sh
signalforge pathway validate pathway.bio-path
signalforge pathway validate pathway.sbgnml --preset strict   # Full SBGN PD rules
signalforge pathway validate pathway.bio-path --list-rules
signalforge lint design.fig                                   # General design linting
```

### Analyze pathways & extract data

Audit a pathway's topology, glycophore distribution, and data overlays:

```sh
signalforge pathway analyze entities pathway.bio-path         # Glyph type histogram
signalforge pathway analyze connectivity pathway.bio-path     # In/out degree per node
signalforge pathway analyze compartments pathway.bio-path     # Compartment occupancy
signalforge analyze colors design.fig
signalforge analyze typography design.fig
signalforge variables design.fig
```

### Script with Figma Plugin API

`eval` gives you the full Figma Plugin API plus pathway extensions. Modify the file, write it back:

```sh
signalforge eval pathway.bio-path -c "figma.currentPage.children.filter(n => n.type === 'pathway_process').length"
signalforge eval pathway.bio-path -c "pathwayAutoLayout(figma.currentPage, {direction: 'top-to-bottom'})" -w
```

### Control the running app

When the desktop app is running, omit the file argument — the CLI connects via RPC and operates on the live canvas. Useful for automation scripts, AI agents, or embedding in analysis pipelines:

```sh
signalforge pathway validate                   # Validate current live pathway
signalforge export -f svg                      # Screenshot current canvas as SVG
signalforge eval -c "figma.currentPage.name"   # Query the editor
```

All commands support `--json` for machine-readable output.

## AI & MCP

### Built-in chat

Press <kbd>⌘</kbd><kbd>J</kbd> to open the AI assistant. It has 100+ general design tools plus the following pathway-specific tools:

| Pathway AI tool | What it does |
|-----------------|--------------|
| `create_pathway` | Create a new SBGN pathway diagram from a natural language description. The AI decomposes into compartments → entities → processes → arcs → labels and validates SBGN compliance before drawing. |
| `add_entity` | Add an SBGN entity (macromolecule, simple_chemical, complex, nucleic_acid_feature, perturbation, phenotype, source_sink) with label and compartment. |
| `add_process` | Add a process node (biochemical_reaction, transport, association, dissociation, omitted_process, uncertain_process). |
| `add_arc` | Add a typed arc between two glyphs (consumption, production, catalysis, inhibition, stimulation, necessary_stimulation, modulation, trigger, logic_gates). Validates SBGN source/target rules. |
| `add_compartment` | Add a compartment (membrane-bound region) and optionally move a set of entities into it. |
| `set_state_variable` | Add, update, or remove a state variable on an entity (e.g. phosphorylation at Y705, ubiquitination). |
| `set_unit_of_information` | Add a unit-of-information badge (species, location, tag). |
| `auto_layout_pathway` | Re-layout the current diagram. Modes: `flow-tb` (signal top→bottom), `flow-lr`, `compartment-first`, `orthogonal`. |
| `import_sbgn_ml` / `export_sbgn_ml` | Read/write SBGN-ML files with validation. |
| `query_pathway_db` | Query Reactome or Pathway Commons by keyword, gene symbol, or pathway ID and insert as a starter diagram. |
| `overlay_expression_data` | Load a CSV/TSV expression matrix and map values onto matching entities via color scale. |
| `validate_sbgn_pd` | Run the SBGN PD compliance validator and report all violations with suggested fixes. |

Bring your own API key. No backend, no account.

### Coding agents (desktop)

Use Claude Code, Codex, or Gemini CLI directly in the chat panel. The agent connects to the editor's MCP server and uses all 100+ tools (pathway + general design). Requires the desktop app and the agent CLI installed locally.

**Setup (Claude Code):**

1. Install the ACP adapter: `npm install -g @agentclientprotocol/claude-agent-acp`
2. Add MCP permission to `~/.claude/settings.json`:
   ```json
   {
     "permissions": {
       "allow": ["mcp__signal-forge__*"]
     }
   }
   ```
3. Open the desktop app → <kbd>Ctrl</kbd><kbd>J</kbd> → select **Claude Code** from the provider dropdown

### MCP server

Connect Claude Code, Cursor, Windsurf, or any MCP client to inspect, modify, validate, and export pathway documents headlessly. 100+ tools including pathway AI tools. [Full docs →](https://signalforge.dev/reference/mcp-tools)

**Stdio** (Claude Code, Cursor, Windsurf):

```sh
npm install -g @signal-forge/mcp
claude mcp add --scope user panxiangyu1995 -- signalforge-mcp
```

For other MCP clients:

```json
{
  "mcpServers": {
    "signal-forge": {
      "command": "signalforge-mcp"
    }
  }
}
```

**HTTP** (scripts, CI, analysis pipelines):

```sh
signalforge-mcp-http   # http://localhost:3100/mcp
```

**File access:** Set `OPENPENCIL_MCP_ROOT` to scope file operations (`open_file`, `new_document`, export `path` param) to a directory. Defaults to the current working directory.

### AI agent skill

Teach your AI coding agent to use SignalForge for pathway work — import SBGN-ML, overlay data, validate diagrams, modify .fig files headlessly:

```sh
npx skills add panxiangyu1995/skills@panxiangyu1995
```

Works with Claude Code, Cursor, Windsurf, Codex, and any agent that supports [skills](https://skills.sh).

For documentation-aware agents, the docs site publishes [llms.txt](https://signalforge.dev/llms.txt), [llms-full.txt](https://signalforge.dev/llms-full.txt), and per-page Markdown files generated from the VitePress docs.

## Pathway file formats

| Format | Extension | Description |
|--------|-----------|-------------|
| **SBGN-ML** | `.sbgnml`, `.xml` | Primary interoperability format. Full round-trip with Newt, CellDesigner, PathVisio, libSBGN. Validated against SBGN PD schema on every export. |
| **BioPath** | `.bio-path` | Native SignalForge pathway format. Extends the document model with pathway-specific fields (glyph types, arc types, state variables, compartment refs, data overlay configs). Always embeds a valid SBGN-ML subset so files can be opened by any SBGN tool. |
| **Figma** | `.fig` | Read/write native Figma files. Pathway glyphs/arcs live as first-class SceneNodes alongside frames and shapes. |
| **Pencil** | `.pen` | Supported Pencil document format. |
| **Import (planned)** | CellDesigner SBML (P1), GPML (P1), KGML (P2), BioPAX (P2) |

## Collaboration

Share a link to co-edit pathways in real time. No server, no account — peers connect directly via WebRTC.

1. Click the share button in the top-right panel
2. Share the generated link (`app.signalforge.dev/share/<room-id>`)
3. Collaborators see your cursor, selection, and edits in real time
4. Click a peer's avatar to follow their viewport

## Why

Traditional biological pathway editors (CellDesigner, PathVisio, Newt) are powerful but have steep learning curves, clunky UI, and zero AI integration. Drawing a clean, SBGN-compliant JAK-STAT diagram by hand takes an experienced researcher an hour. With SignalForge you type the sentence you'd put in a paper figure legend and get a publication-quality diagram in seconds, validated, with references pulled in automatically.

On the general design side, Figma is a closed platform that actively fights programmatic access. Their MCP server is read-only. Your design files are in a proprietary binary format. Your workflows break when they ship a point release.

SignalForge is the alternative on both fronts: open source (MIT), reads .fig files natively, reads/writes SBGN-ML natively, every operation (pathway + design) is scriptable via MCP/CLI, and your data never leaves your machine.

See the [roadmap](https://signalforge.dev/development/roadmap) for product direction, current SBGN feature coverage, and Figma compatibility gaps.

## Contributing

### Setup

```sh
bun install
bun run dev        # Dev server at localhost:1420
bun run tauri dev  # Desktop app (requires Rust)
```

### Quality gates

| Command | Description |
|---------|-------------|
| `bun run check` | Lint + typecheck + architecture checks |
| `bun run test` | E2E visual regression (Playwright) |
| `bun run test:unit` | Engine & unit tests — includes SBGN glyph rendering, arc routing, plugin data, SBGN-ML round-trip |
| `bun run format` | Code formatting |

### Project structure

```
packages/
  scene-graph/    @signal-forge/scene-graph — SceneGraph, pathway node types, copy/snap/undo, hit testing
  pen/            @signal-forge/pen — Pencil document format helpers
  kiwi/           @signal-forge/kiwi — Kiwi runtime and low-level .fig container parsing
  fig/            @signal-forge/fig — focused .fig package entrypoint
  core/           @signal-forge/core — editor engine, renderer, layout, tools, RPC, I/O
                  └── pathway/        ← SBGN glyph rendering, arc routing, pathway layout, AI tools, SBGN-ML I/O, validation
  dom-css/        @signal-forge/dom-css — HTML/CSS/Tailwind → editable design documents
  vue/            @signal-forge/vue — headless Vue SDK
  cli/            @signal-forge/cli — headless CLI (general + pathway subcommands)
  mcp/            @signal-forge/mcp — MCP server (stdio + HTTP)
  docs/           Documentation site (signalforge.dev)
src/              Vue app (editor shell, AI, collaboration, pathway session)
src/app/pathway/  Pathway editor session, Reactome/Pathway Commons integration, pathway I/O
src/components/pathway/  Glyph palette, arc type selector, glyph inspector, data overlay, compartment panel
desktop/          Tauri v2 desktop app (Rust + config)
tests/            E2E, visual, engine, and integration tests
```

Detailed pathway architecture conventions and SBGN implementation notes live in [AGENTS.md](AGENTS.md) (section *BioPath: SBGN Pathway Domain*).

### Tech stack

| Layer | Tech |
|-------|------|
| Rendering | Skia (CanvasKit WASM) |
| Layout | Yoga WASM (flex + grid via [fork](https://github.com/panxiangyu1995/yoga/tree/grid)) + pathway-specific layout (fCoSE-inspired, ELK.js planned) |
| UI | Vue 3, Reka UI, Tailwind CSS 4 |
| Pathway I/O | fast-xml-parser (SBGN-ML), libSBGN reference validation |
| Knowledge bases | Reactome Content Service API, Pathway Commons API |
| File formats | Kiwi binary + Zstd + ZIP (.fig), SBGN-ML XML, native .bio-path |
| Collaboration | Trystero (WebRTC P2P) + Yjs (CRDT) |
| Desktop | Tauri v2 |
| AI/MCP | Multi-provider (Anthropic, OpenAI, Google AI, OpenRouter), MCP SDK, Hono |

### Desktop builds

Requires [Rust](https://rustup.rs/) and platform-specific prerequisites ([Tauri v2 guide](https://v2.tauri.app/start/prerequisites/)).

```sh
bun run tauri build
```

## References

### SBGN standards & tools

| Project | Relevance |
|---------|-----------|
| **SBGN** | Core standard. SignalForge implements Process Description (PD) Level 1 Version 2.1. |
| **libSBGN** | Official C++/Java library — serialization reference. |
| **Newt** | Primary SBGN editor reference. SignalForge glyph rendering targets visual parity. |
| **sbgnviz.js** | Visualization engine behind Newt — canonical SBGN stylesheet reference. |
| **cytoscape-sbgn-stylesheet** | Direct reference for implementing SBGN glyphs in our Skia renderer. |
| **ELK.js** | Advanced layered/orthogonal layout — Phase 3 integration target. |

### BioPath / pathway knowledge

| Project | Relevance |
|---------|-----------|
| **Reactome** | Curated pathway knowledge base. SignalForge imports via Reactome Content Service. |
| **Pathway Commons** | Integrated pathway data aggregator. |
| **CellDesigner** | Most widely used SBGN PD editor — state variable notation reference. |
| **PathVisio** | Java pathway editor — data overlay (gene expression) UX reference. |

## Acknowledgments

Thanks to [@sld0Ant](https://github.com/sld0Ant) (Anton Soldatov) for creating and maintaining the [documentation site](https://signalforge.dev).

SBGN glyph rendering references the canonical stylesheets from [cytoscape-sbgn-stylesheet](https://github.com/PathwayCommons/cytoscape-sbgn-stylesheet) and [sbgnviz.js](https://github.com/iVis-at-Bilkent/sbgnviz.js).

## License

MIT
