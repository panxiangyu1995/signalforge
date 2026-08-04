# SBGN Process-centric 布局与弧线渲染重写

文件名：2026-07-27_sbgn-layout-arc-rewrite
创建于：2026-07-27
主分支：master

---

## 1. 目标与预期效果

### 目标

将 BioPath AI 生成的信号通路图从"实体堆叠、弧线画不出来"的状态，升级为 SBGN PD 标准合规的出版级通路图。

### 预期效果

1. **实体不堆叠**：EPN 和 Process 按 SBGN 语义分层排列，Process 位于其输入/输出 EPN 之间，同层节点按实际尺寸间距排列，无重叠
2. **弧线正确绘制**：所有 SBGN 弧类型（consumption/production/catalysis/inhibition/stimulation/necessary_stimulation/modulation/trigger/logic_and/logic_or/logic_not/equivalence）均有正确的装饰和方向
3. **正交路由**：弧线使用正交弯折（0-3 个弯折点），不穿越节点
4. **流向感知**：布局支持 top-bottom（信号级联）和 left-right（代谢通路）两种方向
5. **Compartment 包含**：实体正确包含在 Compartment 内，Compartment 自动扩展以适应子节点

---

## 2. 问题点

### 2.1 实体堆叠 — 5 个根因

| # | 根因 | 位置 | 影响 |
|---|------|------|------|
| 1 | BFS 分层不区分 EPN 和 Process | `hierarchical.ts:42-48` | EPN 和其连接的 Process 可能分到同一层，同行排列导致重叠 |
| 2 | 固定间距忽略节点实际尺寸 | `create.ts:131-133` `entityHorizontalSpacing=120` | 长标签 macromolecule 宽度 >120px 就重叠 |
| 3 | 无重叠检测/移除 | `hierarchical.ts` 全文 | 布局后没有 pass 检查并推开重叠节点 |
| 4 | Compartment 内实体用绝对定位 | `create.ts:194-202` `names.length * entityHorizontalSpacing` | 不考虑实际宽度 |
| 5 | `visited` Set 阻止重新分层 | `create.ts:86-94` | 节点一旦被访问，即使更长的路径能放到更好的层也不会重新评估 |

### 2.2 弧线画不出来 — 6 个根因

| # | 根因 | 位置 | 影响 |
|---|------|------|------|
| 1 | **end_pathway 后处理未调用布局** | `src/app/ai/tools/index.ts:129-161` | `onAfterExecute` 只调 `computeAllLayouts`（Yoga），不调 `hierarchicalLayout` + `computeOrthogonalBendPoints`，弯折点从未计算 |
| 2 | 弯折点坐标系不匹配 | `orthogonal.ts:45-48` vs `render.ts:189` | 弯折点存绝对坐标，但 `render.ts` 有 `canvas.translate(-node.x, -node.y)`，坐标空间错位 |
| 3 | 装饰方向用 source→target 向量 | `arcs.ts:343` | 有弯折点时应用最后一段方向，否则箭头/T-bar 朝向错误 |
| 4 | Consumption 弧画了实心圆点 | `arcs.ts:258-263` | SBGN 标准要求 consumption 无装饰（plain line） |
| 5 | 端口只有4个（缺 NE/SE/SW/NW） | `ports.ts:44-51` | 且无流向感知的端口选择 |
| 6 | Process 无专用端口布局 | `ports.ts:16-52` | Process 节点应区分输入侧/输出侧/调制侧端口 |

### 2.3 其他 SBGN 合规问题

| # | 问题 | 位置 | SBGN 标准 |
|---|------|------|-----------|
| 1 | Equivalence 弧双箭头都在 target 端 | `arcs.ts:225-229` | 应在 source 和 target 两端各一个箭头 |
| 2 | Logic 弧缺少文字标签 | `arcs.ts:264-278` | AND 应有 "AND" 标签，OR 应有 "OR" 标签 |
| 3 | Default case 画实心圆点 | `arcs.ts:282-286` | 未知弧类型应无装饰 |

