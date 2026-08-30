# Getting Started

## 1. Install the plugin

1. Download `Zotero-Research-Copilot-<version>.xpi` from the [Releases](https://github.com/chrislucy838-collab/zotero-research-copilot/releases) page.
2. In Zotero, open **Tools → Add-ons**.
3. Open the gear menu and choose **Install Add-on From File…**.
4. Select the XPI and restart Zotero if prompted.

The supported distribution targets Zotero **10.0–10.x**.

## 2. Open the panel

After restarting Zotero, the Zotero Research Copilot section is available in:

- the Library item pane after selecting an item;
- the PDF reader sidebar;
- the EPUB reader sidebar.

The panel contains three tabs:

- **Discussion**: chat, context, history, attachments, and exports;
- **Discover**: search public scholarly indexes and import selected records;
- **Setting**: API connection, model, language, translation, and advanced options.

## 3. Configure an API endpoint

Open the **Setting** tab and choose **API Mode**. Fill in an API Base URL and Model. Add an API Key only when the endpoint requires authentication. Custom HTTP headers can be provided as JSON for gateways with non-standard authentication.

## 4. Ask about a paper

Open an item or document, then ask a question in the Discussion tab. The panel can use the active document as context. In a reader, select text and click **Add Text** to attach the passage explicitly.

To compare papers:

1. Type `@` in the composer and search for another Zotero item, or
2. use the attachment menu to add papers from a collection.

The selected paper chips show which documents are included in the request.

## 5. Save and continue work

Use the conversation history controls to create, rename, pin, branch, retry, edit, or delete conversations. Use the response menu to copy a response or save it as a Zotero note. The export menu can copy or save a complete chat history.

## 6. Discover papers

Open **Discover**, enter a keyword, title, author, or DOI, and select one or more indexes:

- OpenAlex
- Semantic Scholar
- Crossref

Review the returned metadata and duplicate status, select records, choose **My Library** or a collection, and click **Import selected**. PDF retrieval is best effort and depends on the metadata source exposing an open-access URL.

## 7. Translate a selection

Enable selection translation in Settings, choose a model and target language, then select text in a PDF or EPUB reader. Depending on the setting, translation starts automatically or can be started from the selection popup. The result can be copied or added to a Zotero note when those actions are enabled.

PDF first use may create a local cold-start cache containing a compact overview and terminology. EPUB selection translation uses bounded context around the selection.

## 8. Add files and images

The composer supports text, Markdown, code, PDF, and image attachments through upload, paste, or drag and drop. The screenshot action captures a region from the active reader. Image input requires a model and endpoint that support multimodal content.

## 9. Troubleshooting

- **No models appear:** verify API Base URL and API Key, then use the model refresh action.
- **A paper has no PDF:** the index may only provide metadata, or its open-access URL may be unavailable.
- **Context is missing:** confirm the correct reader tab is active, then use **Add Text** or re-add the paper reference.
- **A request fails:** check the endpoint URL, model ID, headers, and whether the selected model supports the requested operation.
- **A feature is unavailable:** provider capabilities differ by model. Check the model selector and the endpoint's supported API shape.
