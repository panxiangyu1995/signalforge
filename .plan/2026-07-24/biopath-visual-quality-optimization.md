# BioPath 视觉质量优化方案 — 从"黑白扁平"到"拟物风格出版级通路图"

> 日期: 2026-07-24
> 状态: 待实施
> 前置文档: biopath-checklist.md, biopath-implementation.md, biopath-prd.md, biopath-refinement.md, biopath-visual-fidelity.md, biopath-visual-quality-optimization.md
> 触发: 首次在开发服务器中画信号通路图，发现布局错乱、细胞结构画得不像、黑白风格而非拟物风格

---

## 一、目标与预期效果

### 目的

将 BioPath AI 生成的信号通路图从"技术正确的 SBGN 灰色示意图"升级为"拟物风格出版级通路图"，使其视觉效果接近 CellDesigner / BioRender / Reactome 等专业工具的输出。

### 预期效果

1. **拟物风格渲染**：每个 glyph 类型有语义化渐变填充（蛋白质蓝色渐变、代谢物粉色渐变、DNA 绿色渐变、复合物紫色渐变），而非统一灰色
2. **深度感知**：实体有微妙投影（1-2px offset, 3px blur, 15% opacity），Compartment 有更大柔和阴影，形成前后层次
3. **细胞结构拟真**：Compartment 根据名称自动推断类型（细胞质/细胞核/膜等），渲染对应渐变背景；膜 Compartment 渲染脂质双层纹理线；核膜渲染双线+核孔间隙
4. **专业布局**：AI 创建通路图时自动计算初始位置（不再全部堆在 (0,0)）；层级布局使用重心排序减少交叉；弧线从端口出发正交路由
5. **正确 Z 序**：弧线在实体后面、装饰在实体前面、标签在最上层，不再出现 T-bar 被实体填充遮挡的问题
6. **完整视觉细节**：Multimer 堆叠幽灵、Active state 虚线扩展边框、Unit of Information badge 均正确渲染
7. **默认即出版级**：新建通路图默认使用 publication style，无需用户手动切换

---

## 二、问题点

### 2.1 黑白扁平风格

**现象**：AI 生成的通路图所有 glyph 都是 `#f6f6f6` 浅灰填充 + `#555` 深灰边框，无颜色区分，无渐变，无阴影，看起来像技术示意图而非生物学通路图。

**根因**：
- 渲染器默认 style 为 `'sbgn'`（`render.ts:22` 读取 `r.pathwayStyle`，默认 `'sbgn'`）
- `glyphs.ts:16` — `glyphFill()` 在 `'sbgn'` 模式下返回 `SBGN_STYLE.nodeBackgroundColor`（`#f6f6f6`）
- `PUBLICATION_STYLE` 虽然定义了语义颜色（`constants.ts:68-109`），但从未被默认激活
- `create_pathway` 工具（`create.ts`）创建节点后不调用 `set_pathway_style`
- **无渐变填充**：所有 glyph painter 使用 `fillPaint.setColor()` 纯色填充，无 `Shader.MakeLinearGradient()` 调用
- **无投影**：无 `ImageFilter.MakeDropShadow()` 调用
- **无膜线**：`paintMembraneLine()` 在 `biopath-visual-fidelity.md` 中有规格但从未实现
- **无 Multimer 幽灵**：`multimer` 字段存在于 `PathwayNodeData` 但无渲染逻辑
- **无 Active state 虚线**：`activeState` 字段存在但无渲染逻辑
- **无 Unit of Information badge**：`unitOfInformation` 字段存在但 `paintStateVariables()` 只处理 state variable

### 2.2 布局错乱

**现象**：AI 生成的通路图节点重叠、弧线交叉、信号流方向混乱、Compartment 不包含子节点。

**根因**：
- `create.ts:128-133` — 实体创建时 `x: spec.x ?? 0, y: spec.y ?? 0`，AI 不指定位置时所有节点堆在原点
- `hierarchical.ts` — 仅做简单 BFS 拓扑排序，无交叉最小化（barycenter heuristic），无节点排序优化
- `orthogonal.ts:29-34` — 弧线路由仅用中点 `(sx, midY)` 和 `(tx, midY)` 两个 bend point，无障碍物避让，无端口感知
- 无力导向精修步骤（force-directed refinement）
- Compartment 自动扩展（`expandCompartments`）在节点定位之后执行，但初始位置可能在 Compartment 外

