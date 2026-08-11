# AI 对话日志自动持久化方案

> 创建时间: 2026-08-11
> 模式: RIPER-5 PLAN

---

## 一、想达到什么目的和效果

### 用户需求
1. **开发服务器模式**：每次 AI 对话结束后，自动将对话日志保存到项目 `.logs/YYYY-MM-DD/` 目录下，不需要用户手动点击 "Copy log" 按钮
2. **打包安装版模式**：移除手动 Copy log 按钮，替换为 "历史对话日志" 按钮，点击后弹出一个对话框，可以查看和浏览历史对话日志

### 预期效果
| 场景 | 行为 |
|------|------|
| 开发服务器 (`bun run dev`) | 对话结束后自动保存到 `.logs/2026-08-11/14-30-25_anthropic.log`，日志格式为可读的文本（包含 token 使用、工具调用、对话内容） |
| 打包安装版 (`bun run tauri build`) | ChatPanel toolbar 显示 "History" 按钮，点击弹出历史日志查看器，按日期分组展示历史日志，支持预览和导出 |

---

## 二、问题点

### 现有问题
1. **Copy log 按钮仅开发模式显示**：`v-if="IS_DEV"` 限制了生产版本无法导出日志
2. **日志需要手动复制**：用户必须点击按钮才能导出，不方便自动化流程
3. **日志只在剪贴板**：没有持久化存储，无法查看历史对话
4. **生产模式缺少日志查看 UI**：没有历史日志的浏览和管理界面

### 技术问题
1. **消息监听时机**：ChatPanel 通过 `watch(messages, scrollToBottom, { deep: true })` 监听消息变化，但这个 watcher 会频繁触发，需要在 stream 完成时保存而非每次增量更新
2. **环境判断**：需要区分 dev 模式和 prod 模式，采用不同的存储路径和格式
3. **Tauri 文件系统权限**：dev 模式写入项目 `.logs/` 目录，prod 模式需要写入 `$APPDATA` 目录

---

## 三、研究结果

### 3.1 现有代码架构

| 组件 | 位置 | 功能 |
|------|------|------|
| `serializeChatLog()` | `src/app/ai/debug/index.ts:208` | 将 UIMessage[] 序列化为格式化文本日志 |
| `copyChatLog()` | `src/app/ai/debug/index.ts:273` | 复制到剪贴板（现有 Copy log 按钮） |
| `createChatSessionManager` | `src/app/ai/chat/transports.ts:124` | 管理 Chat 实例和消息状态，核心 session 管理 |
| ChatPanel | `src/components/ChatPanel.vue` | UI 组件，watch messages 变化驱动 UI |
| `aiLog` | `src/app/ai/dev-log/index.ts` | 已有日志基础设施（console 输出） |
| `.logs/` | 项目根目录 | 已存在但为空目录 |

### 3.2 关键代码发现

**ChatPanel.vue:72** — messages 监听：
```typescript
watch(messages, scrollToBottom, { deep: true })
```

**transports.ts:174-191** — ensureChat 核心逻辑：
```typescript
async function ensureChat(): Promise<Chat<UIMessage> | null> {
  if (!isConfigured.value) return null
  const store = getActiveEditorStore()
  if (currentChatStore && chat) {
    currentChatMessages.set(currentChatStore, chat.messages)
  }
  if (!chat || transportDirty || currentChatStore !== store) {
    const messages = currentChatMessages.get(store)
    const transport: ChatTransport<UIMessage> = isACPProvider.value
      ? await createActiveACPTransport()
      : createTransport(store)
    chat = new Chat<UIMessage>({ transport, messages })
    currentChatStore = store
    transportDirty = false
  }
  return chat
}
```

**capabilities/default.json** — 已有 FS 权限：
```json
{
  "identifier": "fs:allow-write-file",
  "allow": [{ "path": "**" }]
},
{
  "identifier": "fs:allow-mkdir",
  "allow": [{ "path": "**" }]
}
```

### 3.3 第三方最佳实践

**Vercel AI 官方（Context7 查询结果）**：
- 使用 `onEnd` 回调在 stream 结束时保存完整消息
- 使用 `toUIMessageStream` 包装 stream，在 `onEnd: ({ messages }) => saveChat({ chatId, messages })` 时触发保存
- 保存格式为 JSON 序列化的 `UIMessage[]`

**Tauri 官方（Context7 查询结果）**：
- 使用 `@tauri-apps/plugin-fs` 的 `writeTextFile` + `BaseDirectory.AppLocalData`
- 写入前使用 `mkdir` 确保目录存在，`recursive: true` 创建嵌套目录
- 生产模式推荐写入 `$APPDATA` 目录

**GitHub CLI 参考**：
- 日志文件命名规范：`{timestamp}_{provider}.log`
- 按日期目录组织：`YYYY-MM-DD/{timestamp}_{provider}.log`

---

## 四、设计的方案

### 4.1 核心架构

```
transports.ts (createChatSessionManager)
    │
    ├── 新增: ChatPersistenceManager 单例
    │       ├── dev 模式: 写入 .logs/YYYY-MM-DD/
    │       └── prod 模式: 写入 $APPDATA/.logs/YYYY-MM-DD/ + 注册历史查看器
    │
    └── 修改: ensureChat() 返回后，自动订阅 messages 变化
              当 status === 'ready' 且有新增消息时 → 触发保存
```

### 4.2 日志文件组织

**开发模式（项目内）**：
```
.open-pencil/.logs/
  2026-08-11/
    14-30-25_anthropic.log      ← HH-mm-ss_providerID.log
    14-35-10_openai.log
  2026-08-10/
    09-15-30_anthropic.log
```

