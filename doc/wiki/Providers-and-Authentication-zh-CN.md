# 提供商配置

Zotero Research Copilot 支持手动配置 API 端点，设置页提供五种协议格式：OpenAI Compatible、Google Gemini、Anthropic Messages、OpenAI Responses 和 ChatGPT Codex (Plus/Pro)。项目没有自建的模型代理。

## 配置端点

打开面板中的 **Setting** 标签，或进入 **工具 → 附加组件 → Zotero Research Copilot → 设置**，配置模型连接：

- **提供商名称**：显示在模型列表中的标签；
- **API 类型**：选择端点实际实现的协议：**OpenAI Compatible**、**Google Gemini**、**Anthropic Messages**、**OpenAI Responses** 或 **ChatGPT Codex (Plus/Pro)**；
- **API Base URL**：所选端点的基础地址；
- **API Key**：端点不要求认证时可以留空；
- **自定义请求头**：为非标准认证网关填写 JSON 格式的 HTTP 请求头；
- **Model**：从 `/models` 获取，或手动输入模型 ID。

示例：

```text
提供商名称：本地 Ollama
API Base URL：http://127.0.0.1:11434/v1
API Key：不需要认证时留空
Model：llama3.1:8b
```

端点通常需要支持：

- `GET /models`，用于自动获取模型列表；
- 选择 **OpenAI Compatible** 时使用 `POST /chat/completions`；
- 选择 **OpenAI Responses** 时使用 `POST /responses`；
- 使用多模态时所需的兼容接口。

只要暴露了预期的 OpenAI 兼容接口，Ollama、LM Studio、vLLM 等本地服务以及托管网关都有可能使用。某些网关可能需要自定义请求头或特定模型 ID。

## 模型选择

设置界面可以获取模型列表、测试模型可用性、选择显示在 Discussion 模型菜单中的模型，并为划词翻译等功能保存独立的模型选择。不同模型的推理、图片输入、图片生成和流式能力可能不同。

## 数据处理

请求从 Zotero 直接发送到用户配置的端点。端点会收到请求中包含的上下文和附件，发送敏感研究材料前请先查看对应服务的隐私和数据保留政策。

API Key 和自定义请求头应在安装后本地配置，它们不会写入源代码或 Release XPI。