---

## 3. 研究结果

### 3.1 SBGN PD 布局规范

- **Process-centric**：Process 节点是组织核心，每个弧连接 EPN↔Process（调制弧除外，EPN→Process）
- **信号流方向**：top-bottom 用于信号级联（受体在上，下游效应器在下），left-right 用于代谢通路
- **Process 位置不变量**：Process 必须在其输入 EPN 和输出 EPN 之间
- **Compartment**：大型圆角矩形包含 EPN/Process；可重叠（膜转运）；可嵌套（核在胞质内）
- **间距**：节点间最小 50-75px，弧线不应穿越字形

### 3.2 SBGN PD 弧线规范

| 弧类型 | 装饰 | 线型 | 方向 |
|--------|------|------|------|
| consumption | **无装饰**（plain line） | 实线 | EPN → Process |
| production | 实心三角箭头 | 实线 | Process → EPN |
| catalysis | 空心圆（on line） | 实线 | EPN → Process（调制） |
| inhibition | T-bar | 实线 | EPN → Process（调制） |
| stimulation | 空心三角 | 实线 | EPN → Process（调制） |
| necessary_stimulation | 实心三角 + T-bar | 实线 | EPN → Process（调制） |
| modulation | 空心菱形（on line） | 实线 | EPN → Process（调制） |
| trigger | 实心箭头 + T-bar | 实线 | EPN → Process（调制） |
| logic_and | 实心圆 + "AND" 标签 | 实线 | 逻辑弧 |
| logic_or | 空心圆 + "OR" 标签 | 实线 | 逻辑弧 |
| logic_not | T-bar | 实线 | 逻辑弧 |
| equivalence | 双端箭头 | 实线 | EPN ↔ EPN |

### 3.3 SBGN 端口规范

- 每个 glyph 有 **8 个端口**（N, NE, E, SE, S, SW, W, NW）
- Consumption/production 弧连接 Process 的**输入/输出侧**（top-bottom 时为 top/bottom）
- 调制弧连接 Process 的**调制侧**（top-bottom 时为 left/right）
- 端口选择应最小化弧线长度和交叉

### 3.4 参考实现

| 项目 | 布局方案 | 弧线方案 |
|------|----------|----------|
| **sbgnviz.js** | fCoSE force-directed + SBGN constraints | Cytoscape.js bezier/straight edges |
| **Newt** | fCoSE + compartment-aware | Cytoscape.js edge rendering |
| **cytoscape-sbgn-stylesheet** | N/A（仅样式） | CSS-like SBGN 视觉属性映射 |
| **CellDesigner** | 自动布局 + 手动调整 | 正交路由 |

---

## 4. 代码实际情况

### 4.1 当前文件结构与行数

| 文件 | 行数 | 核心函数 |
|------|------|----------|
| `packages/core/src/pathway/layout/hierarchical.ts` | 221 | `hierarchicalLayout()`, `barycenterOrder()`, `expandCompartments()` |
| `packages/core/src/pathway/layout/orthogonal.ts` | 115 | `computeOrthogonalBendPoints()`, `routeFromPorts()` |
| `packages/core/src/pathway/ports.ts` | 77 | `computePortPositions()`, `findNearestPort()` |
| `packages/core/src/pathway/arcs.ts` | 372 | `paintPathwayArc()`, `paintArcDecoration()`, 各种 paint* 函数 |
| `packages/core/src/pathway/render.ts` | 293 | `renderPathwayArc()` (line 174-192, 含 translate), `renderPathwayGlyph()`, `renderCompartment()` |
| `packages/core/src/tools/pathway/create.ts` | 434 | `createPathway`, `precomputeLayout()` |
| `packages/core/src/tools/pathway/layout.ts` | 42 | `autoLayoutPathway` tool |
| `packages/core/src/tools/pathway/modify.ts` | 312 | `addEntity`, `addProcess`, `addArc`, `addCompartment` |
| `packages/core/src/tools/pathway/batch.ts` | 29 | `beginPathway`, `endPathway` |
| `src/app/ai/tools/index.ts` | 182 | `onAfterExecute` (line 129-161) |