### 2.3 细胞结构画得不像

**现象**：Compartment 看起来像普通矩形框，没有细胞结构的视觉特征（膜纹理、核孔、线粒体嵴等）。

**根因**：
- `render.ts:80-127` — Compartment 渲染为 barrel 形状（凹面侧边），但填充仅为 `rgba(0,0,0,0.03)` 或 `#f6f6f6`，无类型区分
- 无 Compartment 类型推断逻辑（不知道名称 "Cytoplasm" 对应什么颜色）
- 无膜线渲染（plasma membrane 脂质双层、nuclear membrane 双线+核孔）
- 无 Compartment 渐变背景

### 2.4 Z 序错误

**现象**：弧线被实体填充遮挡，T-bar 和 circle-on-line 装饰隐藏在目标节点后面。

**根因**：
- `scene.ts` 中 `renderNodeContent()` 按 SceneGraph child 顺序渲染，无多遍渲染
- `biopath-visual-fidelity.md` Part 2.6 明确要求 4-pass 渲染（arc→entity→decoration→label），但未实现
- 当前单遍渲染导致后创建的实体覆盖先创建的弧线

---

## 三、研究结果

### 3.1 SBGN 规范视觉参考（cytoscape-sbgn-stylesheet）

从 cytoscape-sbgn-stylesheet 源码提取的规范值：

| 属性 | 规范值 |
|------|--------|
| 默认节点填充 | `#f6f6f6` |
| 默认节点边框 | `#555`, 1.5px |
| 弧线颜色 | `#555`, 1.5px |
| Complex 边框 | `#555`, 4px |
| Compartment 边框 | `#555`, 4px (stroke 6px) |
| Association 填充 | `#6B6B6B`（实心） |
| Clone marker | `#838383` 填充, `#6A6A6A` 边框 1.5px |
| State variable badge | 白色填充, `#555` 边框 2px, 10px 字体 |
| Multimer ghost offset | 5-16px（按 glyph 类型不同） |
| Arrow scale | 1.75（stylesheet）/ 1.25（sbgnviz） |

### 3.2 出版级风格参考（BioRender / CellDesigner / Reactome）

**专业通路图 vs 业余通路图的核心差异**：

| 维度 | 专业 | 业余 |
|------|------|------|
| 填充 | 按 glyph 类型语义着色（蛋白质蓝、代谢物粉、DNA 绿） | 统一灰色 |
| 渐变 | 顶→底线性渐变（上浅下深，3D 体积感） | 纯色扁平 |
| 投影 | 1-2px offset, 2-3px blur, ~15% opacity | 无 |
| 边框 | 按类型着色（与填充同色系更深色） | 统一灰色 |
| 弧线颜色 | 激活蓝、抑制红、催化绿 | 统一灰色 |
| Compartment | 类型化半透明渐变背景 + 膜纹理 | 透明/浅灰 |
| 字体 | 白色光晕（0.75px outline）提升可读性 | 无光晕 |
| 边线 | 正交路由，端口出发 | 对角线，中心出发 |

### 3.3 渐变规格

每个 glyph 类型的顶→底线性渐变：

| Glyph 类型 | 顶部色 | 底部色 | 边框色 |
|------------|--------|--------|--------|
| macromolecule | `#D4E6F1` | `#A9CCE3` | `#5B9BD5` |
| simple_chemical | `#FADBD8` | `#F5B7B1` | `#E74C3C` |
| nucleic_acid_feature | `#D5F5E3` | `#ABEBC6` | `#27AE60` |
| complex | `#E8DAEF` | `#D2B4DE` | `#8E44AD` |
| perturbation | `#D1F2EB` | `#A3E4D7` | `#16A085` |
| phenotype | `#FEF9E7` | `#F9E79F` | `#F39C12` |
| source_sink | `#F2F3F4` | `#D5D8DC` | `#6A6A6A` |

### 3.4 投影规格

| 元素 | offset | blur | color |
|------|--------|------|-------|
| 实体 glyph | (1, 2) | 3 | `rgba(0,0,0,0.15)` |
| Compartment | (2, 4) | 8 | `rgba(0,0,0,0.08)` |

### 3.5 Compartment 类型化填充

