# FAQ

## Which Zotero versions are supported?

The current distribution targets Zotero **10.0–10.x**, as declared by the plugin manifest. Other versions may work or fail depending on Zotero APIs and are not the supported target.

## Do I need an API key?

Only when the configured endpoint requires authentication. An unauthenticated local endpoint can leave the API Key field empty.

## Which API endpoints can I use?

Use an OpenAI-compatible endpoint that exposes the operations required by the feature you want, normally `/models` and `/chat/completions`. Compatibility with chat completions alone does not guarantee image, reasoning, or other provider-specific features.

## Where are credentials and conversations stored?

API keys, settings, chat history, memory, and attachment metadata are kept in Zotero's local preferences/database/data directory. The selected context and files are sent to the configured endpoint when a request is made.

## Does the project collect telemetry?

The plugin does not include a project-owned telemetry service or proxy. The configured endpoint still receives requests according to its own policies.

## Why does a paper search return incomplete results?

OpenAlex, Semantic Scholar, and Crossref expose different metadata. A record may have no abstract, DOI, or open-access PDF. Search results are best-effort and should be checked before import.

## Why was a PDF not attached after import?

PDF retrieval depends on an open-access URL supplied by the index and on Zotero's importer. Metadata can be imported even when no downloadable PDF is available.

## Can the plugin read an entire PDF or EPUB?

It extracts document text and retrieves bounded relevant context. A whole-document request may include more context when appropriate, but the normal path avoids sending an entire book by default.

## How do I add another paper to a conversation?

Type `@` in the Discussion composer and search for a Zotero item. You can also use the attachment menu to choose papers from a Zotero collection.

## Why can a model not understand my screenshot?

The selected model and endpoint must support image input. An image attachment does not add multimodal capability to a text-only model.

## How can I report a problem?

Include the Zotero version, plugin version, API mode, endpoint type, model ID, and a redacted description of the error. Never include API keys, cookies, or private documents. Report it through [Issues](https://github.com/chrislucy838-collab/zotero-research-copilot/issues) or discuss it in [Discussions](https://github.com/chrislucy838-collab/zotero-research-copilot/discussions).
