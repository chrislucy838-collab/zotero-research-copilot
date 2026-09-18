## What's changed

- Added an evidence mode toggle in the bottom-left action slot, replacing the former bottom new-chat button. The existing top-right new-chat control is unchanged.
- Evidence mode is gray when disabled and blue when enabled, and its state is kept per conversation.
- When enabled, all papers in the current conversation context share one evidence pool. Paper-backed claims receive precise `[Paper N, p. X]` citations that become clickable book icons in the reply.
- Clicking an evidence icon opens the matching Zotero Reader PDF page and applies temporary text highlighting. A bounded evidence-overlap fallback is used when a model omits the citation marker but the answer clearly overlaps a page-backed excerpt.
- Evidence mode metadata is persisted with conversation context and restored when the conversation is reopened.

- Rolled back the experimental Reader paper-chip double-click navigation introduced after v0.10.18. The stable v0.10.18 Reader behavior is restored; no Paper 1/Paper 2 cross-tab switching or temporary Reader chip is included in this version.
- Preserved the later Zotero 10.0.x compatibility metadata and existing API, Discover, and provider features.

- Replaced the Reader panel host model: the plugin no longer moves or reuses a chat DOM host across Reader tabs. Each Zotero ItemPaneManager body now owns its own rendering lifecycle, avoiding duplicate Context Pane controls and the double-arrow artifact in the conversation index.
- Made each Reader body the authoritative workspace key instead of relying on the globally selected tab during asynchronous rendering.
- Fixed existing Paper 2 tabs: when Zotero selects an already-open target tab, its chat body now consumes the Paper 1 navigation owner before the marker is cleared.
- Kept Paper 2 as a temporary blue current-reading chip and Paper 1 as the persistent red conversation owner.

- Fixed Reader host lifecycle races that could reinitialize a destination tab with Paper 2 as the conversation owner. Paper 1 remains the conversation owner during existing-tab and new-tab navigation.
- Added an explicit temporary blue Paper 2 chip for the active Reader document, including the collapsed/expanded paper list. It is display-only and never enters Paper 1's persisted context.
- Kept the Paper 1 fixed chip red across Reader navigation and return trips.

- Fixed the final conversation-owner bug: double-clicking Paper 2 now keeps Paper 1's conversation history, fixed context, draft, and red chip while Paper 2 remains only the blue active Reader document.

- Fixed a final Reader navigation race so the target tab's completed workspace is used when clearing pending navigation state.
- Preserved Paper 1 as the red fixed context and Paper 2 as the blue current reading context across existing and newly created Reader tabs.

- Fixed Reader navigation blank panels by isolating panel hosts per Reader tab and preserving the Paper 1 conversation owner.
- Paper 1 remains the red fixed context while the navigated Paper 2 is shown as the blue current reading context.

- Fixed Reader paper round trips: returning to the original paper no longer leaves the plugin blank or unloaded after double-click navigation.
- Preserved the original chat workspace owner and cleared failed navigation state before the next Reader transition.

- Fixed Zotero compatibility metadata for Zotero 10.0.x, including the install and update manifest maximum version.

- Fixed paper-chip navigation so double-clicking a reference changes only the left Reader document while preserving the original right-side chat conversation, history, fixed context papers, and draft.
- Reused the original chat workspace for the one navigation transition without permanently binding it to other Reader tabs.

- Added double-click navigation for paper context chips and expanded paper rows: the Zotero Reader switches to the selected paper without opening a new window or duplicate reader tab.
- Preserved the active chat conversation, fixed paper context collection, attachments, screenshots, draft text, and compose state while switching the current paper for reading.
- Added current-paper highlighting and Reader navigation tests.

- Added automatic `x-opencode-session` headers for OpenCode Go requests, using a stable ID per conversation.
- Preserved a user-supplied `x-opencode-session` custom header when present.

- Aligned the Settings API type selector with the five protocol formats used by HanaAgent:
  - OpenAI Compatible
  - Google Gemini
  - Anthropic Messages
  - OpenAI Responses
  - ChatGPT Codex (Plus/Pro)
- Added native request construction for Gemini, Anthropic Messages, and Codex Responses.
- Added protocol-aware model discovery for Gemini and Anthropic endpoints.
- Kept legacy `openai-compatible` preferences compatible by migrating them to OpenAI Compatible.
- Preserved the existing OpenAI Responses behavior and exact API type labels.
- Added Discover's Extract references workflow for extracting bibliography entries, finding metadata, and importing selected matches.
- Added reference selection controls, unmatched-result reporting, and batched metadata searches.
- Fixed duplicated reference numbering and normalized Discover checkbox sizing.
- Improved Extract references search with focused title queries, DOI lookups, fallback queries, and candidate ranking.
- Fixed multiple numbered references being merged when PDF text extraction concatenates columns onto one line.
- Improved reference splitting reliability for consecutive numbering and two-column PDF text.
- Kept extracted references visible while accumulating search results, with incremental searches for newly selected references.
- Separated extracted references from search results and added per-reference match status.
- Placed search results above the extracted reference list for a shorter import workflow.
- Improved reference matching with exact arXiv identification, title extraction, and strict candidate verification.
- Verified the complete unit test suite and production XPI build.

