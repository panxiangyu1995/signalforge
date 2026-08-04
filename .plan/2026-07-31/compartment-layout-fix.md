# Compartment 内节点布局修复 — DFS 遍历 + 绝对坐标转换

文件名：2026-07-31_compartment-layout-fix
创建于：2026-07-31
主分支：master
前置文档：`.plan/2026-07-27/sbgn-layout-arc-rewrite.md`

---

## 1. 目标与预期效果

### 目标

修复 `hierarchicalLayout` 无法正确布局 Compartment 内节点的问题，使 AI 生成的信号通路图中所有 EPN 和 Process 节点不再堆叠在 (0,0)，而是按 SBGN PD Process-centric DAG 规则分层排列。

### 预期效果

1. **所有节点正确布局**：Compartment 内的 EPN/Process 节点被 `collectPathwayGraph` 正确发现，参与分层和定位
2. **无堆叠**：`hierarchicalLayout` 返回 `{ positioned: N, layers: L }`，其中 N > 0、L > 0，所有节点按层排列、无重叠
3. **Compartment 包含关系正确**：EPN/Process 留在 Compartment 内，坐标为相对于 Compartment 的局部坐标
4. **Compartment 自动扩展**：`expandCompartments` 根据子节点位置正确计算 Compartment 大小
5. **弧线弯折点正确**：`computeOrthogonalBendPoints` 在布局后正确计算正交路由弯折点

---

## 2. 问题点

### 2.1 核心缺陷：`collectPathwayGraph` 单层遍历遗漏 Compartment 内节点

**位置**：`packages/core/src/pathway/layout/hierarchical.ts:29-42`

```typescript
for (const childId of page.childIds) {  // ← 只遍历 page 直接子节点
  const child = graph.getNode(childId)
  // ...
  if (child.type === 'PATHWAY_GLYPH') { ... }
  if (child.type === 'PATHWAY_PROCESS') { ... }
  if (child.type === 'COMPARTMENT') { ... }  // ← 收集了 Compartment，但不深入其子节点
}
```

**根因**：`page.childIds` 只包含 Compartment 节点，不包含 Compartment 内部的 EPN/Process 节点。AI 原子工具（`add_entity`/`add_process`）在指定 `compartment` 参数时，通过 `parent.appendChild(node)` 将节点放入 Compartment 内部，导致这些节点的 `parentId` 是 Compartment 而非 page。

**影响**：布局函数发现 0 个 EPN/Process → 返回 `{ positioned: 0, layers: 0 }` → 所有节点留在 (0,0) → 视觉上全部堆叠。

### 2.2 验证数据

通过集成测试（`tests/engine/coord-semantics.test.ts`）确认：

```
COMPARTMENT "Cytoplasm": local=(0,0) parentId=0:2 (page) childIds=["0:4"]
PATHWAY_GLYPH "JAK2": local=(0,0) parentId=0:3 (Compartment) childIds=[]
```

- Compartment 是 page 的直接子节点 ✓
- JAK2 是 Compartment 的子节点，不是 page 的子节点 ✗
- `page.childIds` 只有 Compartment，不包含 JAK2

### 2.3 同类正确实现

`collectPathwayArcs`（`packages/core/src/pathway/utils.ts:11-25`）使用 DFS 递归遍历，正确发现 Compartment 内的 PATHWAY_ARC 节点：

```typescript
const stack = [...page.childIds]
while (stack.length > 0) {
  const current = stack.pop()
  const node = graph.getNode(current)
  if (node.type === 'PATHWAY_ARC') arcs.push(node)
  stack.push(...node.childIds)  // ← 递归深入
}
```

### 2.4 Compartment 内节点坐标语义

SceneGraph 中 `node.x/y` 是**相对于父节点的局部坐标**。验证：

```
Compartment at local=(100,200), absPos=(100,200)
  JAK2 at local=(0,0), absPos=(100,200)  ← 子节点绝对位置 = 父绝对 + 子局部

设置 JAK2 local=(50,50) → absPos=(150,250)  ← 绝对 = 100+50, 200+50
设置 JAK2 local=(150,250) → absPos=(250,450)  ← 错误！这是把绝对坐标当局部坐标设了
```

**结论**：对 Compartment 内子节点调用 `graph.updateNode(id, { x, y })` 设置的是局部坐标。如果布局引擎计算出绝对坐标，必须减去 Compartment 的绝对位置才能得到正确的局部坐标。

