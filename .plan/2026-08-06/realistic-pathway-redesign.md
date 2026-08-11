# 拟物风格信号通路图系统重构方案

创建于: 2026-08-06
状态: 待批准

---

## 一、目标与期望效果

### 核心目标

将 BioPath 信号通路图编辑器从当前的"扁平2D流程图风格"升级为"拟物3D风格"，使生成的通路图具有**一眼惊艳、逼真、色彩丰富**的视觉效果，类似 BioRender 或专业科学插画的品质。

### 期望效果

1. **视觉震撼**: 蛋白像3D胶囊体、配体像3D球体/晶体、复合物像3D切角方块——每个元素都有径向渐变、高光、内阴影、斜面边缘，呈现出凸起的3D立体感
2. **不再重叠**: AI创建的元素有明确的空间规划，即使AI指定了错误坐标，碰撞检测算法也会自动推开重叠元素
3. **连接线流畅**: 使用贝塞尔曲线替代直线/折线，配合更粗的线宽和放大的装饰，连接线自然流畅且视觉层次清晰
4. **色彩丰富**: 比 publication 风格更饱和的色彩、多级渐变、更强的投影，整体画面更具冲击力

---

## 二、问题点

### 问题1：元素重叠在同一点

**现象**: AI画出的配体、蛋白等元素全部堆叠在(0,0)同一点，无法区分。

**根因**:
- `add_entity` 和 `add_process` 工具**完全没有 x/y 位置参数**（`packages/core/src/tools/pathway/modify.ts`）
- 所有节点创建后默认位置为 `(0, 0)`（`node-defaults.ts`）
- 系统 prompt 明确指示 AI "Do NOT specify x/y coordinates"（`src/app/ai/chat/system-prompt.md` Rule 4）
- 虽然 `end_pathway` 后会运行 `hierarchicalLayout()`，但如果 AI 忘记调用或单独使用 `add_entity`，元素就堆在原点
- `removeOverlaps()` 只是简单线性扫描推挤，对非分层布局效果有限

### 问题2：画得不像（像流程图不像生物通路图）

**现象**: 蛋白不像蛋白、配体不像配体，整体看起来像普通流程图。

**根因**:
- 当前 glyph 渲染是**纯几何程序化绘制**（`packages/core/src/pathway/glyphs.ts`），每个 glyph 只是一个简单 Skia Path
- macromolecule = 圆角矩形（4%圆角）→ 看起来就是个方框
- simple_chemical = 完全圆角矩形 → 看起来就是个胶囊
- Publication 模式视觉效果极弱：
  - 2色线性渐变（如 `#D4E6F1` → `#A9CCE3`，几乎看不出区别）
  - 1px/2px偏移的15%透明度投影
  - 没有内发光、外发光、高光、斜面、浮雕、纹理
  - 没有图像填充、SVG图标、3D效果
- 本质上是**带颜色的扁平2D几何图形**，跟流程图没区别

### 问题3：连接线混乱

**现象**: 连接线交叉、重叠、不美观。

**根因**:
- `hierarchicalLayout()` 的 barycenter 交叉最小化只做 3 轮扫描（`packages/core/src/pathway/layout/hierarchical.ts:307`）
- 正交路由只做简单 L/Z 形弯折，没有全局避障
- 弧线用直线/折线绘制，缺乏曲线美感
- 弧宽仅 1.5px，装饰（箭头、T-bar等）尺寸过小
- 没有 fCoSE 或 ELK.js 集成

---

## 三、研究结果

### 3.1 Glyph 渲染系统

| Glyph类型 | 当前形状 | 当前视觉效果 | Skia命令 |
|-----------|---------|-------------|---------|
| macromolecule | 圆角矩形(4%圆角) | 扁平方框 | moveTo/lineTo/quadTo |
| simple_chemical | 完全圆角矩形 | 胶囊 | 同上，cornerRadius=min(w/2,h/2) |
| complex | 八边形 | 切角方框 | moveTo/lineTo (8顶点) |
| nucleic_acid_feature | 上平下圆 | 梯形底方框 | lineTo + quadTo底部 |
| phenotype | 六边形 | 简单六边形 | 6顶点polygon |
| perturbation | 凹六边形 | 简单凹六边形 | 6顶点polygon |
| source_sink | 圆+斜线 | 简单圆+线 | drawCircle + drawLine |
| unspecified_entity | 椭圆 | 简单椭圆 | drawOval |

**关键发现**: 所有 glyph 共享 `applyGlyphFill()` + `applyGlyphStroke()` 模式，publication模式仅有2色线性渐变+1.5px描边。

### 3.2 渲染效果对比

