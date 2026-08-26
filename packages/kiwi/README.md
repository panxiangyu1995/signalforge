# @signal-forge/kiwi

Scene-graph-agnostic Kiwi runtime utilities for OpenPencil.

This package owns pure Kiwi schema parsing, Figma Kiwi schema data, low-level Figma message encode/decode, FIG Kiwi container helpers, GUID formatting, and raw `.fig` parse helpers. `.fig` import/export policy stays in `@signal-forge/core`: SceneGraph conversion, raw metadata invalidation, component/instance interpretation, and app/CLI document I/O are not part of this package.

## Installation

```sh
bun add @signal-forge/kiwi
```

## Package-local checks

```sh
cd packages/kiwi
bun run check
```

Package scripts:

- `bun run test` — package-local Bun tests for schema runtime, Figma schema guards, codec, container, parse, GUID, and variable bindings
- `bun run typecheck` — type-checks `src`, tests, and package scripts
- `bun run build` — builds the distributable `dist` entrypoints
- `bun run smoke:dist` — imports built output and exercises the public API
- `bun run check` — runs typecheck, tests, build, and dist smoke in sequence

## Schema runtime

```ts
import { compileSchema, parseSchema, validateSchema } from '@signal-forge/kiwi/schema-runtime'

const schema = parseSchema(`
message Point {
  float x = 1;
  float y = 2;
}
`)

validateSchema(schema)
const codec = compileSchema(schema)
const bytes = codec.encodeMessage({ x: 12, y: 24 })
const point = codec.decodeMessage(bytes)
```

## Figma Kiwi codec

```ts
import { createNodeChangesMessage, encodeMessage, initCodec } from '@signal-forge/kiwi/fig/codec'

await initCodec()

const message = createNodeChangesMessage(1, 1, [
  {
    guid: { sessionID: 1, localID: 1 },
    phase: 'CREATED',
    type: 'RECTANGLE',
    name: 'Card',
    size: { x: 320, y: 180 }
  }
])

const bytes = encodeMessage(message)
```

Boolean operation payloads use Figma's Kiwi enum names. SceneGraph `EXCLUDE` is a core-level concept and should be serialized as Kiwi `XOR` before calling the low-level codec.

## FIG Kiwi containers

```ts
import { buildFigKiwi, parseFigKiwiChunks } from '@signal-forge/kiwi/fig/container'

const container = buildFigKiwi(new Uint8Array([1, 2, 3]))
const chunks = parseFigKiwiChunks(container)
```

## Raw `.fig` parsing

```ts
import { parseFigBytes } from '@signal-forge/kiwi/fig/parse'

const parsed = await parseFigBytes(await Bun.file('design.fig').arrayBuffer())

for (const canvas of parsed.canvases) {
  console.log(canvas.name, canvas.nodeChanges.length)
}
```

`parseFigBytes()` returns structural `NodeChange` data, blobs, images, schema bytes, and container metadata. Use `@signal-forge/core` for converting that data into an editable `SceneGraph`.

## GUID helpers

```ts
import { guidToString, stringToGuid } from '@signal-forge/kiwi/fig/guid'

const id = guidToString({ sessionID: 1, localID: 42 })
const guid = stringToGuid('1:42')
```

## Public subpaths

- `@signal-forge/kiwi`
- `@signal-forge/kiwi/schema-runtime`
- `@signal-forge/kiwi/fig`
- `@signal-forge/kiwi/fig/codec`
- `@signal-forge/kiwi/fig/container`
- `@signal-forge/kiwi/fig/guid`
- `@signal-forge/kiwi/fig/parse`

`@signal-forge/kiwi` must not import `@signal-forge/core`, `#core/*`, app code, Vue code, CLI code, or MCP code.
