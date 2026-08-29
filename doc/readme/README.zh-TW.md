<p align="center">
  <img src="../../addon/content/icons/icon-96.png" alt="Zotero Research Copilot 圖示" width="88" />
</p>

<h1 align="center">Zotero Research Copilot</h1>

<p align="center">在 Zotero 內完成論文閱讀、討論、搜尋與整理的 AI 研究工作區。</p>

<p align="center">
  <a href="../../README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a> · <a href="./README.zh-TW.md">繁體中文</a> · <a href="./README.ja.md">日本語</a> · <a href="./README.ko.md">한국어</a> · <a href="./README.fr.md">Français</a>
</p>

<p align="center">
  <a href="https://github.com/chrislucy838-collab/zotero-research-copilot/releases"><strong>下載最新版 XPI</strong></a> · <a href="https://github.com/chrislucy838-collab/zotero-research-copilot/issues">Issues</a> · <a href="https://github.com/chrislucy838-collab/zotero-research-copilot/discussions">Discussions</a>
</p>

> **目前範圍：**本版本以 Zotero 10.x 為目標。這是基於開源 Zotero AI 專案的獨立建置版本；原始署名與授權保留於 [LICENSE](../../LICENSE)、[CUSTOMIZATION.md](../../CUSTOMIZATION.md) 及 [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)。

## 功能

- 在 Zotero 文庫條目面板、PDF 閱讀器與 EPUB 閱讀器側邊欄中進行研究對話。
- 使用目前論文、閱讀器選取文字、其他論文、圖片和上傳檔案作為上下文。
- 透過輸入框中的 `@` 或 Zotero 集合選擇器加入多篇論文。
- 保留論文歸屬與證據引用資訊，支援對話編輯、重試、分支、置頂、匯出及儲存為 Zotero 筆記。
- 從 PDF/EPUB 附件擷取有界上下文；EPUB 有目錄時保留章節結構。
- **Discover** 分頁搜尋 OpenAlex、Semantic Scholar 與 Crossref，審閱、去重後匯入 Zotero 或指定集合。
- 支援貼上、拖曳、上傳檔案，以及從閱讀器擷取圖片區域討論圖表或公式。
- 在 PDF/EPUB 閱讀器中進行劃詞翻譯，可設定模型、語言、自動翻譯與複製/加入筆記操作。
- 支援 ChatGPT/Codex、Gemini CLI 與 GitHub Copilot OAuth，也支援 OpenAI 相容 API。
- 聊天記錄、記憶與附件中繼資料儲存在 Zotero 本機資料中。
- 支援 Markdown、程式碼、表格、圖片與 LaTeX 渲染，以及 English、中文、日本語、한국어、Français、Deutsch、Español、Русский、Português、العربية、हिन्दी 介面。

## 連接模型

在 **工具 → 附加元件 → Zotero Research Copilot → 設定** 中配置模型。可用兩種方式：

### OAuth

| 提供者         | 授權方式                | 備註                              |
| -------------- | ----------------------- | --------------------------------- |
| ChatGPT        | OpenAI Codex OAuth      | 需要時可安裝或更新本機 CLI 環境。 |
| Gemini         | Google Gemini CLI OAuth | 需要時可安裝或更新本機 CLI 環境。 |
| GitHub Copilot | Device Code OAuth       | 不需要 CLI 安裝步驟。             |

通常依序執行 **安裝/更新環境 → OAuth 登入 → 刷新模型**。OAuth 憑據只儲存在本機；使用前請閱讀服務商條款與外掛中的提示。

### OpenAI 相容 API

切換主連線模式為 API，填寫：

| 欄位         | 必填       | 範例                                                       |
| ------------ | ---------- | ---------------------------------------------------------- |
| API Base URL | 是         | `https://api.openai.com/v1` 或 `http://127.0.0.1:11434/v1` |
| Model        | 是         | `gpt-4.1-mini` 或 `llama3.1:8b`                            |
| API Key      | 視端點而定 | 未驗證的本機端點可留空。                                   |
| 自訂 Headers | 選填       | JSON 格式的自訂 HTTP 標頭。                                |

端點通常需要提供 `/models` 與 `/chat/completions` 所需的 API 形狀。相容 API 不保證支援服務商專有功能。

## 安裝

- 需求：Zotero **10.0–10.x**，以及一個已配置的 OAuth provider 或 OpenAI 相容端點。
- 從 [Releases](https://github.com/chrislucy838-collab/zotero-research-copilot/releases) 下載 `Zotero-Research-Copilot-<版本>.xpi`。
- 在 Zotero 開啟 **工具 → 附加元件 → 齒輪 → 從檔案安裝附加元件…**，選取 XPI。
- 重啟 Zotero，於 Zotero Research Copilot 設定中完成模型配置。

安裝新版 XPI 可直接升級。聊天記錄、記憶與設定位於 Zotero 本機資料中，但測試開發版前仍建議備份重要資料。

## 隱私與授權

API 請求會直接從 Zotero 傳送到你選擇的服務商或端點。外掛不提供自建遙測或代理服務；第三方模型收到的上下文、檔案與圖片會依其 API 和隱私政策處理。API Key、OAuth 憑據與自訂標頭不會硬編碼在原始碼或 XPI 中。

Zotero Research Copilot 使用 [AGPL-3.0-or-later](../../LICENSE) 發布。來源與完整第三方聲明見 [CUSTOMIZATION.md](../../CUSTOMIZATION.md) 和 [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)。

## 開發

```bash
npm install
npm run build
npm run test:unit
npm start
```