---

## 3. 研究结果

### 3.1 SceneGraph 坐标系统

| 概念 | 含义 | 获取方式 |
|------|------|----------|
| 局部坐标 `node.x/y` | 节点相对于父节点的偏移 | 直接读取 `node.x`, `node.y` |
| 绝对坐标 | 节点相对于 page 根的偏移 | `graph.getAbsolutePosition(id)` |
| 转换公式 | `absX = Σ(ancestor.localX) + node.localX` | — |
| 逆转换 | `localX = absX - parentAbsX` | 需要先获取父节点绝对位置 |

**`getAbsolutePosition` 实现**：遍历父链累加局部平移，有缓存（`absPosCache`），`updateNode` 在影响布局属性变化时清除缓存。

### 3.2 Compartment 节点层级结构

AI 生成通路图的典型节点树：

```
PAGE (0:2)
├── COMPARTMENT "Cytoplasm" (0:3)
│   ├── PATHWAY_GLYPH "JAK2" (0:4)
│   ├── PATHWAY_GLYPH "STAT3" (0:5)
│   └── PATHWAY_PROCESS "reaction1" (0:6)
├── COMPARTMENT "Nucleus" (0:7)
│   └── PATHWAY_GLYPH "STAT3_p" (0:8)
└── PATHWAY_ARC "JAK2→reaction1" (0:9)
```

- `page.childIds` = [0:3, 0:7, 0:9]（Compartment + Arc）
- EPN/Process 是 Compartment 的子节点，对 `page.childIds` 不可见

### 3.3 `expandCompartments` 坐标依赖

当前 `expandCompartments`（`hierarchical.ts:342-376`）：

```typescript
for (const gcId of child.childIds) {
  const gc = graph.getNode(gcId)
  minX = Math.min(minX, gc.x - gc.width / 2)  // ← 读取 gc.x（局部坐标）
  // ...
}
graph.updateNode(child.id, {
  x: minX - padding,    // ← 设置 Compartment 局部坐标
  y: minY - padding,
  width: maxX - minX + padding * 2,
  height: maxY - minY + padding * 2
})
```

这里 `gc.x/y` 是相对于 Compartment 的局部坐标。如果子节点的局部坐标是正确的（在 Compartment 坐标空间内的偏移），则计算出的包围盒和 Compartment 位置也是正确的。

**关键约束**：`expandCompartments` 依赖子节点的局部坐标正确，而非绝对坐标。

### 3.4 `removeOverlaps` 坐标依赖

当前 `removeOverlaps`（`hierarchical.ts:303-340`）直接读取 `node.x/y`（局部坐标）来比较相邻节点位置。如果两个节点在不同 Compartment 内，它们的局部坐标可能相同（例如都在 (50, 50)），导致错误的重叠检测。

**但**：同一层内的节点通常属于同一 Compartment 或都是 page 级节点。在 Process-centric 布局中，Process 节点可能属于某个 Compartment，而 EPN 可能属于不同 Compartment。因此需要用绝对坐标来检测重叠。

### 3.5 `positionNodes` 坐标设置

当前 `positionNodes`（`hierarchical.ts:262-301`）用 `graph.updateNode(id, { x, y })` 设置坐标，设置的是局部坐标。如果节点在 Compartment 内，直接设置布局引擎计算出的绝对坐标会导致坐标偏移。

---

## 4. 设计方案

### 方案：DFS 递归遍历 + 绝对坐标布局 + 局部坐标转换

#### 核心思路

1. **收集阶段**：DFS 递归遍历发现所有节点（包括 Compartment 内的 EPN/Process），同时记录每个节点的 Compartment 归属
2. **布局阶段**：所有 EPN/Process 视为 page 级节点，用绝对坐标计算位置（忽略 Compartment 包含关系）
3. **转换阶段**：对 Compartment 内的子节点，将绝对坐标转换为相对于 Compartment 的局部坐标
4. **Compartment 扩展**：`expandCompartments` 读取子节点局部坐标计算包围盒，设置 Compartment 的绝对位置和大小

#### 4.1 详细算法

