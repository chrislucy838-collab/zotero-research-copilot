# Provider Configuration

Zotero Research Copilot supports manually configured API endpoints using the same five protocol formats as the Settings selector: OpenAI Compatible, Google Gemini, Anthropic Messages, OpenAI Responses, and ChatGPT Codex (Plus/Pro). The project does not provide a project-owned proxy.

## Configure an endpoint

Open the **Setting** tab in the panel or open **Tools → Add-ons → Zotero Research Copilot → Settings**. Configure the provider profile with:

- **Provider name**: a label shown in the model list;
- **API type**: choose the protocol implemented by the endpoint: **OpenAI Compatible**, **Google Gemini**, **Anthropic Messages**, **OpenAI Responses**, or **ChatGPT Codex (Plus/Pro)**;
- **API Base URL**: the root URL of the selected endpoint;
- **API Key**: optional when the endpoint does not require authentication;
- **Custom headers**: optional JSON headers for gateways with non-standard authentication;
- **Model**: fetched from `/models` or entered manually.

Example:

```text
Provider name: Local Ollama
API Base URL: http://127.0.0.1:11434/v1
API Key: leave empty when not required
Model: llama3.1:8b
```

The endpoint normally needs to support:

- `GET /models` for model discovery, if automatic discovery is desired;
- `POST /chat/completions` when **OpenAI Compatible** is selected;
- `POST /responses` when **OpenAI Responses** is selected;
- compatible multimodal endpoints only when those operations are used.

Local endpoints such as Ollama, LM Studio, and vLLM may work when configured with their OpenAI-compatible API surface. Hosted gateways may require a custom header or a provider-specific model ID.

## Model selection

The Settings pane can fetch available models, test model availability, and select which models appear in the Discussion picker. Separate model choices can be kept for selection translation and other model-aware workflows. Reasoning, image input, image generation, and streaming support vary by model.

## Data handling

Requests go directly from Zotero to the endpoint configured by the user. The provider receives the context and attachments included in a request, so review its privacy and retention policy before sending sensitive research material.

API keys and custom headers should be configured after installation. They are intentionally excluded from the source repository and release package.
