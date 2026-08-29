# Providers and Authentication

Zotero Research Copilot supports provider-specific OAuth flows and a generic OpenAI-compatible API mode. Choose the path that matches your account and endpoint.

## OAuth providers

| Provider       | Flow                    | Local requirement                                                      |
| -------------- | ----------------------- | ---------------------------------------------------------------------- |
| ChatGPT        | OpenAI Codex OAuth      | Node.js and the Codex CLI environment may be installed by the plugin.  |
| Gemini         | Google Gemini CLI OAuth | Node.js and the Gemini CLI environment may be installed by the plugin. |
| GitHub Copilot | Device Code OAuth       | No CLI setup step is required by the Copilot flow.                     |

### Typical setup

1. In Setting, click **Install/Update Env** for a provider that needs its CLI environment.
2. Click **OAuth Login**.
3. Complete authorization in the browser, or enter the displayed device code when prompted.
4. Click **Refresh Models**.
5. Select the models that should appear in Discussion and other model-aware features.

OAuth credentials are stored locally. The plugin communicates with provider APIs using the credentials resolved for the selected provider. OAuth access through CLI credentials may not be an officially endorsed use of an account; read the in-plugin notice and the provider's terms before continuing.

The environment updater can check for updates and may show a notification according to the configured update mode. It does not upload the credentials to the project repository.

## OpenAI-compatible API mode

API Mode uses one or more locally configured profiles. A profile can contain:

- provider label;
- API Base URL;
- API Key;
- optional custom HTTP headers as JSON;
- model IDs fetched from `/models` or added manually.

A typical setup is:

```text
API Base URL: https://api.example.com/v1
Model: model-id
API Key: optional, depending on the service
```

The endpoint normally needs to support:

- `GET /models` for model discovery, if automatic discovery is desired;
- `POST /chat/completions` for standard streaming chat;
- compatible multimodal or image-generation endpoints only when those operations are used.

Local endpoints such as Ollama, LM Studio, and vLLM may work when configured with their OpenAI-compatible API surface. Hosted gateways may require a custom header or a provider-specific model ID.

## Model selection

The Settings pane can fetch available models, test model availability, select which models appear in the Discussion picker, and keep separate model choices for selection translation and other workflows. Model capability varies: reasoning, image input, image generation, and streaming support are not guaranteed for every model.

## Data handling

The plugin does not provide a project-owned API proxy or telemetry service. Requests go directly from Zotero to the selected provider or endpoint. The provider receives the context and attachments included in a request, so review its privacy and retention policy before sending sensitive research material.

API keys, custom headers, and OAuth credentials should be configured after installation. They are intentionally excluded from the source repository and release package.