```
Phase 1: collectPathwayGraph（DFS 递归遍历）
  stack = [...page.childIds]
  while stack not empty:
    node = stack.pop()
    if PATHWAY_GLYPH or PATHWAY_PROCESS:
      nodes.set(id, { ..., compartmentId: parent.id if parent.type === 'COMPARTMENT' else null })
    if COMPARTMENT:
      nodes.set(id, { ..., type: 'compartment' })
    if PATHWAY_ARC:
      arcs.push(...)
    stack.push(...node.childIds)  // ← 递归深入

  输出: nodes Map（含 compartmentId 字段）, arcs, epnIds, processIds

Phase 2: positionNodes（绝对坐标布局）
  与现有逻辑相同：
  - 每层节点按实际尺寸排列
  - graph.updateNode(id, { x: absX, y: absY })
  - 此时所有节点被设置为绝对坐标
  - 对于 Compartment 内的子节点，这个坐标是错误的（应该是局部坐标）
  - 但在下一步转换之前，这个临时状态允许 removeOverlaps 用 getAbsolutePosition 正确比较

Phase 3: removeOverlaps（绝对坐标比较）
  - 使用 graph.getAbsolutePosition(id) 获取绝对坐标进行比较
  - 移动量 = 绝对坐标差值
  - 更新用 graph.updateNode(id, { x: ... }) 设置绝对坐标增量
  - 注意：updateNode 设置的是局部坐标，所以需要先读取当前局部坐标，加上增量

  实现：
    prevAbs = graph.getAbsolutePosition(ids[i-1])
    currAbs = graph.getAbsolutePosition(ids[i])
    overlap = prevAbs.x + prevWidth/2 + minGap - (currAbs.x - currWidth/2)
    if overlap > 0:
      currLocal = graph.getNode(ids[i])
      graph.updateNode(ids[i], { x: currLocal.x + overlap })

Phase 4: expandCompartments（基于绝对坐标计算 Compartment 位置和大小）
  对每个 Compartment:
    子节点绝对位置 = graph.getAbsolutePosition(gcId)
    计算 minX/maxX/minY/maxY（使用绝对坐标）
    设置 Compartment 的绝对坐标:
      compAbsX = minX - padding
      compAbsY = minY - padding
      compWidth = maxX - minX + padding * 2
      compHeight = maxY - minY + padding * 2
    
    Compartment 是 page 直接子节点，所以绝对坐标 = 局部坐标
    graph.updateNode(compId, { x: compAbsX, y: compAbsY, width: compWidth, height: compHeight })

Phase 5: convertToLocalCoords（绝对坐标 → 局部坐标）
  对每个 Compartment 内的子节点:
    compAbs = graph.getAbsolutePosition(compId)
    childAbs = graph.getAbsolutePosition(childId)  // ← 这是 positionNodes 设置的绝对坐标
    localX = childAbs.x - compAbs.x
    localY = childAbs.y - compAbs.y
    graph.updateNode(childId, { x: localX, y: localY })
  
  注意：此步骤必须在 expandCompartments 之后执行，因为 expandCompartments 改变了 Compartment 的位置，
  而 convertToLocalCoords 需要用 Compartment 的最终绝对位置来计算子节点的局部坐标。
```

#### 4.2 调用顺序

```
hierarchicalLayout():
  1. collectPathwayGraph(graph, pageId)    — DFS 收集所有节点
  2. buildAdjacency(arcs, nodes)            — 构建邻接表
  3. assignLayers(epnIds, processIds, ...)  — Process-centric 分层
  4. buildLayerArrays(layerMap, ...)        — 构建层数组
  5. barycenterOrder(layers, ...)           — 交叉最小化
  6. positionNodes(graph, layers, ...)      — 绝对坐标定位
  7. removeOverlaps(graph, layers, ...)     — 绝对坐标去重叠
  8. expandCompartments(graph, pageId)      — Compartment 位置/大小（用子节点绝对坐标）
  9. convertToLocalCoords(graph, pageId)    — 子节点绝对坐标→局部坐标
  10. return { positioned, layers }
```

---

## 5. 备选方案

### 备选 A：布局前 Reparent 到 page 根级，布局后 Reparent 回 Compartment

1. DFS 收集所有节点
2. 将 Compartment 内的子节点临时 reparent 到 page
3. 用绝对坐标布局（此时所有节点都在 page 根级，绝对坐标 = 局部坐标）
4. 布局完成后 reparent 回 Compartment（SceneGraph 自动处理坐标转换）
5. `expandCompartments`

