# 常见问题

## 支持哪些 Zotero 版本？

当前发行版面向 Zotero **10.0–10.x**，这是插件 manifest 声明的支持范围。其他版本是否可用取决于 Zotero API，不属于当前目标范围。

## 必须使用 API Key 吗？

使用支持的 OAuth provider 时不需要。在 API 方式下，只有配置的端点要求认证时才需要 API Key。

## 可以使用哪些 API？

使用提供 `/models` 和 `/chat/completions` 等所需接口的 OpenAI 兼容端点。仅兼容聊天接口，并不保证支持图片、推理或其他服务商专有能力。

## 凭据和聊天记录保存在哪里？

凭据、设置、聊天记录、记忆和附件元数据保存在 Zotero 本地偏好、数据库和数据目录中。发起请求时，选中的上下文和附件会发送到对应 provider。

## 项目会收集遥测吗？

插件没有项目自建的遥测服务或代理。第三方 provider 仍会按照自己的政策处理收到的请求。

## 为什么论文搜索结果不完整？

OpenAlex、Semantic Scholar 和 Crossref 提供的元数据不同。一条记录可能没有摘要、DOI 或开放获取 PDF，导入前应自行检查。

## 为什么导入论文后没有 PDF？

PDF 获取取决于索引提供的开放获取地址以及 Zotero 导入器。即使没有可下载 PDF，论文元数据仍可能成功导入。

## 插件会读取整篇 PDF 或 EPUB 吗？

插件会提取文档文本，并检索有界的相关上下文。整篇文档请求在适当情况下可能包含更多内容，但默认不会因为普通提问就发送整本书。

## 如何在对话中加入另一篇论文？

在 Discussion 输入框输入 `@` 搜索 Zotero 文献，也可以从附件菜单中选择 Zotero 集合里的论文。

## 为什么模型无法理解截图？

模型和端点必须支持图片输入。添加图片不会让纯文本模型自动获得多模态能力。

## 划词翻译和全文翻译一样吗？

划词翻译接入 PDF/EPUB 阅读器选择弹窗，用于翻译选中文本。仓库中还保留 PDF 翻译控制器代码，但它目前没有作为主界面支持的稳定用户功能宣传。

## 如何报告问题？

请提供 Zotero 版本、插件版本、OAuth/API 模式、模型 ID 和脱敏后的错误描述。不要上传 API Key、OAuth 令牌、Cookie 或私人文档。可以在 [Issues](https://github.com/chrislucy838-collab/zotero-research-copilot/issues) 提交问题，或在 [Discussions](https://github.com/chrislucy838-collab/zotero-research-copilot/discussions) 讨论。