### 4.2 关键代码路径

**AI 画通路图的完整流程**：

```
用户输入 "画 JAK-STAT 通路"
  → AI 调用 begin_pathway
    → figma.beginPathwayBatch() (muteEvents)
  → AI 调用 add_compartment × N
  → AI 调用 add_entity × N
  → AI 调用 add_process × N
  → AI 调用 add_arc × N
  → AI 调用 end_pathway
    → figma.endPathwayBatch() (unmuteEvents)
    → onAfterExecute('end_pathway')
      → computeAllLayouts() ← 只做 Yoga flexbox，不做 SBGN 布局！
      → requestRender()
      → pushUndoEntry()
```

**问题**：`onAfterExecute` 中缺少 `hierarchicalLayout()` + `computeOrthogonalBendPoints()` 调用。

**弧线渲染流程**：

```
renderPathwayArc() (render.ts:174)
  → canvas.save()
  → canvas.translate(-node.x, -node.y)  ← 坐标偏移
  → paintPathwayArc() (arcs.ts:291)
    → 计算 sx/sy/tx/ty (绝对坐标)
    → directionVector(source, target)  ← 不考虑弯折点
    → 画线 (直线 or 弯折线)
    → paintArcDecoration()  ← 装饰方向可能错误
  → canvas.restore()
```

**问题**：
1. `translate(-node.x, -node.y)` 使弯折点坐标错位
2. `directionVector` 从 source→target 计算，不考虑弯折点
3. 弯折点从未被计算（`computeOrthogonalBendPoints` 未被调用）

### 4.3 当前端口系统

```typescript
// ports.ts — 只有4个端口
PortPosition.side: 'top' | 'right' | 'bottom' | 'left'
computePortPositions() → 4 ports (N/E/S/W)
findNearestPort(node, data, targetPoint) → 最近端口（无流向感知）
```

**缺失**：
- 无 NE/SE/SW/NW 对角端口
- Process 节点无专用端口布局（输入/输出/调制侧）
- 端口选择不考虑弧线角色（consumption 应选输入侧，production 应选输出侧）

---

## 5. 设计方案

### 方案：Process-centric DAG 布局 + 正交路由重写

#### 5.1 布局引擎（hierarchical.ts 重写）

**算法**：Process-centric 拓扑分层

```
Phase 1: 构建语义有向图
  - 从 arcs 构建 adjacency
  - 区分 EPN→Process 弧（consumption/modulation）和 Process→EPN 弧（production）
  - 调制弧（catalysis/inhibition/stimulation/necessary_stimulation/modulation/trigger）标记为 modulation

Phase 2: Process-centric 分层
  - 入度为 0 的 EPN → layer 0
  - EPN 的层 = min(其下游 Process 层) - 1
  - Process 的层 = max(其上游 EPN 层) + 1
  - 拓扑排序保证 Process 永远在输入/输出 EPN 之间
  - 调制弧不改变 EPN 的层（调制 EPN 与被调制 Process 在相邻层）

Phase 3: Barycenter 交叉最小化
  - 保留现有 3 轮 barycenter 排序
  - 同层内 EPN 和 Process 混合排序

Phase 4: 位置计算
  - 每层节点按实际尺寸排列
  - 间距 = max(spacing, maxNodeWidthInLayer + gap)
  - 方向感知（top-bottom / left-right）

Phase 5: 重叠移除
  - 扫描每层相邻节点，如果重叠则推开
  - 跨层检查：如果节点与相邻层的节点重叠，微调位置

Phase 6: Compartment 扩展
  - 保留现有 expandCompartments
  - 增加 compartment 间最小间距
```