**优点**：布局逻辑最简单，不需要手动转换坐标
**缺点**：
- Reparent 操作触发 SceneGraph 事件（虽然可 mute，但增加复杂度）
- SceneGraph 的 `appendChild`/`insertChild` 可能改变 `childIds` 顺序
- Reparent 后节点顺序改变可能影响其他观察者
- 需要记录原始 Compartment 归属关系

**评估**：改动中等，但 reparent 副作用不可控

### 备选 B：布局时使用局部坐标，但按 Compartment 分组布局

1. 按 Compartment 分组节点
2. 对每个 Compartment 内的节点组独立布局（局部坐标）
3. 然后对 Compartment 本身布局（绝对坐标）
4. 最后将 Compartment 内的局部坐标叠加上 Compartment 绝对位置

**优点**：Compartment 内节点天然使用局部坐标
**缺点**：
- 跨 Compartment 的弧线需要额外处理
- 同一 Compartment 内的 EPN 和 Process 与其他 Compartment 的节点有拓扑依赖
- 独立布局可能导致不同 Compartment 的布局方向不一致
- Process 可能连接不同 Compartment 的 EPN，无法简单分组

**评估**：跨 Compartment 拓扑依赖使分组布局不可行

### 方案选择理由

选择**方案（DFS + 绝对坐标布局 + 局部坐标转换）**：
1. 不需要 reparent，不触发 SceneGraph 事件
2. 布局逻辑保持简单（所有节点统一用绝对坐标计算）
3. 坐标转换仅在最后一步进行，逻辑清晰
4. 与 `collectPathwayArcs` 的 DFS 模式一致
5. `expandCompartments` 和 `convertToLocalCoords` 职责分离，易于测试

---

## 6. 实施清单

```
实施清单：

1. 修改 NodeInfo 接口，添加 compartmentId 字段
   文件：packages/core/src/pathway/layout/hierarchical.ts
   改动：
   - NodeInfo 添加 compartmentId: string | null
   - 供 positionNodes 和 convertToLocalCoords 使用

2. 重写 collectPathwayGraph 为 DFS 递归遍历
   文件：packages/core/src/pathway/layout/hierarchical.ts
   改动：
   - 将 for (childId of page.childIds) 改为 DFS stack 遍历
   - 深入 Compartment 子节点，收集 PATHWAY_GLYPH/PATHWAY_PROCESS
   - 记录每个 EPN/Process 的 compartmentId（如果父节点是 COMPARTMENT）
   - Compartment 本身也收集到 nodes Map 中
   - Arc 节点同样 DFS 发现

3. 修改 positionNodes：统一用绝对坐标设置
   文件：packages/core/src/pathway/layout/hierarchical.ts
   改动：
   - 保持现有绝对坐标计算逻辑
   - graph.updateNode(id, { x: absX, y: absY }) 暂时用绝对坐标
   - 临时状态，后续步骤会转换

4. 修改 removeOverlaps：用绝对坐标比较和移动
   文件：packages/core/src/pathway/layout/hierarchical.ts
   改动：
   - 用 graph.getAbsolutePosition(id) 获取绝对坐标进行比较
   - 移动增量加到当前局部坐标上（因为 updateNode 设置的是局部坐标）
   - 具体实现：
     const currAbs = graph.getAbsolutePosition(ids[i])
     const prevAbs = graph.getAbsolutePosition(ids[i-1])
     // 计算 overlap（使用绝对坐标）
     const overlap = prevAbs.x + prevNode.width/2 + minGap - (currAbs.x - currNode.width/2)
     if (overlap > 0) {
       graph.updateNode(ids[i], { x: currNode.x + overlap })
     }

5. 修改 expandCompartments：用子节点绝对坐标计算 Compartment 位置
   文件：packages/core/src/pathway/layout/hierarchical.ts
   改动：
   - 遍历 page 直接子节点中的 Compartment（保持现有遍历方式）
   - 子节点位置用 graph.getAbsolutePosition(gcId) 获取绝对坐标
   - 计算 Compartment 的绝对位置和大小
   - Compartment 是 page 直接子节点，绝对坐标 = 局部坐标
   - graph.updateNode(compId, { x: absX, y: absY, width, height })

6. 新增 convertToLocalCoords 函数
   文件：packages/core/src/pathway/layout/hierarchical.ts
   改动：
   - 遍历所有 Compartment 内的子节点
   - childAbs = graph.getAbsolutePosition(childId)
   - compAbs = graph.getAbsolutePosition(compId)
   - localX = childAbs.x - compAbs.x
   - localY = childAbs.y - compAbs.y
   - graph.updateNode(childId, { x: localX, y: localY })

7. 修改 hierarchicalLayout 主函数调用顺序
   文件：packages/core/src/pathway/layout/hierarchical.ts
   改动：
   - collectPathwayGraph → buildAdjacency → assignLayers → buildLayerArrays
     → barycenterOrder → positionNodes → removeOverlaps
     → expandCompartments → convertToLocalCoords
   - 在 expandCompartments 后调用 convertToLocalCoords

8. 运行集成测试验证
   - 使用 FigmaAPI + 原子工具创建 JAK-STAT 通路（含 Compartment）
   - 调用 hierarchicalLayout
   - 验证：所有节点 positioned > 0, layers > 0
   - 验证：EPN/Process 不在 (0,0)
   - 验证：Compartment 内子节点局部坐标正确
   - 验证：graph.getAbsolutePosition 返回正确的绝对位置

9. 运行 bun run check 验证 lint + 类型检查通过

10. 清理临时测试文件（tests/engine/coord-semantics.test.ts）
```

