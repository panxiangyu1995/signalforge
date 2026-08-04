# BioPath create_pathway 卡死问题修复方案 — 从单次大 JSON 调用到原子工具批量构建

> 日期: 2026-07-27
> 状态: 待实施
> 前置文档: biopath-visual-quality-optimization.md (2026-07-24), biopath-prd.md
> 触发: 多次修复后 `create_pathway` 仍然导致浏览器完全卡死，页面无响应，只能刷新或关闭浏览器

---

## 一、目标与预期效果

### 目的

彻底修复 AI 通过 `create_pathway` 工具创建信号通路图时浏览器卡死的问题。此前已实施过批量事件系统（`muteEvents`/`unmuteEvents`）和 AI dev-log 诊断系统，但卡死仍然发生。

### 预期效果

1. **不再卡死**：AI 创建包含 20-40 个节点的复杂通路图时，浏览器全程保持响应，用户可正常交互
2. **渐进式构建**：用户能在 Chat 面板看到 AI 逐步调用 `add_compartment` → `add_entity` → `add_process` → `add_arc` 的过程，而非等待一个巨大的 `create_pathway` 调用
3. **批量优化**：连续的原子工具调用只触发一次 `ensureGraphFonts` + `computeAllLayouts` + `snapshotPage` + `pushUndoEntry`，避免 N 次 post-processing 开销
4. **向后兼容**：保留 `create_pathway` 用于 ≤5 节点的简单通路，复杂通路由 AI 自动选择原子工具模式
5. **Step budget 充足**：从 50 步提升到 100 步，容纳原子工具的多次调用

---

## 二、问题点

### 2.1 核心症状

用户在 Chat 中要求画一个常见的信号通路图（如 JAK-STAT），AI 调用 `create_pathway` 时：
- 浏览器完全冻结，页面无任何响应
- 点击、滚动、切换 tab 均无效
- 只能刷新页面或关闭浏览器
- 此问题在多次"修复"后仍然存在

### 2.2 之前修复的尝试

1. **批量事件系统**（`SceneGraph.muteEvents()`/`unmuteEvents()`）：抑制 `create_pathway` 内部 `createNode` 触发的 `node:created` 事件风暴 → 未解决
2. **`FigmaAPI.beginBatch()`/`endBatch()`**：包裹 `create_pathway` 的 execute → 未解决
3. **`precomputeLayout()`**：预先计算节点位置避免 (0,0) 堆叠 → 未解决
4. **AI dev-log 系统**：添加诊断日志 → 确认了 execute 本身执行很快，卡死不在 execute 阶段

### 2.3 Reactome API 字段映射错误（附带问题）

`query_pathway_db` 工具返回空对象 `[{},{},...]`，因为 Reactome API 实际响应格式与代码中的字段映射不匹配：
- `searchPathways`：响应结构是 `results[].entries[]`（非 `results[]`），`name` 含 HTML `<span class="highlighting">` 标签，`species` 是数组而非字符串
- `findPathwaysByGene`：使用 `displayName`（string）和 `speciesName`（string），而非 `name`（array）和 `species`（string）

> 已在本次研究前修复，详见 reactome.ts 变更。

---

## 三、研究结果 — 根因定位

### 3.1 卡死发生在 AI 流式生成参数阶段，非工具执行阶段

通过系统性追踪 `create_pathway` 的完整执行路径（AI 生成参数 → tool execute → onAfterExecute → 渲染），确认卡死发生在 **AI 模型流式生成 `create_pathway` 的 JSON 字符串参数期间**，而非 execute 函数执行期间。

### 3.2 卡死机制 — O(N²) streaming 更新风暴

AI SDK（`ai@6.0.174`）的 UIMessage stream 处理逻辑（`node_modules/ai/dist/index.mjs` 第 5597-5630 行）：

每收到一个 `tool-input-delta` chunk（即 AI 模型输出的每个 token），执行以下操作：

