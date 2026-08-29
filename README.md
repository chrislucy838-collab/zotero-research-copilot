<p align="center">
  <img src="addon/content/icons/icon-96.png" alt="Zotero Research Copilot logo" width="88" />
</p>

<h1 align="center">Zotero Research Copilot</h1>

<p align="center">
  A research workspace for reading, discussing, discovering, and organizing papers inside Zotero.
</p>

<p align="center">
  <a href="./README.md">English</a>
  · <a href="./doc/readme/README.zh-CN.md">简体中文</a>
  · <a href="./doc/readme/README.zh-TW.md">繁體中文</a>
  · <a href="./doc/readme/README.ja.md">日本語</a>
  · <a href="./doc/readme/README.ko.md">한국어</a>
  · <a href="./doc/readme/README.fr.md">Français</a>
</p>

<p align="center">
  <a href="https://github.com/chrislucy838-collab/zotero-research-copilot/releases"><strong>Download the latest XPI</strong></a>
  · <a href="https://github.com/chrislucy838-collab/zotero-research-copilot/issues">Issues</a>
  · <a href="https://github.com/chrislucy838-collab/zotero-research-copilot/discussions">Discussions</a>
</p>

> **Current scope:** this distribution targets Zotero 10.x. It is an independent build derived from open-source Zotero AI projects; the original attribution and licenses are retained in [LICENSE](./LICENSE), [CUSTOMIZATION.md](./CUSTOMIZATION.md), and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## What it does

Zotero Research Copilot keeps an AI conversation beside the Zotero item or reader you are already using. It can use the active paper, selected passages, additional papers, images, and uploaded files as context, while keeping conversations and memory in Zotero's local data directory.

### Research chat

- Chat in the Zotero Library item pane or PDF/EPUB reader sidebar.
- Use the active paper as context and add selected reader text with **Add Text**.
- Add multiple papers with `@` references or from a Zotero collection. The context picker keeps the selected papers visible and attributed.
- Follow evidence-oriented answers with paper/page citations when the model provides them; citation markers can be linked back to the relevant evidence in the panel.
- Continue, rename, pin, delete, branch, edit, retry, export, or save conversations as native Zotero notes.
- Use configurable quick actions such as summarizing, explaining, comparing, and translating.

### PDF and EPUB context

- Extract and retrieve bounded context from PDF and EPUB attachments instead of sending an entire book by default.
- Preserve EPUB navigation and section structure when it is available.
- Use deterministic section routing for explicit chapter or section requests, then retrieve relevant chunks locally.
- Keep document context separate from supplemental paper context so the source of an answer remains visible.

### Files and images

- Paste, drag, or upload text, Markdown, code, PDF, and image files through the composer.
- Capture a region from the active reader to discuss a figure, table, or chart.
- Use multimodal models when the selected provider and model support image input.
- Explicit image generation is supported for compatible provider flows; availability depends on the provider, model, and endpoint.

### Paper discovery and import

The **Discover** tab searches public scholarly indexes and lets you review results before writing anything to Zotero:

- OpenAlex
- Semantic Scholar
- Crossref

Results are deduplicated across sources and show metadata, DOI, venue, authors, and PDF availability when known. You choose which records to import and may target **My Library** or an existing/new Zotero collection. Existing items are detected before import. PDF attachment retrieval is attempted when a source exposes a usable open-access URL, but it is not guaranteed.

### Selection translation

- Translate selected text from the PDF or EPUB reader using the shared model list.
- PDF selection translation can prepare a local paper overview and terminology cache on first use; later selections reuse it.
- EPUB selection translation uses bounded context around the selected passage.
- Configure automatic translation, source and target languages, the model, and whether the popup offers copy or note actions.

The repository also contains a PDF translation controller and related runtime code. It is not part of the currently supported three-tab interface, so it is deliberately not presented as a stable end-user feature here.

### Current interface and local persistence

- Conversations, attachments, memory, and related metadata are stored locally in Zotero's SQLite data.
- Per-library conversation scope prevents unrelated libraries from sharing paper context.
- Memory retrieval uses local storage, deduplication, relevance ranking, and prompt-injection filtering.
- The supported panel currently exposes **Discussion**, **Discover**, and **Setting** tabs. Experimental modules that are not wired into this interface are not advertised as supported features.
- Responses render Markdown, code blocks, tables, links, images, and LaTeX; responses and complete chat histories can be saved to Zotero notes.
- The interface supports English, Simplified Chinese, Traditional Chinese, Japanese, Korean, French, German, Spanish, Russian, Portuguese, Arabic, and Hindi.