| Compartment 类型 | 填充色（rgba） |
|------------------|----------------|
| extracellular | `rgba(173, 216, 230, 0.12)` |
| membrane | `rgba(255, 193, 7, 0.15)` |
| cytoplasm | `rgba(200, 230, 201, 0.10)` |
| nucleus | `rgba(206, 147, 216, 0.10)` |
| mitochondria | `rgba(255, 183, 77, 0.10)` |
| endoplasmic_reticulum | `rgba(129, 199, 132, 0.10)` |
| golgi | `rgba(255, 138, 101, 0.10)` |

### 3.6 膜线渲染规格

- **质膜（plasma）**：3px 粗线 + 每 8px 一个短垂直 tick（脂质双层纹理）
- **核膜（nuclear）**：双线 + 每 40px 间隙（核孔）
- **线粒体膜（mitochondrial）**：外膜平滑 + 内膜折叠（嵴状锯齿）

### 3.7 fCoSE 布局参数（SBGN 最佳实践）

```typescript
{
  nodeRepulsion: 4500,
  idealEdgeLength: 50,
  edgeElasticity: 0.45,
  nestingFactor: 0.1,
  gravity: 0.25,
  gravityRange: 3.8,
  gravityCompound: 1.0,
  gravityRangeCompound: 1.5,
  nodeSeparation: 75,
  padding: 30,
}
```

---

## 四、代码实际情况

### 4.1 当前渲染管线

```
renderNodeContent() [scene.ts]
  → 按 child 顺序遍历
  → PATHWAY_GLYPH: renderPathwayGlyph() [render.ts:14-37]
    → paintPathwayGlyph() [glyphs.ts:318-338]
      → glyphFill() 返回 #f6f6f6 或 PUBLICATION_STYLE.entityFills[type]
      → fillPaint.setColor(纯色) → canvas.drawPath()
      → strokePaint.setColor(纯色) → canvas.drawPath()
    → paintCloneMarker() [labels.ts]
    → paintPathwayLabel() [labels.ts]
    → paintStateVariables() [labels.ts]
  → PATHWAY_PROCESS: renderPathwayProcess() [render.ts:39-58]
  → PATHWAY_ARC: renderPathwayArc() [render.ts:60-78]
    → paintPathwayArc() [arcs.ts:291-372]
      → findNearestPort() 或 center fallback
      → canvas.drawLine() 或 bendPoints path
      → paintArcDecoration()
  → COMPARTMENT: renderCompartment() [render.ts:80-127]
    → barrel 形状 path
    → fillPaint.setAlphaf(0.15) → rgba(0,0,0,0.03)
    → strokePaint 4px
```

### 4.2 关键缺失项清单

| 缺失项 | 代码位置 | 规格文档位置 |
|--------|----------|-------------|
| 渐变填充 | `glyphs.ts` — 所有 painter 用 `setColor()` | visual-fidelity.md §2.1 |
| 投影 | `render.ts` — 无 `ImageFilter` 调用 | visual-fidelity.md §2.3 |
| 膜线渲染 | 不存在 | visual-fidelity.md §2.2 |
| Compartment 类型推断 | 不存在 | visual-fidelity.md §2.3 (本文档) |
| Compartment 渐变背景 | `render.ts:110-116` — 纯色 | visual-fidelity.md §2.3 |
| Multimer 幽灵渲染 | `glyphs.ts` — 无 multimer 分支 | visual-fidelity.md §1.5 |
| Active state 虚线 | 不存在 | visual-fidelity.md §1.5 |
| Unit of Information badge | `labels.ts` — `paintStateVariables()` 不处理 | visual-fidelity.md §1.5 |
| Z 序多遍渲染 | `scene.ts` — 单遍 child 顺序 | visual-fidelity.md §2.6 |
| 智能初始定位 | `create.ts` — `x:0, y:0` 默认 | §3.1 (本文档) |
| 重心排序 | `hierarchical.ts` — 无 | visual-fidelity.md §3.1 |
| 端口感知路由 | `orthogonal.ts` — 中点路由 | visual-fidelity.md §3.2 |
| 力导向精修 | 不存在 | visual-fidelity.md §3.1 |
| 默认 publication style | `render.ts` — 默认 `'sbgn'` | refinement.md §R8 |

### 4.3 已实现但需修改的代码

