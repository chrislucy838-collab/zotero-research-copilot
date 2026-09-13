## What's changed

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
- Verified the complete unit test suite and production XPI build.

## 更新内容

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
- 已通过完整单元测试和生产 XPI 构建验证。
