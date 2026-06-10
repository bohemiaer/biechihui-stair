# summarize_card

## 节点信息

- 节点名：`summarize_card`
- 代码位置：`local_rag/llm.py`
- 调用入口：`ModelClient.summarize_card(...) -> Dict[str, Any]`
- 作用：把原始内容压缩成便于检索的知识卡片

## 输入变量

- `{source}`：来源平台
- `{title}`：标题
- `{text[:6000]}`：正文前 6000 字符
- `{image_urls[:10]}`：最多 10 个图片 URL

## 当前 Prompt

```text
你是个人知识库的数据转换助手。请基于输入生成一张便于模糊记忆检索的知识卡片，只输出严格 JSON，不要输出其他文本。
来源平台：{source}
标题：{title}
正文：{text[:6000]}
图片URL：{image_urls[:10]}
输出格式：{"title":"原始或修正标题","summary":"约300字摘要","tags":["3到5个标签"]}
```

## 返回要求

- 必须返回 JSON 对象
- `summary` 不能为空，否则代码会报错
- `summary` 最多截断到 1000 字符
- `tags` 最多保留 5 个非空标签