## 更新内容

- 回退 v0.10.18 之后引入的实验性论文 chip 双击 Reader 导航功能，恢复稳定的 v0.10.18 Reader 行为。本版本不再包含 Paper 1/Paper 2 跨标签切换或临时 Reader 条目。
- 保留后续加入的 Zotero 10.0.x 兼容性元数据，以及 API、Discover 和 provider 功能。

- 替换 Reader 面板宿主模型：插件不再跨 Reader 标签页搬运或复用聊天 DOM host。每个 Zotero ItemPaneManager body 独立拥有自己的渲染生命周期，避免 Context Pane 控件重复与对话索引双箭头残影。
- Reader 异步渲染改为以当前 body 作为唯一工作区键，不再依赖全局已选标签页。
- 修复 Paper 2 已有标签页：Zotero 选中已打开的目标标签时，该 body 会先消费 Paper 1 的导航 owner，再清除一次性标记。
- Paper 2 继续只是临时蓝色当前阅读条目，Paper 1 继续是持久红色对话 owner。

- 修复 Reader host 生命周期时序问题：目标标签页初始化时不再错误地将 Paper 2 设为对话 owner；已有和新建标签页导航都保持 Paper 1 为对话 owner。
- 为当前 Reader 文档增加明确的临时蓝色 Paper 2 条目，普通显示和折叠展开列表均可见；它只用于显示和导航，不会进入 Paper 1 的持久化上下文。
- Reader 导航和返回过程中，Paper 1 固定条目持续保持红色。

- 修复最后一个对话归属问题：双击 Paper 2 后继续使用 Paper 1 的对话历史、固定上下文、草稿和红色条目，Paper 2 仅作为蓝色当前 Reader 文档。

- 修复 Reader 导航最后一个时序问题：清理 pending 状态时使用目标 tab 已完成的 workspace，避免目标面板残留或串台。
- 在已有和新建 Reader 标签页中，始终保持 Paper 1 为红色固定论文、Paper 2 为蓝色当前阅读论文。

- 修复 Reader 导航后面板空白：按 Reader tab 隔离面板宿主，并保持 Paper 1 作为原始会话归属。
- Paper 1 始终显示为红色固定论文，跳转后的 Paper 2 显示为蓝色当前阅读论文。

- 修复 Reader 论文往返切换：双击导航后返回原论文，不再出现插件空白或无法加载。
- 保持原始聊天工作区归属，并在 Reader 导航失败时清理状态，避免影响下一次切换。

- 修复 Zotero 10.0.x 的兼容性元数据，包含安装清单和自动更新清单中的版本上限。

- 修复论文芯片导航：双击参考论文时只切换左侧 Reader 文档，右侧仍保留原论文对话、历史、固定论文集合和输入草稿。
- 导航过程只临时复用原聊天工作区，不会永久绑定到其他 Reader 标签页。

- 新增论文上下文芯片和展开论文行的双击阅读：Zotero Reader 会切换到选中的论文，不打开新窗口，也不创建重复阅读标签页。
- 切换阅读论文时保留当前对话、固定论文集合、附件、截图、输入草稿和组合状态；当前阅读论文会同步高亮。
- 新增 Reader 导航与状态保持测试。

- 为 OpenCode Go 请求自动添加 `x-opencode-session`，并按对话保持稳定 ID。
- 用户手动填写同名自定义请求头时保留用户配置。

- 设置页的 API 类型选择现在与 HanaAgent 使用的五种协议格式一致：
  - OpenAI Compatible
  - Google Gemini
  - Anthropic Messages
  - OpenAI Responses
  - ChatGPT Codex (Plus/Pro)
- 新增 Gemini、Anthropic Messages 和 Codex Responses 的原生请求构造。
- Gemini 和 Anthropic 端点支持按协议获取模型列表。
- 旧版 `openai-compatible` 配置会自动迁移为 OpenAI Compatible，原有配置继续可用。
- 保留 OpenAI Responses 的现有行为和准确的 API 类型名称。
- Discover 新增 Extract references 流程，可提取参考文献、检索元数据并导入选中的匹配结果。
- 新增参考文献全选/清空、未匹配提示和分批元数据检索。
- 修复参考文献重复序号，并统一 Discover 复选框尺寸。
- 改进 Extract references 检索，支持标题提取、DOI 精确查询、备用查询和候选排序。
- 修复 PDF 文本提取把同一行中的多条编号参考文献合并成一条的问题。
- 增强连续编号和双栏 PDF 文本的参考文献拆分可靠性。
- 搜索后保留已识别的参考文献列表，支持只检索新勾选的文献并累积结果。
- 将识别列表与搜索结果分区显示，并为每条引用显示匹配状态。
- 将搜索结果调整到参考文献列表上方，缩短导入操作路径。
- 改进参考文献匹配，支持精确识别 arXiv、提取标题并严格验证候选论文。
- 已通过完整单元测试和生产 XPI 构建验证。