| 特性 | SBGN模式 | Publication模式 | 通用渲染器(未用于pathway) |
|------|---------|----------------|------------------------|
| 平填充 | #f6f6f6 | 每类型粉彩色 | 任意颜色 |
| 线性渐变 | 无 | 2色top→bottom | 多色停靠点，任意方向 |
| 径向渐变 | 无 | 无 | 支持 |
| 投影 | 无 | 1/2/3 blur, 15%透明度 | 完整Figma阴影规范 |
| 内阴影 | 无 | 无 | 支持 |
| 图像填充 | 无 | 无 | 支持(FILL/FIT/CROP/TILE) |
| 图案填充 | 无 | 无 | 支持(六角平铺) |
| 噪声纹理 | 无 | 无 | 支持(种子噪声) |

**关键发现**: 通用渲染器已支持径向渐变、内阴影、背景模糊、图像填充、噪声纹理等高级效果，但pathway渲染管线**完全没有使用这些能力**。

### 3.3 位置系统

- `add_entity`/`add_process`/`add_compartment` 工具无 x/y 参数
- `create_pathway` 工具有可选 x/y 但默认为 0
- 系统 prompt Rule 4 禁止 AI 指定坐标
- 布局完全依赖 `hierarchicalLayout()` 在 `end_pathway` 后自动运行
- `removeOverlaps()` 仅做同层内简单线性推挤

### 3.4 弧渲染

- 直线或折线（有 bendPoints 时为折线）
- 线宽 1.5px
- 装饰尺寸: 箭头 12px, T-bar 8px宽, 圆圈半径3px, 菱形4x3px
- 装饰为纯几何，无填充色/阴影
- 无曲线弧能力

### 3.5 布局算法

- 自定义分层布局（514行 TypeScript）
- 拓扑排序→最长路径分层→barycenter交叉最小化(3轮)→位置计算→去重叠→compartment扩展
- 正交路由: L/Z形弯折，20px出口长度
- 无外部布局引擎依赖

### 3.6 现有可复用基础设施

| 能力 | 位置 | 当前pathway使用情况 |
|------|------|-------------------|
| 图标系统(Iconify API→VectorNetwork) | `packages/core/src/icons/` | 未使用 |
| 图像填充(IMAGE fill) | `packages/core/src/canvas/fills.ts` | 未使用 |
| 径向渐变 | `applyGradientFill()` | 未使用 |
| 内阴影 | `packages/core/src/canvas/shadows.ts` | 未使用 |
| 投影增强 | `MakeDropShadow` | publication仅1/2/3blur |
| SVG解析 | `packages/core/src/icons/svg.ts` | 未使用 |
| 噪声纹理 | `renderNoiseEffect()` | 未使用 |

---

## 四、设计方案

### 4.1 总体架构

```
┌─────────────────────────────────────────────┐
│              AI Tool Layer                    │
│  add_entity(x,y,style)  add_arc  add_process │
│  create_pathway  auto_layout  set_style      │
├─────────────────────────────────────────────┤
│          Rendering Pipeline (3 styles)        │
│  style='realistic':                          │
│    径向渐变 + 高光层 + 内外阴影 +            │
│    斜面边缘 + 贝塞尔弧 + 增强装饰            │
│  style='publication': 现有逻辑(不变)         │
│  style='sbgn': 现有逻辑(不变)                │
├─────────────────────────────────────────────┤
│          Layout Engine                        │
│  AI坐标(可选) + hierarchicalLayout(增量)     │
│  + 碰撞检测分离 + 贝塞尔弧路由               │
└─────────────────────────────────────────────┘
```

### 4.2 拟物风格Glyph视觉设计

每个glyph类型应有明确的3D拟物视觉特征:

| Glyph类型 | 拟物视觉 | 关键渲染效果 |
|-----------|---------|-------------|
| **Macromolecule (蛋白)** | 3D圆角胶囊体，药丸形状 | 径向渐变(中心亮→边缘暗)、顶部高光条、底部深色阴影、边缘斜面 |
| **Simple Chemical (配体)** | 3D球体/晶体 | 球面径向渐变、左上高光点、底部投影、折射光效 |
| **Complex (复合物)** | 3D切角方块 | 外框凸起效果、组合阴影、内部凹陷暗示 |
| **Nucleic Acid Feature (基因/RNA)** | 3D文档/卡片 | 顶部高光、底部圆角阴影、微纹理 |
| **Phenotype (表型)** | 3D六边形徽章 | 金属质感渐变、边缘发光、浮雕文字 |
| **Perturbation (药物)** | 3D菱形/星形 | 晶体折射光效、棱面渐变、警示色发光 |
| **Source/Sink (降解)** | 3D球体+斜线 | 球面渐变+凹陷斜线、消融效果 |
| **Process (反应)** | 3D立方体 | 小型3D方块、金属质感 |