```
case "tool-input-delta":
  1. partialToolCall.text += chunk.inputTextDelta     // 追加 token 到累积字符串
  2. await parsePartialJson(partialToolCall.text)      // 解析部分 JSON（O(N) 遍历整个字符串）
  3. updateToolPart({ input: partialArgs, ... })       // 更新 Vue reactive 状态
  4. write()                                            // 触发 UI 写入
```

`parsePartialJson`（第 3323 行）内部：
1. `safeParseJSON({ text: jsonText })` — 尝试 `JSON.parse`（失败，因为 JSON 不完整）
2. `safeParseJSON({ text: fixJson(jsonText) })` — 调用 `fixJson`（状态机遍历整个字符串修复不完整 JSON）

`fixJson`（第 3005 行）是一个逐字符遍历的状态机，对每个 token 累积的完整字符串做 O(N) 遍历。

**总工作量**：若 AI 生成 N 个 token 的参数，第 i 个 token 触发 O(i) 的 `fixJson` 遍历，总工作量 = O(1 + 2 + ... + N) = **O(N²)**。

对于 JAK-STAT 示例（4 个 JSON 数组参数，~2000 token）：
- ~2000 次 `parsePartialJson` + `fixJson` 调用
- ~2000 次 Vue reactive 更新（`updateToolPart`）
- ~2000 次 ChatMessage 组件重渲染（`input-streaming` 状态）
- 每次渲染中 `JSON.stringify(part.output, null, 2)` 格式化部分解析结果

**这完全阻塞了主线程**：rAF 无法执行 → Canvas 不渲染 → 事件循环阻塞 → 点击/交互无响应。

### 3.3 为什么之前的修复无效

之前的修复（批量事件系统、beginBatch/endBatch、precomputeLayout）都针对 **execute 函数内部** 的事件风暴和性能问题。但卡死发生在 execute **之前** 的 AI 参数 streaming 阶段，这些修复完全不影响 streaming 阶段。

### 3.4 次要因素（非卡死根因，但影响性能）

1. **`onAfterExecute` 中的同步操作**：`computeAllLayouts`（遍历整棵树）、`snapshotPage`（`structuredClone` 所有节点 ×2 次：before + after）、`requestRender` — 这些在 execute 完成后同步执行，总耗时 < 100ms，不是卡死原因
2. **`makeFigmaFromStore` 每次创建新 FigmaAPI 实例**：`getFigma()` 在 `ai-adapter.ts` 中被调用两次（第 170 行和第 178 行），每次创建新实例。但 FigmaAPI 构造函数很轻量，不影响性能
3. **批量事件系统工作正常**：`muteEvents`/`unmuteEvents` 正确抑制了 `create_pathway` 内部的事件风暴，`batch:completed` 事件正确触发了一次 `requestRender`

### 3.5 验证方法

在浏览器 DevTools Performance 面板中，卡死期间应能看到：
- 大量 `parsePartialJson` / `fixJson` 调用（CPU 主要消耗）
- 大量 Vue 组件更新（ChatMessage 的 `input-streaming` 重渲染）
- 主线程 100% 占用，无 rAF 回调执行

---

## 四、代码实际情况

### 4.1 关键文件与执行路径

```
用户发送消息
  ↓
src/app/ai/chat/transports.ts
  createToolLoopTransport() → ToolLoopAgent + DirectChatTransport
  ↓
AI SDK stream (node_modules/ai/dist/index.mjs)
  AI 模型流式输出 tool-call 参数
  每个 token → parsePartialJson + updateToolPart + write()  ← 卡死在此处
  参数完整后 → executeToolCall()
  ↓
packages/core/src/tools/ai-adapter.ts
  execute: async (args) => {
    onBeforeExecute(def)        ← snapshotPage (同步)
    await def.execute(figma, args)  ← create_pathway 同步执行
    onAfterExecute(def)         ← ensureGraphFonts + computeAllLayouts + requestRender + snapshotPage + pushUndoEntry
  }
  ↓
packages/core/src/tools/pathway/create.ts
  execute: (figma, args) => {   ← 同步函数
    JSON.parse(args.compartments) / args.entities / args.processes / args.arcs
    precomputeLayout(compartments, entities, processes, arcs)
    figma.beginBatch()           → graph.muteEvents()
    创建所有节点 (事件被抑制)
    figma.endBatch()             → graph.unmuteEvents() → batch:completed → requestRender()
    返回结果
  }
  ↓
packages/core/src/canvas/renderer/pipeline.ts
  render() → recordScenePicture() / renderPathwayPageChildren()  ← 通过 rAF 调度
```

