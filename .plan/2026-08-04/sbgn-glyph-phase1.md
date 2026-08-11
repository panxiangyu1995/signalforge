# Phase 1: SBGN Glyph 形状修复 — 信号通路图视觉标准化

- 日期: 2026-08-04
- 模式: RESEARCH → INNOVATE → PLAN
- 状态: 计划已确认，待执行

---

## 1. 目的与期望效果

### 目的

将当前信号通路图的渲染从"流程图感"修复为"SBGN 标准信号通路图感"。根本原因是 glyph 形状与 SBGN PD Level 1 Version 2.1 标准存在偏差，以及布局算法缺乏 SBGN 信号流语义。

### 期望效果

1. **Glyph 形状与 SBGN 标准完全对齐** — macromolecule 圆角、perturbation 凹六边形、compartment 桶形等视觉元素符合 SBGN 规范
2. **整体视觉从"通用流程图"变为"专业信号通路图"** — 专家一眼即可识别为 SBGN 图
3. **为后续布局改进奠定基础** — 形状标准化后，process-centric 布局的效果才能正确体现

### 阶段规划

- **Phase 1（本次）**: Glyph 形状修复 — 纯渲染层改动，视觉改善立竿见影
- **Phase 2**: SBGN 约束生成器 — 参考 cytoscape-sbgn-layout 的 constructSkeleton + constraint generation
- **Phase 3**: 简化版 CoSE 力导向布局 — 支持 compound node（compartment）
- **Phase 4**: 增强正交路由 — A* 路由算法
- **Phase 5**: ELK.js 作为可选高级布局引擎

---

## 2. 问题点

当前项目画的信号通路图更像流程图而非信号通路图，具体表现为：

1. **Compartment 形状不对** — 使用自定义曲线而非 SBGN 标准的 barrel（桶形），缺少左右两侧内凹的特征
2. **Macromolecule 圆角偏大** — 0.12*min(w,h) 约 5.76px，SBGN 标准为 0.04*width 约 3.84px，圆角偏大导致看起来像通用圆角矩形
3. **Perturbation 形状完全错误** — 当前实现不是 SBGN 标准的 concaveHexagon（两侧内凹六边形），顶点坐标和顺序都不对
4. **布局缺乏 SBGN 语义** — 最核心的问题：没有 process-centric 布局、没有信号流方向约束、没有 arc type 感知
5. **边路由过于简陋** — 只有简单 L/Z 形折线，没有智能正交路由
6. **SBGN-ML I/O 和验证模块缺失** — 无法导入外部 SBGN-ML 文件对比验证

---

## 3. 研究结果

### 3.1 代码结构

```
packages/core/src/pathway/
  glyphs.ts       — Skia paint routine，定义每种 glyph 的形状路径
  processes.ts    — process 节点的渲染
  arcs.ts         — arc 线条和装饰（T-bar、triangle、circle-on-line 等）
  render.ts       — 顶层渲染入口，包含 compartment 渲染
  labels.ts       — 标签、state variable、clone marker 渲染 + clip path
  constants.ts    — SBGN_STYLE 和 PUBLICATION_STYLE 常量
  ports.ts        — 8 端口系统和 arc role 映射
  layout/
    hierarchical.ts — 拓扑排序层级布局（当前唯一布局算法）
    orthogonal.ts   — 简单正交路由
  membrane.ts     — 细胞膜线渲染
  af-glyphs.ts    — Activity Flow 语言 glyph
  lint.ts         — SBGN PD 合规性 lint
  knowledge/      — Reactome/Pathway Commons API
  overlay.ts, merge.ts, utils.ts, index.ts
```

### 3.2 Glyph 形状对比分析

