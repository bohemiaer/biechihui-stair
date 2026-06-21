# 数据契约和映射

日期：2026-06-11

## 1. 分层约定

- 前端领域类型位于 `src/types/index.ts`，字段使用 `camelCase`。
- 后端 API DTO 位于 `backend/app/schemas.py`，对外响应保持 `camelCase`，避免前端每个页面重复转换。
- 后端 SQLite 表位于 `backend/app/db.py`，表和列使用 `snake_case`。
- 字段转换集中在后端 store/database 边界：`ProductDatabase.load_snapshot()` 将 `snake_case` 转成 `camelCase`，`ProductDatabase.save_snapshot()` 将 `camelCase` 写回 `snake_case`。
- 日期字段统一使用 ISO string，页面层用 `date-fns` 格式化展示。

## 2. 核心实体映射

### Folder

| 前端 / API DTO | SQLite 字段 | 说明 |
| --- | --- | --- |
| `id` | `folder.id` | 文件夹主键。 |
| `name` | `folder.name` | 文件夹名称。 |
| `parentId` | `folder.parent_id` | 第一版单层文件夹，保留父级字段。 |
| `isSystem` | `folder.is_system` | “未分类”等系统文件夹不可删除。 |
| `sortOrder` | `folder.sort_order` | 导航排序。 |
| `createdAt` | `folder.created_at` | ISO string。 |
| `updatedAt` | `folder.updated_at` | ISO string。 |
| `cardCount` | 聚合计算 | 不落库，由非删除卡片按 `folder_id` 聚合。 |

### KnowledgeCard / KnowledgeItem

| 前端 / API DTO | SQLite 字段 | 说明 |
| --- | --- | --- |
| `id` | `knowledge_card.id` | 卡片主键。 |
| `folderId` | `knowledge_card.folder_id` | 每张卡片有且只有一个文件夹。 |
| `title` | `knowledge_card.title` | AI/抓取标题。 |
| `url` | `knowledge_card.url` | 原始来源链接。 |
| `siteName` | `knowledge_card.site_name` | 来源站点。 |
| `summary` | `knowledge_card.summary` | AI 摘要。 |
| `contentPreview` | `knowledge_card.content_preview` | 原文预览。 |
| `fullContent` | `knowledge_card.full_content` | 完整原文；后续可从 `knowledge_item.raw_text` 回填。 |
| `note` / `notes` | `knowledge_card.note` / `knowledge_card.notes` | 用户备注；保留 `notes` 兼容旧前端字段。 |
| `sourceType` | `knowledge_card.source_type` | `web`、`pdf`、`note`、`rss`。 |
| `author` | `knowledge_card.author` | 作者。 |
| `publishedAt` | `knowledge_card.published_at` | 发布时间。 |
| `wordCount` | `knowledge_card.word_count` / `knowledge_item.word_count` | 卡片展示使用 card 字段；原文层也保留统计。 |
| `readingTime` | `knowledge_card.reading_time` | 估算阅读时间。 |
| `userTitle` | `knowledge_card.user_title` | 用户编辑标题，不覆盖原始 AI 标题。 |
| `userSummary` | `knowledge_card.user_summary` | 用户编辑摘要，不覆盖原始 AI 摘要。 |
| `lastEditedAt` | `knowledge_card.last_edited_at` | 用户最后编辑时间。 |
| `editedByUser` | `knowledge_card.edited_by_user` | 是否人工编辑。 |
| `isImportant` | `knowledge_card.is_important` | 重要标记。 |
| `isBadData` | `knowledge_card.is_bad` | 坏数据标记。 |
| `deletedAt` | `knowledge_card.deleted_at` | 软删除时间；普通查询默认过滤非空值。 |
| `deletedFromFolderId` | `knowledge_card.deleted_from_folder_id` | 恢复时优先回到原文件夹。 |
| `archivedAt` | `knowledge_card.archived_at` | 预留归档时间。 |
| `refreshStatus` | `knowledge_card.refresh_status` | 重新抓取状态。 |
| `lastRefreshedAt` | `knowledge_card.last_refreshed_at` | 最后抓取时间。 |
| `tags[]` | `card_tag` | 多标签关系表，支持标签筛选。 |
| `KnowledgeItem.rawText` | `knowledge_item.raw_text` | 抓取原文。 |
| `KnowledgeItem.parsedText` | `knowledge_item.parsed_text` | 清洗后的正文。 |
| `KnowledgeItem.chunks[]` | 后续 chunk 表 | 第一版 schema 先保留 item 层，接 RAG 时新增 chunk 表。 |

