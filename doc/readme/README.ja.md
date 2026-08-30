<p align="center"><img src="../../addon/content/icons/icon-96.png" alt="Zotero Research Copilot ロゴ" width="88" /></p>
<h1 align="center">Zotero Research Copilot</h1>
<p align="center">Zotero の中で論文を読み、対話し、検索し、整理するための AI リサーチワークスペース。</p>
<p align="center"><a href="../../README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a> · <a href="./README.zh-TW.md">繁體中文</a> · <a href="./README.ja.md">日本語</a> · <a href="./README.ko.md">한국어</a> · <a href="./README.fr.md">Français</a></p>
<p align="center"><a href="https://github.com/chrislucy838-collab/zotero-research-copilot/releases"><strong>最新 XPI をダウンロード</strong></a> · <a href="https://github.com/chrislucy838-collab/zotero-research-copilot/issues">Issues</a> · <a href="https://github.com/chrislucy838-collab/zotero-research-copilot/discussions">Discussions</a></p>

> **対応範囲:** 本ビルドは Zotero 10.x を対象とします。オープンソースの Zotero AI プロジェクトをもとにした独立ビルドであり、原著者の表示とライセンスは [LICENSE](../../LICENSE)、[CUSTOMIZATION.md](../../CUSTOMIZATION.md)、[THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) に保持されています。

## 主な機能

- Zotero のライブラリ項目ペイン、PDF リーダー、EPUB リーダーのサイドバーで研究対話。
- 現在の論文、選択テキスト、他の論文、画像、アップロードファイルをコンテキストとして利用。
- 入力欄の `@` または Zotero コレクションから複数論文を追加。
- 会話の編集、再試行、分岐、ピン留め、削除、エクスポート、Zotero ノートへの保存。
- PDF/EPUB の文書構造を保った有界コンテキスト検索。
- **Discover** タブで OpenAlex、Semantic Scholar、Crossref を検索し、確認後に Zotero へ重複を避けてインポート。
- ファイルの貼り付け・ドラッグ・アップロード、リーダーからの図表や数式の範囲キャプチャ。
- PDF/EPUB の選択範囲翻訳。モデル、言語、自動実行、コピー/ノート操作を設定可能。
- OpenAI 互換 API に対応し、ホスト型・ローカル・セルフホスト型モデルに接続可能。
- 会話履歴とメモリを Zotero のローカルデータに保存。Markdown、表、画像、LaTeX を表示。

## モデル接続

**Tools → Add-ons → Zotero Research Copilot → Settings** を開き、API Base URL と Model を入力します。API Key と Custom Headers はサービスが必要とする場合に設定します。例: `https://api.openai.com/v1`、`http://127.0.0.1:11434/v1`。通常は `/models` と `/chat/completions` に対応するエンドポイントが必要です。

## インストール

1. [Releases](https://github.com/chrislucy838-collab/zotero-research-copilot/releases) から `Zotero-Research-Copilot-<version>.xpi` をダウンロードします。
2. Zotero の **Tools → Add-ons → gear → Install Add-on From File…** を開きます。
3. XPI を選択し、必要なら Zotero を再起動します。
4. Zotero Research Copilot の Settings で API を設定します。

対応バージョンは Zotero **10.0–10.x** です。新しい XPI を既存のインストールに重ねてアップグレードできます。

## プライバシーとライセンス

API リクエストは Zotero から設定したエンドポイントへ直接送信されます。プラグイン独自のテレメトリやプロキシはありません。キーとカスタムヘッダーはソースや XPI にハードコードされません。第三者モデルに送信されるコンテキストやファイルは、そのサービスのポリシーに従います。

ライセンスは [AGPL-3.0-or-later](../../LICENSE) です。詳しい帰属表示は [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) を参照してください。

## 開発

```bash
npm install
npm run build
npm run test:unit
npm start
```