| Glyph | 当前实现 | SBGN 标准 (cytoscape-sbgn-stylesheet) | 差异 |
|-------|---------|--------------------------------------|------|
| macromolecule | 圆角矩形, cr=0.12*min(w,h) | roundRectangle, cr=0.04*width | 圆角偏大 |
| simple_chemical | 圆角矩形, cr=min(w/2,h/2) | ellipse (实际渲染为 stadium 形, cr=min(halfW,halfH)) | 基本一致 |
| complex | 八角 cut-rectangle | cutRectangle | 一致 |
| nucleic_acid_feature | 底部圆角矩形 | roundBottomRectangle | 一致 |
| perturbation | 自定义六边形（顶点坐标错误） | concaveHexagon: (0,0)→(w,0)→(0.85w,0.5h)→(w,h)→(0,h)→(0.15w,0.5h) | **完全错误** |
| phenotype | 六边形 | hexagon: (0,0.5h)→(0.25w,0)→(0.75w,0)→(w,0.5h)→(0.75w,h)→(0.25w,h) | 一致 |
| source_sink | 圆+对角线 | circle + diagonal | 一致 |
| unspecified_entity | 椭圆 | ellipse | 一致 |
| compartment | 自定义曲线 | barrel 形（左右直线+上下弧线） | **差异大** |

### 3.3 布局问题分析

**当前布局算法 (`hierarchical.ts`)**:
- 使用拓扑排序 + 等间距分层
- 没有区分 process 和 EPN 的视觉权重
- 没有 process-centric 布局
- 没有信号流方向约束（consumption/production vs catalysis/inhibition）
- 没有力导向（弹簧嵌入）
- 质心排序只做 3 轮，交叉最小化不足

**SBGN 标准布局要求**:
- Process-centric：先定位 process 节点，EPN 围绕它们排列
- 信号流方向：consumption/production arc 决定主方向，modulation arc 从侧面进入
- Compartment-aware：实体必须在 compartment 内部
- Compound node 支持：compartment 作为复合节点约束子节点位置

### 3.4 开源社区方案调研

| 项目 | 关键技术 | 与我们的关系 |
|------|---------|-------------|
| cytoscape-sbgn-stylesheet (PathwayCommons) | SBGN 标准视觉样式定义，baseShapes.js 定义了所有标准形状 | 直接参考 glyph 形状定义：barrel、concaveHexagon、roundRectangle、cutRectangle |
| cytoscape.js-fcose (iVis-at-Bilkent) | fCoSE 复合弹簧嵌入布局，支持 compound node | Phase 3 应参考其算法设计，但纯 TS 自研实现 |
| cytoscape.js-sbgn-layout (sciluna) | SBGN 专用布局（CoSE 扩展），constructSkeleton + SBGNPolishing | Phase 2 SBGN 约束生成器的核心参考 |
| sbgnviz.js (iVis-at-Bilkent) | SBGN 可视化引擎，自定义 drawBorder、多 pass stroke | 渲染器参考 |
| SBGNFlow (sciluna) | AI 辅助 SBGN 生成，fcose + sbgn-layout + sbgn-stylesheet 组合 | 架构参考：与我们最接近的开源实现 |
| ELK.js | 高级分层/正交布局 | Phase 5 可选集成目标 |

### 3.5 cytoscape-sbgn-stylesheet baseShapes.js 关键形状定义

**barrel** (compartment):
```
左侧: (0, 0.03h) → (0, 0.97h) quadTo(0.06w, h, 0.25w, h)
底边: (0.25w, h) → (0.75w, h) quadTo(0.95w, h, w, 0.95h)
右侧: (w, 0.95h) → (w, 0.05h) quadTo(w, 0, 0.75w, 0)
顶边: (0.75w, 0) → (0.25w, 0) quadTo(0.06w, 0, 0, 0.03h)
```

**concaveHexagon** (perturbation):
```
(0, 0) → (w, 0) → (0.85w, 0.5h) → (w, h) → (0, h) → (0.15w, 0.5h)
```

**hexagon** (phenotype):
```
(0, 0.5h) → (0.25w, 0) → (0.75w, 0) → (w, 0.5h) → (0.75w, h) → (0.25w, h)
```