| 文件 | 行数 | 当前行为 | 需修改为 |
|------|------|----------|----------|
| `constants.ts` | 68-109 | PUBLICATION_STYLE 只有扁平纯色 | 增加 entityGradients、dropShadow、compartmentShadow |
| `glyphs.ts` | 11-25 | `glyphFill()` 返回纯色 Float32Array | 返回渐变 Shader 或纯色 |
| `glyphs.ts` | 33-338 | 8 个 painter 全部 `fillPaint.setColor()` | publication 模式用 `fillPaint.setShader(gradient)` |
| `render.ts` | 14-37 | 无投影 | publication 模式加 `ImageFilter.MakeDropShadow()` |
| `render.ts` | 80-127 | Compartment 纯色填充 | 类型推断 + 渐变 + 膜线 |
| `render.ts` | 全文 | 单遍渲染 | 检测 pathway 页面时 4-pass 渲染 |
| `create.ts` | 128-133 | `x:0, y:0` 默认 | 预计算布局位置 |
| `hierarchical.ts` | 82-117 | 无序排列 | barycenter 排序 |
| `orthogonal.ts` | 29-34 | 中点路由 | 端口感知正交路由 |

---

## 五、设计方案

### V1: 默认 Publication Style + 渐变填充 + 投影

**核心思路**：将渲染默认从 `'sbgn'`（灰色规范模式）切换为 `'publication'`（拟物出版模式），并在 publication 模式下为每个 glyph 添加顶→底线性渐变和微妙投影。

**修改点**：
1. `constants.ts` — 新增 `entityGradients`（每类型 top/bottom 色）、`dropShadow`、`compartmentShadow`
2. `glyphs.ts` — 新增 `glyphFillShader()` 函数，publication 模式返回 `Shader.MakeLinearGradient()`；每个 painter 改用 `fillPaint.setShader()` → draw → `setShader(null)`
3. `render.ts` — publication 模式下在 paint 前设置 `ImageFilter.MakeDropShadow()`，paint 后清除
4. `create.ts` — 创建完节点后自动调用 `figma.setPathwayStyle('publication')`
5. 渲染器默认值 — `pathwayStyle` 默认从 `'sbgn'` 改为 `'publication'`

### V2: Compartment 视觉升级

**核心思路**：Compartment 根据名称自动推断生物学类型，渲染对应渐变背景和膜结构纹理线。

**修改点**：
1. `constants.ts` — `compartmentFills` 已有类型化 rgba，需增加渐变版本
2. 新建 `membrane.ts` — `paintMembraneLine(ck, canvas, compartment, membraneType)` 实现三种膜线
3. `render.ts` `renderCompartment()` — 调用 `inferCompartmentType(node.name)` 获取类型 → 渐变填充 → 膜线 → 投影
4. 新增 `inferCompartmentType()` — 名称关键词匹配（cytoplasm/nucleus/membrane/mitochondria/ER/golgi/extracellular）

### V3: 布局算法重构

**核心思路**：三步走——(1) 创建前预计算位置 (2) 层级布局加重心排序 (3) 端口感知正交路由 + 力导向精修。

**修改点**：
1. `create.ts` — 解析完 JSON 后、创建节点前，构建虚拟图（名称邻接），运行简化布局得到位置，作为默认坐标
2. `hierarchical.ts` — 层分配后增加 barycenter 排序（3-5 轮上下扫描），减少交叉
3. `orthogonal.ts` — 完全重写：用 `findNearestPort()` 获取端口 → 按端口 side 方向出发 → 正交路由 → 存储端口和 bendPoints
4. 新增力导向精修函数 — 50 次迭代：节点间斥力 + 弧线引力 + Compartment 包含力 + 冷却退火
5. `layout.ts` 工具 — `auto_layout_pathway` 执行 hierarchical → orthogonal → force-directed 三步

### V4: Multimer + Active State 渲染

**核心思路**：在主 glyph 绘制前/后添加额外绘制步骤。

**修改点**：
1. `glyphs.ts` 或 `render.ts` — multimer 时先 `canvas.translate(offset)` 画幽灵副本，再画主 glyph
2. `render.ts` — activeState 时画扩展虚线边框（`PathEffect.MakeDash([3,6])`）

### V5: Unit of Information Badge 渲染

**核心思路**：复用 `paintStateVariables()` 的 stadium 形状逻辑，渲染在 state variable 下方。