### 4.3 拟物渲染管线 (7层绘制)

每个 glyph/process 在 realistic 模式下按以下顺序绘制7层:

1. **底层投影**: `canvas.saveLayer()` + glyph path + `MakeDropShadow(offsetX=3, offsetY=6, blur=12, opacity=0.25)`
2. **主体填充**: 径向渐变 `Shader.MakeRadialGradient`，中心偏左上(0.35w, 0.3h)，模拟3D球面光照
3. **高光层**: glyph上半部分绘制白色半透明线性渐变(顶部0.4透明→中间0透明)
4. **内阴影**: `saveLayer` + `DstOut` 合成模式绘制底部内阴影(offsetX=1, offsetY=2, blur=4)
5. **斜面边缘**: 顶部1px亮线(rgba(255,255,255,0.3)) + 底部1px暗线(rgba(0,0,0,0.2))
6. **描边**: glyph类型对应的边框色，宽度2px
7. **文字描边**: 先画粗白描边文字(width=2)再画正常黑色文字，实现光晕

### 4.4 位置系统改进

- `add_entity`/`add_process`/`add_compartment` 增加可选 `x`, `y` 参数
- AI 可以指定坐标（系统 prompt 教导坐标规划策略）
- `end_pathway` 仍运行 `hierarchicalLayout()`，但增加 `respectPositions` 选项尊重已有坐标
- 新增碰撞检测 `resolveCollisions()` 作为最终保障
- 系统 prompt 从 "禁止指定坐标" 改为 "可以指定坐标+给出规划建议"

### 4.5 贝塞尔弧渲染

- 用三次贝塞尔曲线(cubic bezier)替代直线/折线
- 控制点从源/目标端口方向推导，tension=0.4
- 线宽从1.5px增至2.5px
- 装饰尺寸放大2倍
- 装饰增加微阴影和填充色

### 4.6 布局增强

- barycenter交叉最小化从3轮增至10轮
- 调节弧(catalysis, inhibition等)强制侧面端口，避免穿过主信号流
- 正交路由应用 arcRole 约束

---

## 五、备选方案

### 5.1 视觉效果 (问题2)

| 方案 | 描述 | 优点 | 缺点 | 评估 |
|------|------|------|------|------|
| **A. 纯Skia程序化拟物** (当前推荐) | 为每个glyph编写多层Skia绘制程序 | 无需外部资产、无限缩放、纯代码 | 每个glyph绘制代码复杂、效果上限受限于程序化能力 | 推荐 — 利用已有渲染器能力 |
| **B. 预置SVG资产库** | 设计拟物SVG资产，解析为VectorNetwork | 视觉由专业设计决定、数据驱动 | 需设计大量SVG、SVG→Skia精度损失 | 备选 — Phase 2考虑 |
| **C. 预置PNG资产库** | 3D工具渲染高质量PNG，通过IMAGE fill渲染 | 视觉上限最高(可用Blender) | 位图不可缩放、性能差、与矢量管线不兼容 | 不推荐 |

### 5.2 位置系统 (问题1)

| 方案 | 描述 | 优点 | 缺点 | 评估 |
|------|------|------|------|------|
| **A. AI坐标+碰撞检测** (当前推荐) | 增加x/y参数+碰撞检测兜底 | AI有空间控制权+安全网 | AI可能给出不合理坐标 | 推荐 |
| **B. 智能网格布局** | 语义网格区域(胞外→膜→胞质→核)，AI只选区域+序号 | 绝不重叠 | 灵活性低 | 备选 |
| **C. 纯自动布局** | 维持现状，只优化布局算法 | 简单 | 无法满足用户对空间控制的需求 | 不推荐 |

### 5.3 连接线 (问题3)

| 方案 | 描述 | 优点 | 缺点 | 评估 |
|------|------|------|------|------|
| **A. 贝塞尔曲线+增强装饰** (当前推荐) | 三次贝塞尔弧+放大的彩色装饰 | 视觉流畅自然 | 曲线可能交叉 | 推荐 |
| **B. 增强正交路由** | 改进折线+全局避障 | 改动最小 | 正交线本身不够美观 | 备选 |
| **C. 贝塞尔+弧捆绑** | 同向平行弧自动捆绑 | 减少视觉混乱 | 实现复杂度高 | Phase 2 |

---

## 六、实施清单

### Phase 1: 拟物风格渲染系统 (解决问题2)

