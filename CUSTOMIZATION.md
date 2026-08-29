# Zotero Research Copilot

This is an independent Zotero Research Copilot build derived from AIdea's AGPL-3.0-or-later source, prepared for Zotero 10 and any OpenAI-compatible API provider.

## Initial scope

- Zotero Reader and Library research panel
- Selected-text context and paper context
- Streaming OpenAI-compatible chat
- Markdown and LaTeX rendering
- Saving responses as native Zotero notes
- Configurable provider name, Base URL, API Key, custom JSON headers, and model discovery
- Base URL is blank by default and must be configured by the user
- No translation feature: translation remains delegated to Zotero PDF Translate
- No OAuth login, OAuth token storage, or OAuth environment scheduler
- Discover tab: search Semantic Scholar, OpenAlex, and Crossref; review, deduplicate, and confirm metadata imports into Zotero
- Discover MVP does not download PDFs automatically; open-access file retrieval is planned separately

## Provider model

The plugin uses one manually configured OpenAI-compatible provider. It does not assume CPA, OpenAI, DeepSeek, or any other vendor. The provider settings are:

- Provider name
- Base URL
- API Key, stored only in Zotero preferences
- Optional custom HTTP headers as JSON
- Model selected from the provider's `/models` endpoint or entered manually

The default local gateway can be replaced with any compatible endpoint. The plugin sends the API key as a Bearer token unless a custom `Authorization` header is supplied.

## Upstream and licensing

The project retains required attribution for AIdea by zhile / Visterainer and remains under AGPL-3.0-or-later. The original upstream attribution and license files are retained. This fork changes the plugin identity, provider configuration, Zotero compatibility declaration, lifecycle startup, and research-panel behavior.

SeerAI and Better Notes are kept outside this fork as read-only reference projects. Their code is not bundled here.

## Safety

Provider API keys, custom headers, OAuth tokens, account-pool files, and cookies are never hardcoded into source or XPI files. Configure provider credentials in Zotero preferences after installation.