## Connecting a model

Open **Tools → Add-ons → Zotero Research Copilot → Settings**. Depending on the Zotero build, the preference pane may also appear under **Edit → Settings**.

There are two connection paths:

### OAuth providers

The Settings pane currently exposes OAuth cards for:

| Provider       | Flow                    | Notes                                                                      |
| -------------- | ----------------------- | -------------------------------------------------------------------------- |
| ChatGPT        | OpenAI Codex OAuth      | The plugin can install/update the required local environment and CLI flow. |
| Gemini         | Google Gemini CLI OAuth | The plugin can install/update the required local environment and CLI flow. |
| GitHub Copilot | Device Code OAuth       | Does not require the Node.js setup step used by the CLI-based flows.       |

Typical order:

1. Click **Install/Update Env** when the provider requires its local CLI environment.
2. Click **OAuth Login** and complete the provider's browser authorization.
3. Click **Refresh Models**, then select the models that should appear in the chat picker.

OAuth tokens are kept locally by the plugin. OAuth access through CLI credentials may not be an officially endorsed use of a provider account; read the warning in the plugin before continuing and check the provider's terms.

### OpenAI-compatible API

Switch the primary connection mode to **API Mode** and configure:

| Field          | Required                | Example                                                     |
| -------------- | ----------------------- | ----------------------------------------------------------- |
| API Base URL   | Yes                     | `https://api.openai.com/v1` or `http://127.0.0.1:11434/v1`  |
| Model          | Yes                     | `gpt-4.1-mini` or `llama3.1:8b`                             |
| API Key        | Depends on the endpoint | Leave empty for an unauthenticated local endpoint.          |
| Custom headers | Optional                | JSON headers for gateways with non-standard authentication. |

The endpoint must provide the API shape required by the selected operation, normally `/models` and `/chat/completions`. Provider-specific features are not guaranteed by compatibility alone. Local, self-hosted, and hosted gateways such as Ollama, LM Studio, vLLM, OpenRouter, DeepSeek-compatible gateways, and similar services may work when they expose the expected API.

## Installation

### Requirements

- Zotero **10.0–10.x**
- A configured OAuth provider or OpenAI-compatible endpoint
- Node.js for the provider flows that require a local CLI environment; the plugin can guide you through setup
- Internet access for OAuth, hosted model APIs, and scholarly-index searches

### Install or upgrade

1. Download `Zotero-Research-Copilot-<version>.xpi` from [Releases](https://github.com/chrislucy838-collab/zotero-research-copilot/releases).
2. In Zotero, open **Tools → Add-ons**.
3. Open the gear menu and choose **Install Add-on From File…**.
4. Select the downloaded XPI and restart Zotero if prompted.
5. Configure a provider in **Zotero Research Copilot Settings** before starting a chat.

Install a newer XPI over the existing installation to upgrade. The plugin stores its chat history, memory, and settings in Zotero's local data; nevertheless, back up important Zotero data before testing development builds.

## Privacy and security

- The plugin does not include a telemetry service or a project-owned proxy.
- API requests go from Zotero to the provider or endpoint selected by the user.
- API keys, custom headers, and OAuth credentials are configured locally and are not hardcoded into the source or release XPI.
- Chat history, memory, and local attachment metadata are stored in Zotero's local database/data directory.
- When you use a third-party model, the selected context, uploaded files, and images are sent to that provider according to its API and privacy policy.
- Do not include secrets or confidential documents in a request unless you understand the provider's data handling.

## Development

```bash
npm install
npm run build       # TypeScript check and official production XPI build
npm run test:unit   # Unit tests that do not require a running Zotero UI
npm start           # Development server/profile workflow
```

The generated build directory and XPI are intentionally ignored by Git. Releases are produced by GitHub Actions when a new `v*` tag is pushed; the XPI is attached to the versioned GitHub Release and `update.json` is maintained in the `release` prerelease.

Useful project documents:

- [Customization notes](./CUSTOMIZATION.md)
- [Architecture guide](./doc/ARCHITECTURE_EN.md)
- [中文架构说明](./doc/ARCHITECTURE_CN.md)
- [Third-party notices](./THIRD_PARTY_NOTICES.md)

## License and attribution

Zotero Research Copilot is distributed under [AGPL-3.0-or-later](./LICENSE). It is an independent build derived from open-source work, including [llm-for-zotero](https://github.com/yilewang/llm-for-zotero) and source from the AIdea project. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for the attribution and additional licenses.

<p align="center">
  Maintained for the Zotero Research Copilot project
</p>