```
1.1 修改 packages/core/src/pathway/constants.ts
     - PathwayStyle 类型扩展为 'sbgn' | 'publication' | 'realistic'
     - 新增 REALISTIC_STYLE 常量（含每个glyph的径向渐变、高光色、阴影色、投影参数、斜面色、弧宽、装饰缩放、文字描边参数）

1.2 新建 packages/core/src/pathway/glyphs-realistic.ts
     - 实现 paintRealisticGlyph(ck, canvas, node, data, r) 函数
     - 7层渲染：底层投影 → 径向渐变主体 → 高光层 → 内阴影 → 斜面边缘 → 描边 → 清理
     - 8个glyph类型各自的径向渐变参数（中心偏移、色停靠点）
     - REALISTIC_GLYPH_PAINTERS dispatch record

1.3 新建 packages/core/src/pathway/processes-realistic.ts
     - 实现 paintRealisticProcess(ck, canvas, node, data, r) 函数
     - 6个process类型的3D效果：3D凸起方块、双层3D方块、3D球体、3D同心球、虚线3D方块
     - REALISTIC_PROCESS_PAINTERS dispatch record

1.4 修改 packages/core/src/pathway/glyphs.ts
     - paintPathwayGlyph() 增加 style==='realistic' 分支，委托到 paintRealisticGlyph()
     - 不修改现有 paintMacromolecule 等函数

1.5 修改 packages/core/src/pathway/processes.ts
     - paintPathwayProcess() 增加 style==='realistic' 分支，委托到 paintRealisticProcess()

1.6 修改 packages/core/src/pathway/render.ts
     - renderPathwayGlyph(): realistic 时应用 REALISTIC_STYLE.dropShadow 增强投影
     - renderPathwayProcess(): 同上
     - renderCompartment(): realistic 时应用更鲜明的 compartment 渲染（更饱和渐变+更强投影）

1.7 修改 packages/core/src/pathway/labels.ts
     - paintPathwayLabel(): realistic 时绘制白色外描边文字（先粗白描边再正常黑文字）

1.8 修改 packages/core/src/canvas/renderer.ts
     - pathwayStyle 类型从 'sbgn' | 'publication' 扩展为 'sbgn' | 'publication' | 'realistic'
```

### Phase 2: AI工具位置参数+碰撞检测 (解决问题1)

```
2.1 修改 packages/core/src/tools/pathway/modify.ts — addEntity
     - params 增加 x: { type: 'number', description: 'X position (omit for auto-layout)' }
     - params 增加 y: { type: 'number', description: 'Y position (omit for auto-layout)' }
     - execute: overrides.x = args.x ?? 0; overrides.y = args.y ?? 0;

2.2 修改 packages/core/src/tools/pathway/modify.ts — addProcess
     - params 增加 x, y 参数
     - execute: 使用 args.x ?? 0, args.y ?? 0

2.3 修改 packages/core/src/tools/pathway/modify.ts — addCompartment
     - params 增加 x, y, width, height 参数
     - execute: 传递给 figma.createCompartment()

2.4 新建 packages/core/src/pathway/layout/collision.ts
     - resolveCollisions(graph, pageId, minGap) 函数
     - 扫描线AABB重叠检测 → 最小推力分离 → 迭代至无重叠(最多20轮) → 更新graph

2.5 修改 packages/core/src/pathway/layout/hierarchical.ts
     - hierarchicalLayout() 签名增加 respectPositions?: boolean 选项
     - respectPositions=true 时: 跳过 computePositions()，仍运行 removeOverlaps() + expandCompartments()
     - respectPositions=false (默认): 行为不变

2.6 修改 src/app/ai/tools/index.ts
     - end_pathway onAfterExecute: hierarchicalLayout() 后增加 resolveCollisions(store.graph, pageId, 20)
     - 非batch add_entity/add_process: 有pathway节点时运行 resolveCollisions()

2.7 修改 src/app/ai/chat/system-prompt.md
     - Rule 4 从 "Do NOT specify x/y coordinates" 改为可指定坐标+给出规划建议
     - 增加 realistic 风格说明段落
     - set_pathway_style 增加 realistic 选项

2.8 修改 packages/core/src/tools/pathway/modify.ts — setPathwayStyle
     - params.style enum: ['sbgn', 'publication'] → ['sbgn', 'publication', 'realistic']
     - execute 类型转换扩展

2.9 修改 packages/core/src/figma-api/index.ts
     - pathwayStyle getter/setter 类型扩展为 'sbgn' | 'publication' | 'realistic'
```

### Phase 3: 贝塞尔弧渲染+布局增强 (解决问题3)

