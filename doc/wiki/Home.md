# Zotero Research Copilot

Zotero Research Copilot is an open-source AI research workspace for Zotero 10.x. It places a model-powered discussion panel beside Zotero items and PDF/EPUB readers, with local conversation history, document context, paper discovery, and configurable model connections.

## What it provides

- Discussion in the Zotero Library item pane and PDF/EPUB reader sidebar
- Bounded PDF/EPUB context and selected-text context
- Multiple-paper context using `@` references or Zotero collections
- Evidence-aware paper attribution and citation links when the answer contains supported markers
- File upload, clipboard paste, drag and drop, reader-region screenshots, and multimodal input
- OpenAlex, Semantic Scholar, and Crossref search in the Discover tab
- Duplicate-aware metadata import into My Library or a Zotero collection
- Selection translation for PDF and EPUB text
- ChatGPT/Codex, Gemini CLI, and GitHub Copilot OAuth flows
- OpenAI-compatible API endpoints for hosted or local models
- Local chat history, memory, Markdown/LaTeX rendering, and Zotero note export

## Start here

1. [Getting Started](./Getting-Started.md)
2. [Providers and Authentication](./Providers-and-Authentication.md)
3. [Features and Workflow](./Features-and-Workflow.md)
4. [FAQ](./FAQ.md)

## Important scope notes

- The supported distribution targets Zotero **10.0–10.x**.
- This project does not provide a project-owned model proxy or telemetry service.
- Requests, selected context, uploaded files, and images go to the provider or endpoint chosen by the user.
- Paper-index search uses public services and can fail or return incomplete metadata.
- Open-access PDF attachment retrieval is best effort.

## Links

- Repository: <https://github.com/chrislucy838-collab/zotero-research-copilot>
- Releases: <https://github.com/chrislucy838-collab/zotero-research-copilot/releases>
- Issues: <https://github.com/chrislucy838-collab/zotero-research-copilot/issues>
- Discussions: <https://github.com/chrislucy838-collab/zotero-research-copilot/discussions>
- [中文首页](./Home-zh-CN.md)

The project is an independent build derived from open-source Zotero AI work. See the repository's [license](../../LICENSE), [customization notes](../../CUSTOMIZATION.md), and [third-party notices](../../THIRD_PARTY_NOTICES.md).