### 4.2 `create_pathway` 参数定义（问题根源）

```typescript
// packages/core/src/tools/pathway/create.ts
params: {
  compartments: { type: 'string', description: 'JSON array of compartment specs: [{name, x?, y?, width?, height?}]', required: true },
  entities:     { type: 'string', description: 'JSON array of entity specs: [...]', required: true },
  processes:    { type: 'string', description: 'JSON array of process specs: [...]', required: true },
  arcs:         { type: 'string', description: 'JSON array of arc specs: [...]', required: true }
}
```

4 个 `type: 'string'` 参数，AI 需要生成 4 个 JSON 数组字符串。对于 JAK-STAT 示例，总计约 2000 token。

### 4.3 AI SDK streaming 处理（卡死机制）

```javascript
// node_modules/ai/dist/index.mjs 第 5597-5630 行
case "tool-input-delta":
  partialToolCall.text += chunk.inputTextDelta;        // 追加 token
  const { value: partialArgs } = await parsePartialJson(partialToolCall.text);  // O(N) 解析
  updateToolPart({                                      // Vue reactive 更新
    toolCallId: chunk.toolCallId,
    toolName: partialToolCall.toolName,
    state: "input-streaming",
    input: partialArgs,
  });
  write();                                              // UI 写入
  break;
```

```javascript
// node_modules/ai/dist/index.mjs 第 3323-3335 行
async function parsePartialJson(jsonText) {
  let result = await safeParseJSON({ text: jsonText });     // 失败（JSON 不完整）
  if (result.success) return { value: result.value, state: "successful-parse" };
  result = await safeParseJSON({ text: fixJson(jsonText) }); // fixJson: O(N) 状态机遍历
  if (result.success) return { value: result.value, state: "repaired-parse" };
  return { value: void 0, state: "failed-parse" };
}
```

### 4.4 ChatMessage UI 渲染

```vue
<!-- src/components/chat/ChatMessage.vue 第 92-98 行 -->
<CollapsibleContent v-if="toolState(part) !== 'pending'">
  <pre>{{ JSON.stringify(part.output, null, 2) }}</pre>
</CollapsibleContent>
```

`input-streaming` 状态下 `toolState(part)` 返回 `'pending'`，所以 CollapsibleContent 不显示。但 `updateToolPart` 仍然触发 Vue reactive 更新，ChatMessage 组件的 `v-for` 模板重新求值。

### 4.5 现有批量事件系统（工作正常，非问题）

```typescript
// packages/core/src/figma-api/index.ts
beginBatch(): void {
  this._batchDepth++
  this.graph.muteEvents()
}
endBatch(): void {
  if (this._batchDepth <= 0) return
  this._batchDepth--
  this.graph.unmuteEvents()  // 触发 batch:completed 事件
}
```

```typescript
// packages/scene-graph/src/index.ts
unmuteEvents(): void {
  if (this._eventsMuted <= 0) return
  this._eventsMuted--
  if (this._eventsMuted === 0) {
    this.emitter.emit('batch:completed')  // 只触发一次
  }
}
```

```typescript
// packages/core/src/editor/graph-events.ts
batchCompleted: () => {
  options.requestRender()  // 只调用一次
}
```

### 4.6 `onAfterExecute` 中的 post-processing