```
3.1 新建 packages/core/src/pathway/arcs-bezier.ts
     - paintBezierArc(ck, canvas, sx, sy, tx, ty, sourcePort, targetPort, bendPoints, r)
     - 控制点: 沿端口方向偏移 tension*distance (tension=0.4)
     - ck.Path.moveTo.cubicTo 绘制三次贝塞尔

3.2 修改 packages/core/src/pathway/arcs.ts
     - paintPathwayArc(): style==='realistic' 时调用 paintBezierArc()，线宽2.5px，装饰2x缩放
     - 非 realistic: 行为不变

3.3 修改 packages/core/src/pathway/arcs.ts — 装饰增强
     - paintArrowhead/paintTBar/paintCircleOnLine/paintDiamond: realistic 时装饰加填充色+微阴影

3.4 修改 packages/core/src/pathway/layout/hierarchical.ts
     - barycenterOrder(): round < 3 → round < 10

3.5 修改 packages/core/src/pathway/layout/orthogonal.ts
     - computeOrthogonalBendPoints(): 调节弧强制侧面端口约束

3.6 修改 packages/core/src/pathway/index.ts
     - 导出 resolveCollisions, paintBezierArc 等新增模块
```

### 验证步骤

```
19. 运行 bun run check 验证类型和lint通过
```

---

## 七、文件变更汇总

### 新建文件 (4个)

| 文件路径 | 用途 |
|---------|------|
| `packages/core/src/pathway/glyphs-realistic.ts` | 拟物风格 glyph 渲染 |
| `packages/core/src/pathway/processes-realistic.ts` | 拟物风格 process 渲染 |
| `packages/core/src/pathway/layout/collision.ts` | 碰撞检测算法 |
| `packages/core/src/pathway/arcs-bezier.ts` | 贝塞尔曲线弧渲染 |

### 修改文件 (14个)

| 文件路径 | 修改内容 |
|---------|---------|
| `packages/core/src/pathway/constants.ts` | PathwayStyle 扩展 + REALISTIC_STYLE 常量 |
| `packages/core/src/pathway/glyphs.ts` | paintPathwayGlyph 增加 realistic 分发 |
| `packages/core/src/pathway/processes.ts` | paintPathwayProcess 增加 realistic 分发 |
| `packages/core/src/pathway/render.ts` | realistic 风格投影+compartment |
| `packages/core/src/pathway/labels.ts` | realistic 风格文字描边 |
| `packages/core/src/pathway/arcs.ts` | realistic 贝塞尔弧+增强装饰 |
| `packages/core/src/pathway/layout/hierarchical.ts` | respectPositions + barycenter 10轮 |
| `packages/core/src/pathway/layout/orthogonal.ts` | 调节弧侧通道约束 |
| `packages/core/src/pathway/index.ts` | 导出新增模块 |
| `packages/core/src/canvas/renderer.ts` | pathwayStyle 类型扩展 |
| `packages/core/src/tools/pathway/modify.ts` | x/y参数 + realistic选项 |
| `packages/core/src/figma-api/index.ts` | pathwayStyle 类型扩展 |
| `src/app/ai/tools/index.ts` | 碰撞检测调用 |
| `src/app/ai/chat/system-prompt.md` | 位置策略+realistic说明 |

---

## 八、实施优先级

| 优先级 | 内容 | 解决问题 | 预估工作量 |
|-------|------|---------|-----------|
| **P0** | Phase 1: 拟物渲染系统 | 问题2(画得不像) — 核心痛点 | 大 |
| **P0** | Phase 2: 位置参数+碰撞检测 | 问题1(元素重叠) — 功能性bug | 中 |
| **P1** | Phase 3: 贝塞尔弧+布局增强 | 问题3(连接线混乱) — 视觉体验 | 中 |

---

## 九、风险与注意事项

1. **Skia对象泄漏**: 径向渐变Shader、ImageFilter、Path 等必须在使用后 `.delete()`，否则 WASM 内存泄漏
2. **性能**: 多层渲染（7层）会增加绘制开销，大通路图(>100节点)可能卡顿，需考虑缓存
3. **向后兼容**: `'sbgn'` 和 `'publication'` 模式完全不变，`'realistic'` 是纯增量
4. **REALISTIC_STYLE 颜色需调优**: 当前方案中的颜色值为设计方向，实际效果需在Canvas中调试确认
5. **碰撞检测迭代**: 20轮可能不足以解决复杂重叠，可能需要增加或使用力导向分离
6. **贝塞尔弧控制点**: tension=0.4 是经验值，可能需要根据实际效果调整