---

## 7. 涉及文件

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `packages/core/src/pathway/layout/hierarchical.ts` | 修改 | DFS 遍历 + 绝对坐标布局 + 局部坐标转换 |

其他文件不需要修改：
- `orthogonal.ts` — 使用 `graph.getAbsolutePosition` 计算端口，已正确处理坐标
- `arcs.ts` — 使用绝对坐标绘制，不受 Compartment 内局部坐标影响
- `render.ts` — 使用 `graph.getAbsolutePosition` 渲染，已正确
- `create.ts` — 调用 `hierarchicalLayout`，不需要改动
- `src/app/ai/tools/index.ts` — 已在上一轮修改中添加 `hierarchicalLayout` + `computeOrthogonalBendPoints` 调用

---

## 8. 风险与缓解

| 风险 | 缓解 |
|------|------|
| `getAbsolutePosition` 缓存在 `updateNode` 后清除，多次调用性能 | `removeOverlaps` 中缓存绝对位置到本地 Map，避免重复计算 |
| `expandCompartments` 改变 Compartment 位置后，`convertToLocalCoords` 依赖新位置 | `convertToLocalCoords` 在 `expandCompartments` 之后调用，`getAbsolutePosition` 会重新计算（缓存已清除） |
| Compartment 无子节点时跳过扩展 | 现有逻辑已处理：`if (child.childIds.length === 0) continue` |
| 无 Compartment 的通路图（所有 EPN/Process 在 page 根级） | `convertToLocalCoords` 遍历 Compartment，无 Compartment 则无操作；`positionNodes`/`removeOverlaps` 行为不变（绝对坐标 = 局部坐标） |
| Compartment 内子节点也有子节点（嵌套 Compartment） | DFS 会递归发现，`convertToLocalCoords` 只处理直接 Compartment 子节点的坐标转换。嵌套 Compartment 的外层 Compartment 位置由 `expandCompartments` 确定，内层子节点在 `convertToLocalCoords` 中转换 |

---

## 9. 测试策略

### 9.1 单元测试

使用 `FigmaAPI` + `BIOPATH_CORE_TOOLS` 创建测试场景：

1. **基础 Compartment 布局**：1 个 Compartment + 2 个 EPN + 1 个 Process + 3 条弧
   - 验证 `hierarchicalLayout` 返回 `{ positioned: 3, layers: 2+ }`
   - 验证所有节点 `getAbsolutePosition` 不在 (0,0)
   - 验证 Compartment 内子节点局部坐标正确

2. **多 Compartment 布局**：2 个 Compartment + 跨 Compartment 弧
   - 验证跨 Compartment 弧的端口和弯折点正确

3. **无 Compartment 布局**：所有 EPN/Process 在 page 根级
   - 验证行为与之前相同（绝对坐标 = 局部坐标）

4. **空 Compartment**：1 个 Compartment 无子节点
   - 验证 `expandCompartments` 跳过空 Compartment

### 9.2 集成测试

在浏览器中用 AI chat 画 JAK-STAT 通路图，验证：
- 所有实体不堆叠
- Process 在 EPN 之间
- 弧线有弯折点和正确装饰
- Compartment 自动扩展包含子节点