**roundRectangle** (macromolecule):
```
圆角半径 = 0.04 * width（四角相等）
```

**stadium** (simple chemical，实际 element.js 用 ellipse):
```
radiusRatio = 0.24 * max(width, height)
```

---

## 4. 设计方案

### 方案 C：纯 TypeScript 实现 SBGN 专用布局引擎 — 参考而非移植

选择理由：
1. **零包体积增长**，与 AGENTS.md 的 CanvasKit WASM 优先架构一致
2. **算法完全针对 SceneGraph 数据结构优化**
3. **与现有渲染管线无缝集成**
4. **可逐步交付**：Phase 1 glyph 形状 → Phase 2 约束生成 → Phase 3 力导向 → Phase 4 路由 → Phase 5 ELK

### 排除的备选方案

| 方案 | 排除理由 |
|------|---------|
| **方案 A: 渐进式改进** | fCoSE 移植工作量大且无法达到 SBGN 语义需求 |
| **方案 B: 集成 Cytoscape.js** | +800KB 运行时依赖，DOM 依赖，双向映射复杂 |
| **方案 D: 约束+ELK.js** | ELK.js layered layout 不如力导向适合 SBGN 的环状结构；保留为 Phase 5 可选升级 |

---

## 5. Phase 1 实施清单

### 5.1 文件变更清单

| # | 文件 | 变更 | 代码位置 |
|---|------|------|---------|
| 1 | `packages/core/src/pathway/glyphs.ts` | `paintMacromolecule`: 圆角从 `Math.min(w, h) * 0.12` 改为 `w * SBGN_STYLE.macromoleculeCornerRadius` | L102 |
| 2 | `packages/core/src/pathway/glyphs.ts` | `paintPerturbation`: 顶点坐标改为 SBGN 标准 concaveHexagon | L260-265 |
| 3 | `packages/core/src/pathway/render.ts` | `renderCompartment`: 路径改为 SBGN 标准 barrel 形 | L202-219 |
| 4 | `packages/core/src/pathway/labels.ts` | `buildGlyphClipPath`: macromolecule 的 cr 同步修改 | L218 |
| 5 | 验证 | 运行 `bun run check` | — |

### 5.2 详细变更规范

#### 变更 1: paintMacromolecule 圆角修正

文件: `packages/core/src/pathway/glyphs.ts:102`

```java
// 当前
const cr = Math.min(w, h) * 0.12

// 修改为
const cr = w * SBGN_STYLE.macromoleculeCornerRadius
```

参考: cytoscape-sbgn-stylesheet `roundRectangle(x, y, width, height, .04*width, .04*width, .04*width, .04*width)`

常量 `SBGN_STYLE.macromoleculeCornerRadius` 已在 constants.ts:47 定义为 `0.04`，但 glyphs.ts 未使用。

#### 变更 2: paintPerturbation concaveHexagon 坐标修正

文件: `packages/core/src/pathway/glyphs.ts:260-265`

```java
// 当前（顶点坐标和顺序都错误）
path.moveTo(0, 0)
path.lineTo(w * 0.25, h * 0.5)
path.lineTo(0, h)
path.lineTo(w, h)
path.lineTo(w * 0.75, h * 0.5)
path.lineTo(w, 0)
path.close()

// 修改为（SBGN 标准 concaveHexagon）
path.moveTo(0, 0)
path.lineTo(w, 0)
path.lineTo(w * 0.85, h * 0.5)
path.lineTo(w, h)
path.lineTo(0, h)
path.lineTo(w * 0.15, h * 0.5)
path.close()
```

参考: cytoscape-sbgn-stylesheet `concaveHexagon(x, y, width, height)` — `(0,0)→(w,0)→(0.85w,0.5h)→(w,h)→(0,h)→(0.15w,0.5h)`

特征：左上→右上→右侧内凹→右下→左下→左侧内凹，形成两侧内凹的六边形。

#### 变更 3: renderCompartment barrel 形

文件: `packages/core/src/pathway/render.ts:202-219`

