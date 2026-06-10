# 别吃灰技术架构

日期：2026-06-10

## 架构定位

本文档描述“别吃灰”本地个人知识库管理应用第一版的技术栈和工程架构。视觉设计规范见 `design.md`，功能设计见 `docs/superpowers/specs/2026-06-09-local-knowledge-base-redesign.md`。

第一版继续沿用当前本地 RAG 项目的基础能力，在现有 FastAPI、SQLite、FTS 和模型调用链路上扩展产品化能力。

## 技术栈选择

第一版继续使用当前技术栈：

- 后端：FastAPI。
- 服务运行：Uvicorn。
- 数据库：SQLite。
- 全文检索：SQLite FTS5。
- 向量检索：现有 embedding JSON，保留可选 LanceDB。
- 前端：FastAPI 服务的静态本地 Web 应用。
- 前端脚本：原生 JavaScript ES modules。
- 模型调用：沿用现有 `ModelClient` 和 `.env` 配置。
- 链接抓取：沿用现有 `extractors.py`，特殊平台继续使用 Playwright 能力。

第一版不引入 React、Vite、Next.js 或前端构建链。原因是当前应用是本地单用户工具，核心复杂度在数据流、导入任务和知识管理，不在前端框架。

## 后端分层

建议分层：

- `api.py`：HTTP 路由和请求响应模型绑定。
- `models.py`：Pydantic 请求和响应模型。
- `service.py`：业务编排，保留 RAG 核心流程。
- `db.py`：SQLite 表结构、迁移和数据访问。
- `retrieval.py`：检索逻辑。
- `llm.py`：模型调用。
- `extractors.py`：链接抓取和正文抽取。
- `vector_index.py`：可选 LanceDB 同步。
- 新增 `folders.py` 或合入 `service.py`：文件夹业务。
- 新增 `import_tasks.py`：导入任务状态和后台执行。
- 新增 `calendar_ops.py`：日历聚合和日报生成。
- 新增 `hot.py`：AI 热点推荐数据获取和导入状态。

评测相关模块和页面继续作为开发工具存在，不进入产品导航。

## 前端组织

建议将现有单文件页面拆成静态模块：

```text
local_rag/static/
  app.html
  assets/
    app.css
    app.js
    api.js
    state.js
    router.js
    components.js
    views/
      home.js
      library.js
      calendar.js
      search.js
      hot.js
      settings.js
```

第一版使用原生 ES modules，不需要打包。

路由建议使用 hash routing：

```text
#/home
#/library
#/library/folder/:folder_id
#/library/trash
#/calendar
#/calendar/:date
#/search
#/hot
#/settings
```

FastAPI 继续提供 `/dashboard` 或新增 `/app` 返回入口 HTML。

## 数据模型

现有核心表：

- `knowledge_item`
- `knowledge_card`
- `knowledge_card_fts`

新增文件夹表：

```text
folder
  id
  name
  is_system
  created_at
  updated_at
```

新增导入任务表：

```text
import_task
  id
  url
  folder_id
  status
  stage
  error
  item_id
  card_id
  created_at
  updated_at
  finished_at
```

扩展 `knowledge_card`：

```text
folder_id
note
is_important
is_bad
deleted_at
deleted_from_folder_id
```

可选扩展 `knowledge_item`：

```text
word_count
```

如果第一版不增加 `word_count`，可以先按 `raw_text` 长度动态统计 Home 和日历中的文字量。

系统默认文件夹：

- 未分类：系统文件夹，不允许删除。

回收站通过 `deleted_at` 实现，不单独建文件夹。

## 导入任务架构

第一版建议引入服务端导入任务，支撑 Home 最近导入中的 `导入中`、`导入成功`、`导入失败` 状态。

流程：

1. `POST /api/import-tasks` 创建任务，状态为 `pending` 或 `running`。
2. 后端后台执行抓取、总结、embedding 和写库。
3. 每个阶段更新 `stage`。
4. 成功后写入 `item_id` 和 `card_id`，状态为 `succeeded`。
5. 失败后记录错误，状态为 `failed`。
6. 前端轮询最近任务。

任务状态：

- `pending`
- `running`
- `succeeded`
- `failed`

阶段建议：

- `waiting`
- `fetching`
- `summarizing`
- `embedding`
- `saving`
- `done`
- `failed`

现有 `/ingest` 可以保留为底层同步能力或兼容接口，但产品前端优先使用 `/api/import-tasks`。

## API 边界

建议新增产品 API：

```text
GET    /api/home/summary
GET    /api/home/activity
GET    /api/import-tasks/recent
POST   /api/import-tasks
POST   /api/import-tasks/{task_id}/retry

GET    /api/folders
POST   /api/folders
PATCH  /api/folders/{folder_id}
DELETE /api/folders/{folder_id}

GET    /api/cards
GET    /api/cards/{card_id}
PATCH  /api/cards/{card_id}
DELETE /api/cards/{card_id}
POST   /api/cards/{card_id}/restore
DELETE /api/cards/{card_id}/permanent
POST   /api/cards/{card_id}/refresh
POST   /api/cards/{card_id}/regenerate

GET    /api/calendar/days
GET    /api/calendar/days/{date}
POST   /api/calendar/days/{date}/daily-report

GET    /api/hot/articles
GET    /api/hot/articles/{article_id}

POST   /search
POST   /answer
```

具体路径可以在实施阶段结合现有 `api.py` 收敛。

## 状态与错误处理

导入错误必须保留：

- 用户输入的 URL。
- 目标文件夹。
- 当前阶段。
- 错误原因。
- 重试入口。

常见错误：

- URL 无效。
- 抓取失败。
- 正文为空或页面是占位页。
- 模型 API key 缺失。
- 模型调用失败。
- embedding 失败。
- 写库失败。

模型 API 不可用时，相关功能需要清晰提示，不做静默失败。

## 测试策略

后端测试：

- 文件夹 CRUD。
- 导入任务状态流转。
- 导入成功写入文件夹。
- 导入失败记录错误。
- 卡片编辑。
- 软删除、恢复、永久删除。
- 搜索排除回收站。
- 日历聚合。
- 日报生成失败提示。

前端验证：

- 使用浏览器打开本地应用。
- 验证导航、导入弹窗、Home 状态、知识库双栏/三栏切换。
- 验证错误状态和空状态。
- 验证窄屏基本可用。

## 实施顺序建议

1. 数据模型和迁移：文件夹、卡片管理字段、导入任务。
2. 产品 API：文件夹、卡片编辑、导入任务、Home 聚合。
3. 前端应用骨架：主导航、路由、基础布局。
4. 导入弹窗和最近导入状态。
5. 知识库列表、文件夹下拉、卡片详情。
6. 回收站、恢复和永久删除。
7. 日历和日报。
8. 搜索两段式问答。
9. AI 热点推荐。
10. 设置、备份和导出入口。