**函数签名不变**：`hierarchicalLayout(graph, pageId, options?) → { positioned, layers }`

#### 5.2 端口系统（ports.ts 扩展）

```
PortPosition.side 扩展为:
  'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left' | 'top-left'

computePortPositions():
  - EPN: 8 端口（4 主 + 4 对角）
  - Process: 专用端口布局
    top-bottom 方向:
      输入侧: top-left, top, top-right (3 ports)
      输出侧: bottom-left, bottom, bottom-right (3 ports)
      调制侧: left, right (2 ports)
    left-right 方向:
      输入侧: top-left, left, bottom-left
      输出侧: top-right, right, bottom-right
      调制侧: top, bottom

findNearestPort(node, data, targetPoint, direction?, arcRole?):
  - arcRole: 'input' | 'output' | 'modulation'
  - Process 节点: 根据 arcRole 限制候选端口范围
  - EPN 节点: 全部 8 端口候选，选最近的
```

#### 5.3 正交路由（orthogonal.ts 修正）

```
computeOrthogonalBendPoints():
  - 调用 findNearestPort 时传入 direction + arcRole
  - arcRole 推导规则:
    consumption → source=output, target=input
    production → source=output, target=input
    catalysis/inhibition/stimulation/necessary_stimulation/modulation/trigger → source=output, target=modulation
    logic_* → 无特殊角色
    equivalence → source=output, target=output

routeFromPorts():
  - 支持 0-3 个弯折点
  - source/target 在同一行/列时直连
  - 退出段 + 入口段 + 中间弯折

弯折点坐标系:
  - 存储为绝对坐标
  - paintPathwayArc 中直接使用（移除 render.ts 的 translate）
```

#### 5.4 弧线渲染（arcs.ts 修正）

```
paintPathwayArc():
  - 移除 render.ts:189 的 canvas.translate(-node.x, -node.y)
  - 所有坐标在绝对空间工作
  - 装饰方向: 有弯折点时从最后弯折点→target 计算，无弯折点时从 source→target

paintArcDecoration():
  - consumption: break (无装饰)
  - equivalence: source 端也画箭头（方向 target→source）
  - default: break (无装饰)
```

#### 5.5 create.ts 重构

```
createPathway 执行流程:
  1. 解析 JSON 参数
  2. 创建所有 Compartment (位置 0,0)
  3. 创建所有 Entity (位置 0,0)
  4. 创建所有 Process (位置 0,0)
  5. 创建所有 Arc
  6. 调用 hierarchicalLayout() 计算位置
  7. 调用 computeOrthogonalBendPoints() 计算弯折点
  8. 返回结果

删除 precomputeLayout() 函数
```

#### 5.6 end_pathway 后处理

```
onAfterExecute('end_pathway'):
  1. hierarchicalLayout(figma.graph, pageId, { direction: 'top-bottom', spacing: 60 })
  2. computeOrthogonalBendPoints(figma.graph, pageId, 'top-bottom')
  3. computeAllLayouts(store.graph, pageId)  ← 保留（Yoga flexbox for non-pathway nodes）
  4. requestRender()
  5. pushUndoEntry()
```

---

## 6. 备选方案

### 备选 A：渐进式修补（在现有 BFS 上打补丁）

- 保留现有 `hierarchical.ts` BFS 分层
- 逐个修补：加重叠移除、修坐标系、修装饰方向
- **优点**：改动小，每步可验证
- **缺点**：BFS 分层从根本上不适合 SBGN Process-centric 拓扑，修补越多越脆弱；单弯折正交路由无法支持避让
- **评估**：治标不治本，P1 阶段会遇到天花板

### 备选 B：集成 fCoSE/ELK.js 外部布局引擎

