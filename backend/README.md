# 别吃灰后端

正式后端入口位于 `backend/app/main.py`，当前提供产品 API 外壳和本地 SQLite 持久化数据源。

启动：

```bash
python -m backend.app.run
```

前端真实 API 模式：

```bash
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://127.0.0.1:8000
```

`backend/reference/local_rag` 仍作为抓取、摘要、embedding、检索问答能力的迁移参考。

当前产品 API 数据会写入 `backend/data/product_store.sqlite3`。该目录只用于本地开发数据，不进入版本控制。

导入、搜索和问答已接入 `backend/reference/local_rag`：

- `/api/import-tasks` 会调用抓取、摘要、embedding 和 local_rag 写库，并把结果镜像到产品库。
- `/search` 会调用查询改写、embedding、FTS/向量检索和可选 rerank。
- `/answer` 会基于检索卡片调用模型生成带引用回答。
- 若缺少 `CHAT_API_KEY` / `EMBEDDING_API_KEY` / `SILICONFLOW_API_KEY`，导入任务会进入 `failed`，搜索和问答会返回 `503 model_missing`。

常用环境变量：

```bash
CHAT_API_KEY=...
EMBEDDING_API_KEY=...
SILICONFLOW_API_KEY=...
DATA_DIR=backend/data/local_rag
VITE_API_BASE_URL=http://127.0.0.1:8001
VITE_USE_MOCK_API=false
```

导入旧版 `local_rag` 数据：

```bash
python -m backend.app.import_legacy --source "local_rag_data copy/store.db" --rag-target "local_rag_data/store.db"
```

这会把旧 RAG SQLite 库复制到当前 RAG 数据目录，并把旧卡片镜像到产品库。

关于 Pinecone：当前本地个人知识库不需要 Pinecone。第一版优先使用 SQLite FTS 和 local_rag 的本地 embedding 检索；如需独立向量库，优先启用本地 LanceDB。只有在需要云端同步、团队共享、跨设备在线检索或大规模向量托管时，再考虑 Pinecone。

下一步迁移顺序：

1. 将快照式仓储逐步演进为按操作增量写库。
2. 增加后台任务队列，避免导入时阻塞 HTTP 请求。
3. 增加模型配置检查接口，让前端设置页展示真实可用状态。
