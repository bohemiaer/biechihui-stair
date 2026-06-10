# 后端参考文件

本目录存放从旧本地 RAG 项目转移过来的后端参考文件，用于后续 Web 前端对接、API 类型梳理和桌面套壳方案评估。

这些文件当前不是 `biechihui-web` 的运行时后端源码，第一阶段只作为迁移参考。

## 内容

- `local_rag/`：现有 FastAPI/RAG 后端核心模块。
- `requirements.txt`：现有后端 Python 依赖。
- `.env.example`：现有后端环境变量示例。
- `docs/prompts/`：现有模型调用 prompt。

## 使用原则

- 前端开发优先依赖 PRD 和技术架构文档。
- 需要确认 API 字段、导入流程、搜索问答链路时参考本目录。
- 后续如果决定把后端也纳入本仓库，应从 reference 区迁出并重新整理为正式后端目录。