```typescript
// src/app/ai/tools/index.ts
onAfterExecute: async (def) => {
  if (def.mutates) {
    await ensureGraphFonts(store.graph, pageNode.childIds)  // async, 但 pathway 无 TEXT 节点，很快
    computeAllLayouts(store.graph, pageId)                   // 同步，遍历整棵树
    store.requestRender()                                    // 同步，递增 sceneVersion
    const after = store.snapshotPage()                       // 同步，structuredClone 所有节点
    store.pushUndoEntry({                                    // 同步
      label: `AI: ${def.name}`,
      forward: () => store.restorePageFromSnapshot(after),
      inverse: () => store.restorePageFromSnapshot(before)
    })
  }
}
```

---

## 五、设计方案

### 5.1 核心思路 — 拆分为原子工具 + 批量控制

将 `create_pathway`（单次大 JSON 参数）拆分为 6 个工具：

| 工具 | 参数 | 说明 |
|------|------|------|
| `begin_pathway` | 无 | 开启批量模式：muteEvents + 保存 undo 基线快照 |
| `add_compartment` | `name: string` | 创建单个 compartment |
| `add_entity` | `name, glyph_type, compartment?, state_variables?, clone_marker?` | 创建单个 entity |
| `add_process` | `name, process_type, compartment?` | 创建单个 process |
| `add_arc` | `source, target, arc_type` | 创建单条 arc（按名称查找节点） |
| `end_pathway` | 无 | 关闭批量模式：unmuteEvents + 执行一次完整 post-processing |

每个工具的参数 < 100 token，彻底消除大 JSON streaming 的 O(N²) 问题。

### 5.2 批量优化 — 只做一次 post-processing

`begin_pathway` → `add_*` × N → `end_pathway` 模式下：

- `begin_pathway` 的 `onBeforeExecute`：保存 `batchBeforeSnapshot`（undo 基线）
- `begin_pathway` 的 `onAfterExecute`：**跳过**（`pathwayBatch = true`）
- `add_*` 的 `onBeforeExecute`：**跳过**（`pathwayBatch = true`）
- `add_*` 的 `onAfterExecute`：**跳过**（`pathwayBatch = true`）
- `end_pathway` 的 execute：`figma.endPathwayBatch()`（`pathwayBatch = false`）
- `end_pathway` 的 `onAfterExecute`：执行一次 `ensureGraphFonts` + `computeAllLayouts` + `requestRender` + `snapshotPage` + `pushUndoEntry`（使用 `batchBeforeSnapshot` 作为 before）

### 5.3 `add_arc` 的名称→ID 查找

`create_pathway` 通过内部 `nameToId` Map 维护名称到 ID 的映射。原子工具模式下，每次 `add_arc` 调用是独立的，需要从 graph 中按名称查找节点：

```typescript
function findNodeIdByName(figma: FigmaAPI, name: string): string | null {
  const pageId = figma.currentPageId
  const pageNode = figma.graph.getNode(pageId)
  if (!pageNode) return null
  // 递归遍历 page 子节点（包括 compartment 内的子节点）
  const stack = [...pageNode.childIds]
  while (stack.length > 0) {
    const id = stack.pop()!
    const node = figma.graph.getNode(id)
    if (!node) continue
    if (node.name === name) return id
    stack.push(...node.childIds)
  }
  return null
}
```

### 5.4 保留 `create_pathway`

保留 `create_pathway` 但在 description 中标注"仅用于 ≤5 节点的简单通路"。AI 对复杂通路自动选择原子工具模式。

### 5.5 提升 step budget

从 50 步提升到 100 步，容纳原子工具的多次调用（JAK-STAT 示例约 30 次调用 = 30 步）。

---

## 六、备选方案

### 方案 B：参数从 JSON 字符串改为结构化对象

将 `compartments`/`entities`/`processes`/`arcs` 从 `type: 'string'` 改为嵌套对象数组类型，让 AI SDK 的 valibot schema 直接解析。