**修改点**：
1. `labels.ts` — 新增 `paintUnitOfInformation()`，与 `paintStateVariables()` 类似但位置偏移
2. `render.ts` — 在 `paintStateVariables()` 后调用

### V6: Z 序多遍渲染

**核心思路**：当页面包含 pathway 节点时，将渲染从单遍 child 顺序改为 4-pass。

**修改点**：
1. `scene.ts` `renderNodeContent()` — 检测页面是否有 PATHWAY_* 节点
2. 有则收集节点到 4 个桶：compartment fills → arc lines → entity/process fills+strokes → arc decorations + labels + badges
3. 按 pass 顺序渲染
4. 无 pathway 节点时保持原有单遍渲染（零回归风险）

### V7: AI System Prompt 增强

**核心思路**：在 system prompt 中增加视觉质量规则，确保 AI 默认生成出版级通路图。

**修改点**：
1. `system-prompt.md` — 新增 `## Visual Quality Rules` 节
2. 规则包括：默认 publication style、auto_layout 调用、实体尺寸、间距、Compartment 创建顺序、state variable 格式、弧线方向偏好

---

## 六、备选方案

### 备选 A: 使用 Cytoscape.js + sbgnviz.js 作为渲染引擎

**思路**：不自己实现 SBGN 渲染，而是嵌入 Cytoscape.js + sbgnviz.js，将 SceneGraph 同步到 Cytoscape 数据模型。

**优点**：
- 开箱即用的 SBGN 渲染，视觉质量有保证
- fCoSE 布局算法直接可用
- 社区维护，SBGN 规范更新自动跟进

**缺点**：
- 双数据模型同步复杂（SceneGraph ↔ Cytoscape.js elements）
- Cytoscape.js 是 Canvas 2D 渲染，与 CanvasKit/Skia WebGL 渲染管线冲突
- 无法利用现有 Skia 渲染器的高级特性（阴影、混合模式、Picture 缓存）
- 增加约 500KB+ 依赖（cytoscape.js + sbgnviz.js + fcose）
- 与 Tauri 桌面端 WebGL surface 集成困难

**结论**：不采用。自研渲染管线虽工作量大，但与现有架构一致，且 CanvasKit/Skia 的渲染能力远超 Canvas 2D。

### 备选 B: 使用 ELK.js 作为布局引擎（替代自研 hierarchical + force-directed）

**思路**：Phase 4 已规划 ELK.js 集成（`biopath-checklist.md` P4.2），可提前到 Phase 1。

**优点**：
- ELK 的 layered 算法自带交叉最小化、barycenter 排序、正交路由
- 成熟稳定，SBGN 社区有使用先例
- 替代自研 hierarchical + orthogonal + force-directed 三段式

**缺点**：
- ELK.js 约 800KB WASM，增加包体积
- ELK 不理解 SBGN 语义（Compartment 包含约束、端口对齐），需额外适配层
- 当前 Phase 1 目标是"够用的布局"，ELK 是 Phase 4 的"专业级布局"
- 提前引入会延迟 Phase 1 交付

**结论**：Phase 1 先用自研三段式（hierarchical + orthogonal + force-directed），Phase 4 再引入 ELK 作为高级选项。自研方案足以解决当前"布局错乱"问题。

### 备选 C: 使用 SVG 渲染替代 CanvasKit 渲染

**思路**：SBGN glyph 用 SVG 定义（如 cytoscape-sbgn-stylesheet 的 CSS 样式），通过 SVG→CanvasKit 路径转换渲染。

**优点**：
- 可直接复用 cytoscape-sbgn-stylesheet 的 CSS 样式定义
- SVG 天然支持渐变、阴影、滤镜
- 修改样式无需改代码

**缺点**：
- SVG→CanvasKit 路径转换有精度损失
- 大图性能差（SVG DOM 操作 vs Canvas 直接绘制）
- 与现有 CanvasKit 渲染管线不一致
- 交互（hit test、选择、拖拽）需要额外适配

**结论**：不采用。CanvasKit/Skia 原生支持渐变和阴影，无需引入 SVG 中间层。

### 备选 D: 仅修改 AI Prompt，不修改渲染代码

**思路**：通过优化 AI prompt 让其生成更合理的布局和颜色（通过 `set_pathway_style` + 精确坐标），不改渲染管线。

