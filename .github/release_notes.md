## What's changed

- Added an **API type** selector in Settings.
- Added **OpenAI Compatible** for Chat Completions endpoints.
- Added **OpenAI Responses** for Responses API endpoints.
- Selecting OpenAI Responses automatically uses `/responses` when the API Base URL ends at `/v1`.
- Existing installations keep the OpenAI Compatible type by default.
- Improved paper context labels and collection-name normalization.
- Fixed the local test suite and verified the production XPI build.

## 更新内容

- 在设置页面新增 **API 类型** 选择。
- 新增 **OpenAI Compatible**，用于 Chat Completions 接口。
- 新增 **OpenAI Responses**，用于 Responses API 接口。
- 选择 OpenAI Responses 后，如果 API Base URL 填写到 `/v1`，插件会自动使用 `/responses`。
- 旧版本升级后默认保持 OpenAI Compatible，不会改变原有连接方式。
- 改进论文上下文标签和集合名称规范化。
- 已通过完整单元测试和生产 XPI 构建验证。
