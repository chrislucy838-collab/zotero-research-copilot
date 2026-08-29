# 提供商与授权

Zotero Research Copilot 支持提供商专用的 OAuth 流程，也支持通用的 OpenAI 兼容 API。请根据你的账号或接口选择连接方式。

## OAuth 提供商

| 提供商         | 授权方式                | 本地要求                                              |
| -------------- | ----------------------- | ----------------------------------------------------- |
| ChatGPT        | OpenAI Codex OAuth      | 需要时插件可以安装或更新 Node.js 与 Codex CLI 环境。  |
| Gemini         | Google Gemini CLI OAuth | 需要时插件可以安装或更新 Node.js 与 Gemini CLI 环境。 |
| GitHub Copilot | Device Code OAuth       | Copilot 流程不需要 CLI 环境安装步骤。                 |

### 常规设置流程

1. 对需要本地 CLI 环境的 provider 点击 **安装/更新环境**。
2. 点击 **OAuth 登录**。
3. 在浏览器中完成授权；如果显示 device code，按提示完成设备授权。
4. 点击 **刷新模型**。
5. 勾选需要显示在 Discussion 以及其他模型功能中的模型。

OAuth 凭据保存在本地。通过 CLI 凭据使用 OAuth 可能不属于服务商明确认可的账号使用方式；继续前请阅读插件里的授权提示和服务商条款。

环境更新器可以按照设置检查本地 OAuth 环境，并根据更新模式显示通知。它不会把凭据上传到项目仓库。

## OpenAI 兼容 API

API 方式可以配置一个或多个本地模型配置。每个配置可以包含：

- 提供商标签；
- API Base URL；
- API Key；
- JSON 格式的自定义 HTTP 请求头；
- 从 `/models` 获取或手动添加的模型 ID。

示例：

```text
API Base URL: https://api.example.com/v1
Model: model-id
API Key: 根据服务需要填写
```

端点通常需要支持：

- `GET /models`，用于自动发现模型；
- `POST /chat/completions`，用于标准流式对话；
- 使用多模态或图片生成时所需的兼容接口。

只要暴露了预期的 OpenAI 兼容接口，Ollama、LM Studio、vLLM 等本地服务以及托管网关都有可能使用。某些网关可能需要自定义请求头或特定模型 ID。

## 模型选择

设置界面可以获取模型列表、测试模型可用性、选择显示在 Discussion 模型菜单中的模型，并为划词翻译等功能保存独立的模型选择。不同模型的推理、图片输入、图片生成和流式能力可能不同。

## 数据处理

插件没有项目自建的 API 代理或遥测服务。请求从 Zotero 直接发送到用户选择的 provider 或端点。provider 会收到请求中包含的上下文和附件，发送敏感研究材料前请先查看其隐私和数据保留政策。

API Key、自定义请求头和 OAuth 凭据应在安装后本地配置，它们不会写入源代码或 Release XPI。