```java
// 当前（自定义曲线，不符合 SBGN barrel 形）
const x0 = w * 0.03
const x1 = w * 0.97
const y0 = h * 0.03
const _y1 = h * 0.97

path.moveTo(w * 0.05, y0)
path.lineTo(w * 0.25, 0)
path.lineTo(w * 0.75, 0)
path.lineTo(w * 0.95, y0)
path.quadTo(w, h * 0.25, x1, h * 0.25)
path.quadTo(x1, h * 0.5, x1, h * 0.75)
path.quadTo(w * 0.95, h, w * 0.75, h)
path.lineTo(w * 0.25, h)
path.quadTo(w * 0.05, h, x0, h * 0.75)
path.quadTo(x0, h * 0.5, x0, h * 0.25)
path.close()

// 修改为（SBGN 标准 barrel 形）
path.moveTo(0, h * 0.03)
path.lineTo(0, h * 0.97)
path.quadTo(w * 0.06, h, w * 0.25, h)
path.lineTo(w * 0.75, h)
path.quadTo(w * 0.95, h, w, h * 0.95)
path.lineTo(w, h * 0.05)
path.quadTo(w, 0, w * 0.75, 0)
path.lineTo(w * 0.25, 0)
path.quadTo(w * 0.06, 0, 0, h * 0.03)
path.close()
```

参考: cytoscape-sbgn-stylesheet `barrel(x, y, width, height)`:
- 左侧: `(0, 0.03h)` → `(0, 0.97h)` 直线，quadTo 弯到 `(0.25w, h)`
- 底边: `(0.25w, h)` → `(0.75w, h)` 直线，quadTo 弯到 `(w, 0.95h)`
- 右侧: `(w, 0.95h)` → `(w, 0.05h)` 直线，quadTo 弯到 `(0.75w, 0)`
- 顶边: `(0.75w, 0)` → `(0.25w, 0)` 直线，quadTo 弯到 `(0, 0.03h)`

特征：左右两侧是直线（产生内凹效果），上下两端 quadTo 弧线向外凸出，整体形成桶形容器。

#### 变更 4: buildGlyphClipPath macromolecule 圆角同步

文件: `packages/core/src/pathway/labels.ts:218`

```java
// 当前
if (glyphType === 'macromolecule' || glyphType === 'simple_chemical') {
  const cr = glyphType === 'simple_chemical'
    ? Math.min(w / 2, h / 2)
    : Math.min(w, h) * 0.12
  return buildRoundedRectPath(ck, w, h, cr)
}

// 修改为
if (glyphType === 'macromolecule' || glyphType === 'simple_chemical') {
  const cr = glyphType === 'simple_chemical'
    ? Math.min(w / 2, h / 2)
    : w * SBGN_STYLE.macromoleculeCornerRadius
  return buildRoundedRectPath(ck, w, h, cr)
}
```

需要确保 labels.ts 已导入 SBGN_STYLE（检查 L9：已导入）。

### 5.3 不需要修改的项

- **simple_chemical**: 当前 `cr = Math.min(w/2, h/2)` 已是正确的 stadium 形，与 sbgnviz 的 `cornerRadius = Math.min(halfWidth, halfHeight)` 一致
- **phenotype**: 当前六边形顶点坐标与 SBGN 标准一致
- **complex**: 当前 cut-rectangle 与 SBGN 标准一致
- **nucleic_acid_feature**: 当前底部圆角矩形与 SBGN 标准一致
- **source_sink**: 当前圆+对角线与 SBGN 标准一致
- **unspecified_entity**: 当前椭圆与 SBGN 标准一致
- **process/transport/association/dissociation**: 当前渲染与 SBGN 标准一致

### 5.4 验证标准

1. `bun run check` 零错误
2. 打开应用查看通路图，确认：
   - macromolecule 圆角更小更方正
   - perturbation 为两侧内凹的六边形
   - compartment 为桶形（左右直线+上下弧线）