### ImportTask

| 前端 / API DTO | SQLite 字段 | 说明 |
| --- | --- | --- |
| `id` | `import_task.id` | 导入任务主键。 |
| `url` | `import_task.url` | 导入链接。 |
| `folderId` | `import_task.folder_id` | 目标文件夹。 |
| `status` | `import_task.status` | `pending`、`running`、`succeeded`、`failed`。 |
| `stage` | `import_task.stage` | `waiting`、`fetching`、`summarizing`、`embedding`、`saving`、`done`、`failed`。 |
| `progress` | `import_task.progress` | 0-100。 |
| `errorCode` | `import_task.error_code` | 标准错误码。 |
| `errorMessage` | `import_task.error_message` | 可读错误信息。 |
| `retryCount` | `import_task.retry_count` | 重试次数。 |
| `resultCardId` | `import_task.result_card_id` | 成功后的卡片 ID。 |
| `createdAt` | `import_task.created_at` | ISO string。 |
| `updatedAt` | `import_task.updated_at` | ISO string。 |

## 3. 搜索和问答引用映射

- 第一版搜索结果直接以卡片为单位返回：`SearchResult.cardId -> KnowledgeCard.id`。
- SQLite 中 `search_index.card_id` 指向 `knowledge_card.id`，`searchable_text` 聚合标题、来源、摘要、预览和标签。
- 后续接入 RAG chunk 后新增 chunk 表，chunk 需要包含 `id`、`item_id`、`card_id`、`text`、`start_offset`、`end_offset`、`embedding_status`。
- 问答引用统一返回 `CitationSource`：`cardId` 用于跳转详情页，`title/url/snippet` 用于回答区展示。
- chunk 级引用映射规则：`chunk.card_id -> knowledge_card.id -> CitationSource.cardId`，snippet 优先使用 chunk 文本，否则回退到卡片摘要或预览。

## 4. 统计字段来源

- `DashboardStats.totalCards`：`knowledge_card.deleted_at IS NULL` 的卡片数。
- `DashboardStats.totalWords`：非删除卡片 `word_count` 求和；若未来缺失，则从 `knowledge_item.raw_text` 动态统计。
- `DashboardStats.totalFolders`：`folder` 表总数，包含系统文件夹。
- `DashboardStats.weeklyImports`：最近一周 `import_task.status IN ('running', 'succeeded')` 的任务数。
- `DailyActivity.count`：当天创建或导入且未删除的卡片数。
- `DailyActivity.wordCount`：当天卡片 `word_count` 求和。
- `DailyActivity.tokenCount`：第一版按 `word_count * 2` 估算，接模型 token 统计后改为真实 token 数。

## 5. 错误和空值策略

- 错误码枚举：`network`、`fetch_failed`、`model_missing`、`parse_failed`、`save_failed`、`unknown`。
- 后端错误响应应转成前端 `ApiError`：`type`、`message`、`stage`、`recoverable`、`context`。
- 可选字符串不存在时使用 `null` 或缺失字段；展示层统一降级为空文案。
- 用户输入的空备注可以保存为空字符串；未生成的 AI 字段使用 `null` 或空字符串均可，但 API DTO 必须稳定返回字段。

## 6. 删除策略

- 普通查询默认过滤 `knowledge_card.deleted_at IS NULL`。
- 软删除只更新 `deleted_at` 和 `deleted_from_folder_id`，不删除原文、标签和索引。
- 恢复时优先回到 `deleted_from_folder_id`；原文件夹不存在时回到 `uncategorized`。
- 永久删除顺序：先删 `search_index` / 向量索引，再删 `card_tag`，再删 `knowledge_card` 和 `knowledge_item`。
- 现有无文件夹内容迁移时自动写入 `folder_id='uncategorized'`。