**优点**：零代码修改，最快实施

**缺点**：
- 根本问题未解决：渲染管线不支持渐变/阴影/膜线，prompt 再好也画不出拟物效果
- AI 生成的坐标永远不如算法计算精确
- 每次生成都需 AI "猜"位置，不可靠

**结论**：不采用。V7（prompt 增强）是辅助手段，不能替代渲染和布局的代码修改。

---

## 七、具体实施清单

### V1: 默认 Publication Style + 渐变填充 + 投影

- [ ] **V1.1** `constants.ts` — 新增 `entityGradients` 字段（8 个 glyph 类型的 top/bottom 渐变色对）
- [ ] **V1.2** `constants.ts` — 新增 `dropShadow` 字段（offset/blur/color）
- [ ] **V1.3** `constants.ts` — 新增 `compartmentShadow` 字段（offset/blur/color）
- [ ] **V1.4** `glyphs.ts` — 新增 `glyphFillShader(ck, glyphType, style, nodeHeight)` 函数，publication 模式返回 `Shader.MakeLinearGradient()`
- [ ] **V1.5** `glyphs.ts` — 修改全部 8 个 glyph painter：publication 模式用 `fillPaint.setShader(gradient)` → draw → `setShader(null)`
- [ ] **V1.6** `render.ts` `renderPathwayGlyph()` — publication 模式在 paint 前设 `ImageFilter.MakeDropShadow()`，paint 后清除
- [ ] **V1.7** `render.ts` `renderPathwayProcess()` — 同 V1.6 加投影
- [ ] **V1.8** `create.ts` — 创建完节点后调用 `figma.setPathwayStyle('publication')`
- [ ] **V1.9** 渲染器默认值 — `pathwayStyle` 从 `'sbgn'` 改为 `'publication'`
- [ ] **V1.10** 单元测试 — 验证渐变 shader 创建、投影 filter 创建、style 切换

### V2: Compartment 视觉升级

- [ ] **V2.1** `constants.ts` — `compartmentFills` 增加渐变版本（top/bottom rgba 对）
- [ ] **V2.2** 新建 `membrane.ts` — 实现 `paintMembraneLine(ck, canvas, compartment, membraneType)`
  - plasma: 3px 粗线 + 8px 间隔 tick
  - nuclear: 双线 + 40px 间隔核孔
  - mitochondrial: 外膜平滑 + 内膜锯齿
- [ ] **V2.3** 新增 `inferCompartmentType(name: string)` — 关键词匹配 7 种 Compartment 类型
- [ ] **V2.4** `render.ts` `renderCompartment()` — 调用 `inferCompartmentType()` → 渐变填充 → 膜线 → 投影
- [ ] **V2.5** `render.ts` — Compartment 投影使用 `compartmentShadow` 规格
- [ ] **V2.6** 单元测试 — `inferCompartmentType()` 覆盖 7 种类型 + 默认

### V3: 布局算法重构

- [ ] **V3.1** `create.ts` — 解析 JSON 后构建虚拟邻接图，运行 `precomputeLayout()` 得到位置映射
- [ ] **V3.2** 新增 `precomputeLayout(specs)` — 简化版层级布局，返回 `Map<name, {x,y}>`
- [ ] **V3.3** `create.ts` — 用预计算位置替代 `x:0, y:0` 默认值
- [ ] **V3.4** `hierarchical.ts` — 层分配后增加 barycenter 排序（3 轮上下扫描）
- [ ] **V3.5** `orthogonal.ts` — 完全重写 `computeOrthogonalBendPoints()`：
  - 用 `findNearestPort()` 获取 source/target 端口
  - 按端口 side 方向出发（bottom→向下 exit segment 等）
  - 正交路由最多 2 个额外 bend point
  - 存储 sourcePort/targetPort/bendPoints 到 arc data
- [ ] **V3.6** 新增 `forceDirectedRefinement(graph, pageId, iterations=50)` — 斥力+引力+包含力+冷却
- [ ] **V3.7** `layout.ts` 工具 — `auto_layout_pathway` 执行 hierarchical → orthogonal → force-directed
- [ ] **V3.8** 单元测试 — 预计算布局、barycenter 排序、端口路由、力导向收敛

### V4: Multimer + Active State 渲染