**生产模式（$APPDATA）**：
```
$APPDATA/.logs/
  2026-08-11/
    14-30-25_anthropic.json     ← HH-mm-ss_providerID.json
    14-35-10_openai.json
  2026-08-10/
    09-15-30_anthropic.json
```

### 4.3 日志格式

| 模式 | 格式 | 理由 |
|------|------|------|
| dev | `serializeChatLog()` 文本 | 便于开发者直接查看和调试 |
| prod | 完整 `UIMessage[]` JSON | 便于历史查看器程序解析和展示 |

### 4.4 保存触发时机

```typescript
// 当 chat.status === 'ready' 且 messages 有新增时触发保存
// 符合 Vercel AI 官方的 onEnd 回调最佳实践
watch(
  () => [chat.value?.status, messages.value.length],
  ([status, msgLen]) => {
    if (status === 'ready' && msgLen > lastSavedLength) {
      persistenceManager.save(chatId, messages.value, providerID.value)
      lastSavedLength = msgLen
    }
  }
)
```

---

## 五、备选方案

### 方案 A：ChatPanel watcher 触发（简单直接）

在 `ChatPanel.vue` 的 `watch(messages, ...)` 中增加保存逻辑。

**优点**：实现简单，借助现有 watcher
**缺点**：
- 写入时机不可控（可能 stream 未完成时就触发）
- ChatPanel 承担了 UI + 持久化两种职责（违反单一职责）
- 打包版和开发版需要不同处理逻辑

**结论**：不采用

### 方案 B：Session Manager 层拦截（推荐）

在 `createChatSessionManager()` 中扩展，注入消息持久化逻辑。

**优点**：
- 持久化逻辑集中在一个地方，与 UI 解耦
- 可以区分"开发模式"和"生产模式"
- 更容易扩展日志查看功能
- 符合 Vercel AI 官方 `onEnd` 回调的最佳实践

**缺点**：需要修改 transports.ts，对 session manager 有一定侵入

**结论**：采用

### 方案 C：独立的 PersistenceService（最干净）

创建独立的 `ChatPersistenceService`，通过事件总线与 Chat 通信。

**优点**：完全解耦，测试友好
**缺点**：引入新服务，增加复杂度，对现有架构改动最大

**结论**：后续考虑

---

## 六、具体实施清单

### Phase 1（本次实施）

```markdown
1. [新增] src/app/ai/chat/persistence.ts
   - 创建 ChatPersistenceManager 单例类
   - save(chatId, messages, providerID): Promise<void>
   - dev 模式: 写入 .logs/YYYY-MM-DD/HH-mm-ss_providerID.log
   - prod 模式: 写入 $APPDATA/.logs/YYYY-MM-DD/HH-mm-ss_providerID.json
   - ensureLogDir(datePath): Promise<void>
   - loadHistories(): Promise<ChatHistoryEntry[]>
   - loadHistoryFile(path): Promise<string>

2. [修改] src/app/ai/chat/transports.ts
   - 导入 ChatPersistenceManager 和 IS_DEV
   - 在 createChatSessionManager 返回对象中新增 persistenceManager
   - 修改 ensureChat(): 注册 messages 监听，当 status === 'ready' 且消息有新增时触发 save

3. [修改] src/components/ChatPanel.vue
   - 将 "Copy log" 按钮的 v-if="IS_DEV" 改为 v-if="!IS_DEV"
   - 添加 "History" 按钮（仅 !IS_DEV），点击打开 ChatHistoryDialog
   - 导入并使用 ChatHistoryDialog

4. [新增] src/components/chat/ChatHistoryDialog.vue
   - 使用 Reka UI Dialog 组件
   - 左侧: 日期分组的历史日志列表
   - 右侧: 选中日志的预览内容
   - 支持按日期筛选、Export 导出

5. [新增] src/components/chat/ChatHistoryItem.vue
   - 接收 historyEntry: ChatHistoryEntry prop
   - 显示时间、provider icon、消息数量
   - emits: select 事件

6. [修改] desktop/capabilities/default.json
   - 确认 fs:allow-write-file, fs:allow-mkdir, fs:allow-read-file 权限
   - 如需限制路径，添加 fs:scope 限定 $APPDATA/.logs/**/*

7. [测试] dev 模式和 prod 模式功能验证
   - dev: .logs/YYYY-MM-DD/ 下生成日志文件
   - prod: History 按钮、对话框功能正常
```

### Phase 2（后续实施）

- 日志轮转：超过 30 天的日志自动清理
- 日志查看器增加搜索和删除功能

---

## 七、风险评估

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 写入失败（磁盘满/权限） | 低 | 中 | try-catch + console.warn，不阻塞对话 |
| 生产模式日志路径配置错误 | 中 | 高 | 使用 Tauri BaseDirectory.AppLocalData |
| 大会话日志文件过大 | 中 | 低 | 日志轮转 + 截断机制 |
| 侵入性修改影响现有 session 管理 | 低 | 高 | 仅扩展，不修改现有 ensureChat 核心逻辑 |

---

## 八、确认事项

1. 是否需要保留 "Copy log" 按钮的原有复制到剪贴板功能？
   - **建议**：dev 模式保留，prod 模式移除（已被 History 按钮替代）

2. 生产模式历史查看器是否需要支持删除单条历史记录？
   - **建议**：Phase 2 再实现，Phase 1 仅查看和导出

3. 日志保留策略：默认保留 30 天还是 90 天？
   - **建议**：Phase 1 不实现，Phase 2 按需添加

4. 是否需要将 .logs 目录加入 .gitignore？
   - **建议**：是，`.logs/` 应被 gitignore，避免提交到仓库
