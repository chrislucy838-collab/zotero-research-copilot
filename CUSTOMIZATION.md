# Zotero Research Copilot Customization Notes

This is an independent Zotero Research Copilot build derived from open-source Zotero AI projects, including AIdea-related source, and prepared for Zotero 10.x. The current distribution supports an OpenAI-compatible API, Zotero reader/library context, paper discovery and import, local conversation persistence, and reader selection translation.

## Current scope

- Zotero Library and PDF/EPUB Reader research panel
- Discussion, Discover, and Setting tabs
- Selected-text context, bounded PDF/EPUB context, and multi-paper context
- Streaming OpenAI-compatible chat
- Markdown, LaTeX, images, screenshots, and file attachments
- Saving responses and chat histories as native Zotero notes
- Local chat history, memory, and attachment metadata
- Search and review through OpenAlex, Semantic Scholar, and Crossref
- Duplicate-aware paper metadata import into Zotero collections
- PDF/EPUB selection translation using the shared model list
- Configurable provider label, Base URL, API Key, custom JSON headers, and model discovery

The supported distribution does not treat every module in the repository as a public end-user feature. In particular, the PDF translation controller remains separately implemented and is not currently wired into the main three-tab interface advertised in the README.

## Provider model

The plugin uses one or more manually configured OpenAI-compatible API profiles.

API keys and custom headers are stored in Zotero preferences. The plugin sends the API key as a Bearer token unless a custom `Authorization` header is supplied. The base URL is user-configured; the project does not assume a project-owned gateway or proxy.

## Identity and compatibility

The package identity is `zotero-research-copilot` with addon ID `zotero-research-copilot@local`, namespace `zoteroResearchCopilot`, and preference prefix `extensions.zotero.zoteroResearchCopilot` for the current build configuration. Some internal migration keys and historical log strings retain `aidea` names to preserve existing user data and compatibility. They are implementation details, not the current product name.

The manifest targets Zotero 10.0 through the supported 10.x range. Other Zotero versions are outside the current supported scope.

## Upstream and licensing

Required attribution for AIdea-related source and other upstream projects is retained. The project remains under AGPL-3.0-or-later where applicable; see [LICENSE](./LICENSE) and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). This build changes the plugin identity, provider configuration, Zotero compatibility declaration, lifecycle startup, and research-panel behavior.

## Safety

Provider API keys, custom headers, account-pool files, and cookies are never hardcoded into source or XPI files. Configure credentials in Zotero after installation. When using an external provider, the selected context, files, and images are sent to that provider according to its API and privacy policy.
