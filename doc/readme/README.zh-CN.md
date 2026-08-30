<p align="center">
  <img src="../../addon/content/icons/icon-96.png" alt="Zotero Research Copilot 图标" width="88" />
</p>

<h1 align="center">Zotero Research Copilot</h1>

<p align="center">
  在 Zotero 内完成论文阅读、讨论、检索与整理的 AI 研究工作区。
</p>

<p align="center">
  <a href="../../README.md">English</a>
  · <a href="./README.zh-CN.md">简体中文</a>
  · <a href="./README.zh-TW.md">繁體中文</a>
  · <a href="./README.ja.md">日本語</a>
  · <a href="./README.ko.md">한국어</a>
  · <a href="./README.fr.md">Français</a>
</p>

<p align="center">
  <a href="https://github.com/chrislucy838-collab/zotero-research-copilot/releases"><strong>下载最新版 XPI</strong></a>
  · <a href="https://github.com/chrislucy838-collab/zotero-research-copilot/issues">Issues</a>
  · <a href="https://github.com/chrislucy838-collab/zotero-research-copilot/discussions">Discussions</a>
</p>

> **当前范围：**本发行版面向 Zotero 10.x。项目是基于开源 Zotero AI 项目独立构建的版本，原始署名和许可证保留在 [LICENSE](../../LICENSE)、[CUSTOMIZATION.md](../../CUSTOMIZATION.md) 与 [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) 中。

## 它能做什么

Zotero Research Copilot 会把 AI 对话放在你正在使用的 Zotero 条目或阅读器旁边。它可以结合当前论文、选中文本、其他论文、图片和上传文件作为上下文；聊天记录、记忆和相关元数据保存在 Zotero 本地数据中。

### 研究对话

- 在 Zotero 文库条目面板、PDF 阅读器或 EPUB 阅读器侧边栏中对话。
- 将当前论文作为上下文，并通过 **Add Text** 加入阅读器中的选中文本。
- 通过输入框中的 `@` 引用其他论文，也可以从 Zotero 文库中选择一个集合批量加入论文上下文。
- 对话中保留论文归属和证据引用信息；模型输出符合引用格式时，面板可以将引用关联到相关证据。
- 新建、继续、重命名、置顶、删除、分支、编辑、重试和导出对话，也可以把回复或完整聊天记录保存为 Zotero 笔记。
- 使用可编辑的快捷操作执行总结、解释、比较、翻译等常见任务。

### PDF 与 EPUB 上下文

- 从 PDF 和 EPUB 附件中提取并检索有界上下文，默认不会因为提问而发送整本书。
- EPUB 有目录结构时保留章节层级和阅读顺序。
- 对明确的章节或段落请求优先进行本地章节路由，再检索相关文本片段。
- 将当前阅读器文档和额外引用论文分开管理，让回答来源更容易辨认。

### 文件与图片

- 通过粘贴、拖拽或上传加入文本、Markdown、代码、PDF 和图片文件。
- 从当前阅读器截图，用于讨论论文中的图、表或公式。
- 使用支持图片输入的多模态模型分析图片。
- 兼容的 provider 流程可能支持显式图片生成，实际可用性取决于 provider、模型和接口能力。

### 论文发现与导入

**Discover** 标签可以搜索公开学术索引，并在写入 Zotero 前让你审阅结果：

- OpenAlex
- Semantic Scholar
- Crossref

结果会跨来源去重，并展示题目、作者、年份、期刊/会议、DOI 和已知的 PDF 可用性。你可以选择需要导入的记录，目标位置可以是 **My Library**、已有集合或新建集合。导入前会检查 Zotero 中是否已有对应条目。若来源提供可用的开放获取 PDF 地址，插件会尝试导入附件，但不能保证每篇论文都有可下载 PDF。

### 划词翻译

- 在 PDF 或 EPUB 阅读器中选中文本后翻译。
- PDF 首次使用时可以在本地准备论文概览和术语缓存，后续选区复用该缓存。
- EPUB 使用围绕选区建立的有界上下文。
- 可以在设置中配置自动翻译、源语言、目标语言、模型，以及是否显示复制和添加到笔记按钮。

## 连接模型

可以从对话面板的 **Setting** 标签配置模型，也可以打开 **工具 → 附加组件 → Zotero Research Copilot → 设置**。部分 Zotero 构建版本会把它显示在 **编辑 → 设置** 中。

当前支持的连接方式是 **OpenAI 兼容 API**。

### OpenAI 兼容 API

切换主连接模式为 **API 方式**，填写：

| 字段         | 是否必填   | 示例                                                       |
| ------------ | ---------- | ---------------------------------------------------------- |
| API Base URL | 是         | `https://api.openai.com/v1` 或 `http://127.0.0.1:11434/v1` |
| Model        | 是         | `gpt-4.1-mini` 或 `llama3.1:8b`                            |
| API Key      | 取决于服务 | 本地未鉴权端点可以留空。                                   |
| 自定义请求头 | 可选       | 以 JSON 形式填写非标准认证或网关请求头。                   |

端点通常需要提供 `/models` 和 `/chat/completions` 所需的接口形状。兼容 API 不代表一定支持 provider 的专有能力。只要接口行为符合要求，Ollama、LM Studio、vLLM、OpenRouter、DeepSeek 兼容网关及其他本地或托管服务都有可能使用。

## 安装

### 环境要求

- Zotero **10.0–10.x**
- 一个已经配置好的 OpenAI 兼容 API 端点
- 使用公开学术索引检索和托管模型时需要网络连接

### 安装或升级

1. 从 [Releases](https://github.com/chrislucy838-collab/zotero-research-copilot/releases) 下载 `Zotero-Research-Copilot-<版本>.xpi`。
2. 在 Zotero 中打开 **工具 → 附加组件**。
3. 点击齿轮菜单，选择 **从文件安装附加组件…**。
4. 选择 XPI 文件，按提示重启 Zotero。
5. 打开 Zotero Research Copilot 的 **Setting**，配置 API 后开始对话。

直接在旧版本上安装新版 XPI 即可升级。聊天记录、记忆和设置保存在 Zotero 本地数据中；测试开发版前仍建议备份重要的 Zotero 数据。

## 隐私与安全

- 插件没有自建遥测服务或项目代理。
- API 请求直接从 Zotero 发送到你配置的端点。
- API Key 和自定义请求头由用户在本地配置，不会硬编码进源代码或 XPI。
- 聊天记录、记忆和本地附件元数据保存在 Zotero 本地数据库/数据目录。
- 使用第三方模型时，选中的上下文、上传文件和图片会按照该服务的 API 与隐私政策发送。
- 请不要在不了解服务商数据处理方式的情况下发送密码、令牌或敏感文档。

## 开发

```bash
npm install
npm run build
npm run test:unit
npm start
```

构建目录和 XPI 已被 Git 忽略。推送新的 `v*` 标签后，GitHub Actions 会生成版本 Release 并上传 XPI；`update.json` 会维护在 `release` 预发布中。

## 许可证与来源

Zotero Research Copilot 使用 [AGPL-3.0-or-later](../../LICENSE) 发布。项目是基于开源工作的独立构建版本，其中包括 [llm-for-zotero](https://github.com/yilewang/llm-for-zotero) 和 AIdea 项目的部分源代码。完整署名与附加许可证见 [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)。