**否决理由**：当前 `ParamDef` 不支持嵌套对象数组类型。即使支持，AI SDK 的 `parsePartialJson` 仍然每个 token 触发，总 token 数不变，O(N²) 问题仍在。

### 方案 C：AI 侧分批调用 `create_pathway`

不改代码，只改 system prompt，指示 AI 每次只传 3-5 个实体。

**否决理由**：AI 可能不遵守指令；分批创建时后续批次不知道前面批次的节点 ID，无法正确连 arc；依赖 AI 行为，不可靠。

### 方案 D：Debounce Chat UI 的 tool-call 更新

在 ChatMessage 组件中对 `input-streaming` 状态做防抖/节流。

**否决理由**：需要侵入 AI SDK 的 UIMessage stream 逻辑（第三方代码）；`parsePartialJson` 的 CPU 开销仍在主线程；治标不治本。

### 方案 E（选中）：方案 A + 批量控制

拆分为原子工具 + `begin_pathway`/`end_pathway` 批量控制 + UI 优化 + step budget 提升。

**选中理由**：根治大参数 streaming 问题；批量优化避免 N 次 post-processing；渐进式构建改善用户体验；保留向后兼容。

---

## 七、实施清单

```
实施清单：
1. 在 packages/core/src/figma-api/index.ts 中新增 _pathwayBatch 标志、beginPathwayBatch()、endPathwayBatch()、get pathwayBatch()
2. 创建 packages/core/src/tools/pathway/add-compartment.ts — 定义 addCompartment 工具（参数: name, compartment_ref?）
3. 创建 packages/core/src/tools/pathway/add-entity.ts — 定义 addEntity 工具（参数: name, glyph_type, compartment?, state_variables?, clone_marker?）
4. 创建 packages/core/src/tools/pathway/add-process.ts — 定义 addProcess 工具（参数: name, process_type, compartment?）
5. 创建 packages/core/src/tools/pathway/add-arc.ts — 定义 addArc 工具（参数: source, target, arc_type），含 name→ID 查找逻辑
6. 创建 packages/core/src/tools/pathway/batch.ts — 定义 beginPathway 和 endPathway 工具
7. 在 packages/core/src/tools/pathway/ 的 registry/index 中注册 6 个新工具
8. 在 src/app/ai/tools/index.ts 中修改 onBeforeExecute/onAfterExecute 以支持 pathwayBatch 批量模式（batchBeforeSnapshot 逻辑）
9. 在 src/app/ai/tools/index.ts 中将 MAX_AGENT_STEPS 从 50 改为 100
10. 修改 packages/core/src/tools/pathway/create.ts 的 description，标注仅用于简单通路
11. 修改 src/app/ai/chat/system-prompt.md，更新 Construction Rules 和 Example 为原子工具模式
12. 运行 bun run check 验证类型正确性
```

---

## 八、风险与注意事项

1. **Step budget 消耗**：JAK-STAT 示例约 30 次原子工具调用 = 30 步。提升到 100 步后，复杂通路（50+ 节点）可能仍会触及上限。需要在 system prompt 中指导 AI 精简调用。
2. **`add_arc` 名称查找性能**：每次调用遍历 page 子节点，O(N)。对于 50 个节点的通路，50 次 `add_arc` = O(N²) = 2500 次查找。但每次查找 < 1ms，总耗时 < 2.5s，可接受。
3. **名称冲突**：AI 可能创建同名实体（如两个 "JAK2"）。`add_arc` 的名称查找会返回第一个匹配。需要在 `add_entity` 中检测重名并返回 warning。
4. **中途出错**：若 AI 在 `begin_pathway` 后出错（如 `add_entity` 参数错误），`pathwayBatch` 标志会保持 true，后续非 pathway 工具的 `onAfterExecute` 会被跳过。需要在错误处理中重置标志。
5. **Undo 粒度**：整个 `begin_pathway` → `end_pathway` 序列作为一个 undo 条目。用户 undo 会撤销整个通路创建，无法只撤销单个节点。