- [ ] **V4.1** `render.ts` `renderPathwayGlyph()` — multimer 时先 translate(offset) 画幽灵，再画主 glyph
- [ ] **V4.2** `constants.ts` — 新增 `MULTIMER_OFFSETS` 按 glyph 类型
- [ ] **V4.3** `render.ts` — activeState 时画扩展虚线边框（`PathEffect.MakeDash([3,6])`）
- [ ] **V4.4** `glyphs.ts` 或新文件 — `buildExpandedGlyphPath(ck, node, data, padding)` 生成扩展路径
- [ ] **V4.5** 视觉测试 — multimer 堆叠效果、active state 虚线效果

### V5: Unit of Information Badge 渲染

- [ ] **V5.1** `labels.ts` — 新增 `paintUnitOfInformation(ck, canvas, node, data, r)` — stadium 形状，位于 state variable 下方
- [ ] **V5.2** `render.ts` — 在 `paintStateVariables()` 后调用 `paintUnitOfInformation()`
- [ ] **V5.3** 视觉测试 — badge 位置和样式

### V6: Z 序多遍渲染

- [ ] **V6.1** `scene.ts` — 检测页面是否包含 PATHWAY_* / COMPARTMENT 节点
- [ ] **V6.2** `scene.ts` — 有 pathway 节点时收集到 4 个桶：compartment fills / arc lines / entity+process / decorations+labels
- [ ] **V6.3** `scene.ts` — 按 pass 顺序渲染 4 遍
- [ ] **V6.4** 回归测试 — 非 pathway 页面保持单遍渲染

### V7: AI System Prompt 增强

- [ ] **V7.1** `system-prompt.md` — 新增 `## Visual Quality Rules` 节
- [ ] **V7.2** 规则内容：默认 publication style、auto_layout 调用、实体尺寸、间距、Compartment 顺序、state variable 格式、弧线方向
- [ ] **V7.3** 端到端测试 — AI chat "Draw JAK-STAT pathway" → 验证 publication style + auto_layout 自动触发

---

## 八、执行顺序与工时估算

```
V1 (渐变+投影+默认publication)  ← 2-3天 — 解决"黑白扁平"
  V1.1 → V1.2 → V1.3 → V1.4 → V1.5 → V1.6 → V1.7 → V1.8 → V1.9 → V1.10

V3 (布局重构)                   ← 3-4天 — 解决"布局错乱"
  V3.1 → V3.2 → V3.3 → V3.4 → V3.5 → V3.6 → V3.7 → V3.8

V2 (Compartment升级)            ← 2天 — 解决"细胞结构不像"
  V2.1 → V2.2 → V2.3 → V2.4 → V2.5 → V2.6

V6 (Z序多遍渲染)                ← 1-2天 — 解决"弧线被遮挡"
  V6.1 → V6.2 → V6.3 → V6.4

V4 (Multimer+ActiveState)       ← 1天 — 补全视觉细节
  V4.1 → V4.2 → V4.3 → V4.4 → V4.5

V7 (AI Prompt增强)              ← 0.5天 — 提升AI生成质量
  V7.1 → V7.2 → V7.3

V5 (UnitOfInfo badge)           ← 0.5天 — 补全语义标注
  V5.1 → V5.2 → V5.3
```

**总工时估算**：10-13 天

**Review Gate**：每完成一个 V 模块后运行 `bun run check` + `bun run test:unit` + 视觉验证。

---

## 九、风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| CanvasKit `Shader.MakeLinearGradient()` 性能问题（每帧创建 shader） | 中 | 帧率下降 | 缓存 shader 到 renderer 实例，按 glyphType 复用 |
| `ImageFilter.MakeDropShadow()` 在 WebGL 上性能差 | 中 | 帧率下降 | 仅 publication 模式启用；大图时降级为无阴影 |
| 4-pass 渲染导致渲染时间翻倍 | 低 | 帧率下降 | 仅 pathway 页面启用；pass 间复用 Paint 对象 |
| barycenter 排序对环形通路不收敛 | 低 | 布局仍交叉 | 增加最大迭代次数；环形通路回退到简单排序 |
| `inferCompartmentType()` 误判 | 低 | 错误颜色 | 提供 `compartmentType` 显式字段作为覆盖；默认 fallback |
| 力导向精修不收敛 | 低 | 节点抖动 | 冷却退火 + 最大迭代限制 + 位移阈值提前终止 |