- 用 cytoscape.js-fcose 或 ELK.js 做布局，注入 SBGN 约束
- **优点**：成熟算法，交叉最小化、正交路由开箱即用
- **缺点**：
  - 引入重依赖（cytoscape.js ~500KB 或 ELK.js ~1MB WASM）
  - fCoSE 不原生支持 SBGN Process-centric 约束
  - ELK.js 是 Java 移植，WASM 初始化慢
  - 与 CanvasKit 渲染管线集成复杂
  - PRD 规划 Phase 2 才引入 fCoSE，Phase 3 才引入 ELK.js
- **评估**：超出 Phase 1 范围，引入重依赖

### 方案选择理由

选择**方案（Process-centric DAG 重写）**：
1. 备选 A 治标不治本 — BFS 分层架构上不适合 SBGN
2. 备选 B 超出 Phase 1 范围，且引入重依赖
3. 方案改动量可控（~500 行修改/新增），不引入新依赖，与 PRD Phase 1 对齐
4. 从根本上解决 Process-centric 布局问题

---

## 7. 实施清单

```
实施清单：
1. 修改 ports.ts — 扩展 PortPosition.side 为8方向，computePortPositions 返回8端口 + Process 专用端口布局，findNearestPort 增加 direction/arcRole 参数
2. 修改 hierarchical.ts — 重写 hierarchicalLayout 为 Process-centric DAG 分层算法（EPN/Process 分类分层 + 拓扑排序 + 实际尺寸间距 + 重叠移除）
3. 修改 orthogonal.ts — routeFromPorts 支持多弯折，computeOrthogonalBendPoints 传入 direction/arcRole 给 findNearestPort
4. 修改 arcs.ts — consumption 无装饰，装饰方向从最后弯折点计算，equivalence 双端箭头，default case 无装饰
5. 修改 render.ts — 移除 renderPathwayArc 中的 canvas.translate(-node.x, -node.y)，让 paintPathwayArc 在绝对坐标系工作
6. 修改 create.ts — 重构 createPathway 执行流程：先创建节点(0,0) → 创建弧 → 调用 hierarchicalLayout + computeOrthogonalBendPoints，删除 precomputeLayout
7. 修改 src/app/ai/tools/index.ts — end_pathway 后处理增加 hierarchicalLayout + computeOrthogonalBendPoints 调用
8. 运行 bun run check 验证类型检查通过
9. 运行 bun run test:unit 验证现有测试通过
10. 手动测试：在浏览器中用 AI chat 画 JAK-STAT 通路图，验证实体不堆叠、弧线正确绘制
```

---

## 8. 涉及文件

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `packages/core/src/pathway/ports.ts` | 重写 | 8端口 + Process 专用端口 + 流向感知 |
| `packages/core/src/pathway/layout/hierarchical.ts` | 重写 | Process-centric DAG 分层 |
| `packages/core/src/pathway/layout/orthogonal.ts` | 修改 | 多弯折路由 + arcRole 传递 |
| `packages/core/src/pathway/arcs.ts` | 修改 | 装饰修正 + 方向修正 |
| `packages/core/src/pathway/render.ts` | 修改 | 移除 translate |
| `packages/core/src/tools/pathway/create.ts` | 重构 | 删除 precomputeLayout，改用布局引擎 |
| `src/app/ai/tools/index.ts` | 修改 | end_pathway 后处理增加布局调用 |

---

## 9. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 移除 translate 后其他渲染代码依赖该偏移 | 检查所有 `renderPathway*` 函数，确认只有 `renderPathwayArc` 使用 translate |
| Process-centric 分层对环形拓扑（反馈回路）处理 | 检测环并打断最长回边，保证 DAG 可分层 |
| 8端口改变现有弧线端口选择结果 | 新端口是超集，findNearestPort 仍选最近端口，行为兼容 |
| create.ts 删除 precomputeLayout 影响简单通路图 | 新流程先创建再布局，效果等价但更准确 |
