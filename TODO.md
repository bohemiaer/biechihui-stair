# 别吃灰 Web TODO

日期：2026-06-10

本清单根据 `docs/` 下规范文档整理：

- `docs/product/prd.md`
- `docs/product/design.md`
- `docs/product/data-contract.md`
- `docs/tech-stack.md`

## 0. 路线决策

- [x] 第一版前端路线以 `docs/tech-stack.md` 为准：`React + TypeScript + Vite`。
- [x] 第一版路由使用 `React Router`，页面路径采用 `/home`、`/library`、`/calendar`、`/search`、`/hot`、`/settings`。
- [x] 服务端状态后续使用 `TanStack Query`，覆盖 Home、导入任务、文件夹、卡片、日历、搜索和文章推荐。
- [x] 本地 UI 状态后续使用 `Zustand`，覆盖导航折叠、视图偏好、选中卡片、导入弹窗和筛选条件。
- [x] 表单后续使用 `React Hook Form + Zod`。
- [x] 当前前端已复用 `backend/reference/FRONT`，样式方案以 `Tailwind CSS v4` 原子类为主。
- [x] 图标使用 `lucide-react`。
- [x] 日期处理使用 `date-fns`。
- [x] Home 热力图第一版手写轻量组件，不引入重型图表库。
- [x] 第一阶段已建立 mock API 数据源抽象和 TypeScript 类型定义。
- [x] 后续 API 层采用 `fetch` 封装和 TanStack Query hooks。
- [x] 第一版 Web 调用现有本地 FastAPI 服务，开发态默认 `VITE_API_BASE_URL=http://127.0.0.1:8001`。
- [x] 第一版后端以现有本地 FastAPI/RAG 能力为基础，`backend/reference/local_rag` 作为后端参考和迁移来源。
- [x] 第一版只做 Web，不做 Tauri/Electron 桌面套壳代码。
- [x] 未来桌面套壳优先考虑 `Tauri`，`Electron` 作为备选。

## 1. 开发主线

> 顺序不是硬切阶段，可以局部并行；但整体优先保证产品体验先跑通，再接真实后端。

- [x] 先画核心页面和关键流程，明确用户怎么走完整闭环。
- [x] 定义前端第一版领域类型和 mock 状态模型。
- [x] 搭建前端应用骨架，用 mock 数据跑通主要交互。
- [x] 在前端体验稳定后补真实后端和产品 API 壳。
- [x] 将 API 层改为 mock/real 可切换，并保留 mock 开关用于离线开发和视觉回归。
- [ ] 最后补齐视觉验收、状态验收和 PRD 验收。

## 2. 页面和流程设计

> 页面和流程设计已基于现有 PRD/设计规范基本确认，本阶段按用户要求先跳过，直接进入后续开发；需要更细线框图时再回补。

### 2.1 信息架构

- [x] 明确左侧主导航：`+ 导入`、Home、知识库、日历、搜索、文章推荐、设置/备份/导出。
- [x] 明确知识库展开项：全部收藏、用户文件夹、未分类、新建文件夹。
- [x] 补齐回收站入口和对应交互。
- [x] 确认回收站只在知识库内部出现，不作为主导航项。
- [x] 明确默认双栏布局：左侧导航 + 内容区。
- [x] 明确知识库三栏布局：左侧导航 + 中间卡片列表 + 右侧卡片详情。
- [x] 明确窄屏降级：导航 -> 列表 -> 详情逐级进入。

### 2.2 核心流程

- [ ] 画出单链接导入到指定文件夹流程。
- [ ] 画出新建文件夹并导入流程。
- [ ] 画出导入任务创建、运行、成功、失败、重试流程。
- [ ] 画出 Home 最近导入任务状态流转。
- [ ] 画出知识库浏览、筛选、排序、打开卡片详情流程。
- [ ] 画出卡片编辑、移动文件夹、编辑标签和备注流程。
- [ ] 画出重新抓取原文、重新生成摘要/标签、二次确认流程。
- [ ] 画出删除、进入回收站、恢复、永久删除流程。
- [ ] 画出从 Home 热力图点击日期进入日历详情流程。
- [ ] 画出日历日报生成流程。
- [x] 搜索、选卡、问答、引用跳回卡片流程已按当前前端实现落地。
- [x] 文章推荐分类、预览、单篇导入、已导入状态流程已按当前前端实现落地。

### 2.3 核心页面草图

- [x] Home：顶部统计、知识活动热力图、最近导入。
- [x] Home：文章推荐摘要。
- [x] 导入弹窗：URL、目标文件夹、基础提交。
- [x] 导入弹窗：新建文件夹、提交中、错误提示。
- [x] 知识库：全部收藏、文件夹入口、卡片列表、详情区。
- [x] 知识库：网格视图、紧凑列表视图、筛选和排序。
- [x] 卡片详情：标题、来源、标签、AI 摘要、原文预览、备注、操作区。
- [x] 卡片详情：文件夹、状态标记、完整编辑能力。
- [x] 回收站：删除列表、恢复、永久删除。
- [x] 回收站：永久删除前二次确认。
- [x] 日历：日期列表、当天卡片、当天统计、日报展示。
- [x] 搜索：自然语言输入、搜索结果、选卡区、问答区、引用展示。
- [x] 文章推荐：分类按钮、文章列表、导入入口、原文入口。
- [x] 文章推荐：预览面板、已导入状态。
- [x] 设置：模型/API 配置缺失提示、备份入口、导出入口。

### 2.4 视觉和状态草图

- [ ] 画出页面级 loading。
- [ ] 画出列表 loading 骨架屏。
- [ ] 画出按钮 loading。
- [ ] 画出空知识库、空文件夹、搜索无结果、日历当天无内容。
- [ ] 画出导入失败、模型/API 缺失、写库失败等错误状态。
- [ ] 画出三栏切换、弹窗进入退出、卡片 hover/选中、toast 反馈。
- [ ] 按 `docs/product/design.md` 检查视觉方向：安静、本地资料库、低干扰、非营销化。

## 3. 数据模型和类型

> 目标：先把前端领域模型稳定下来，再和真实后端 API 做字段映射。当前 `src/types/index.ts` 是第一版类型，后续需要逐步补成可支撑编辑、回收站、搜索问答和真实导入任务的完整模型。

### 3.1 前端领域类型

- [x] 定义 `Folder`。
- [x] 补充 `Folder` 字段：`parentId`、`isSystem`、`createdAt`、`updatedAt`、`sortOrder`。
- [x] 定义 `KnowledgeItem`，用于承接原始抓取内容、解析正文、分块文本和 embedding 状态。
- [x] 定义 `KnowledgeCard`。
- [x] 补充 `KnowledgeCard` 字段：`sourceType`、`author`、`publishedAt`、`wordCount`、`readingTime`。
- [x] 补充 `KnowledgeCard` 编辑字段：`userTitle`、`userSummary`、`note`、`lastEditedAt`、`editedByUser`。
- [x] 补充 `KnowledgeCard` 维护字段：`deletedAt`、`deletedFromFolderId`、`archivedAt`、`refreshStatus`。
- [x] 定义 `ImportTask`。
- [x] 补充 `ImportTask` 字段：`stage`、`progress`、`errorCode`、`errorMessage`、`retryCount`、`resultCardId`。
- [x] 定义 `ImportTaskStage` 枚举类型，避免页面硬编码阶段文案。
- [x] 定义 `DailyActivity`，用于 Home 热力图和日历聚合。
- [x] 补充 `DailyActivity` 字段：`tokenCount`、`wordCount`、`cardIds`。
- [x] 定义 `DailyReport`。
- [x] 补充 `DailyReport` 字段：`date`、`summary`、`topics`、`keywords`、`highlightCardIds`、`createdAt`。
- [x] 定义 `HotArticle`。
- [x] 补充 `HotArticle` 字段：`category`、`reason`、`importTaskId`、`importedCardId`。
- [x] 定义 `SearchResult`。
- [x] 补充 `SearchResult` 字段：`cardId`、`score`、`matchedText`、`matchedField`、`highlights`。
- [x] 定义 `AnswerResponse`。
- [x] 补充 `AnswerResponse` 字段：`answer`、`citations`、`usedCardIds`、`model`、`createdAt`。
- [x] 定义引用来源类型，用于问答引用和跳回卡片详情。
- [x] 定义通用 `ApiError` 类型：`type`、`message`、`stage`、`recoverable`、`context`。
- [x] 定义通用分页类型：`PageRequest`、`PageResponse<T>`，为后续卡片列表和搜索结果预留。
- [x] 定义通用排序类型：`SortOption`，覆盖 `createdAt`、`updatedAt`、`title`、`source`。

### 3.2 状态模型

- [x] 定义当前前端导入任务状态：`pending`、`running`、`succeeded`、`failed`。
- [x] 对齐 PRD 导入任务状态：`pending`、`running`、`succeeded`、`failed`。
- [x] 定义导入任务阶段：`waiting`、`fetching`、`summarizing`、`embedding`、`saving`、`done`、`failed`。
- [x] 定义导入任务阶段到中文文案、图标、颜色和可恢复操作的映射。
- [x] 定义导入任务轮询策略：运行中轮询、成功停止、失败停止并展示重试。
- [x] 定义当前卡片状态：文件夹归属、多标签、备注、重要标记、坏数据标记、软删除状态。
- [x] 定义系统文件夹规则：“未分类”不可删除。
- [x] 定义回收站规则：通过软删除实现，不作为普通文件夹。
- [x] 定义卡片和文件夹关系：每张卡片有且只有一个文件夹，文件夹单层结构。
- [x] 定义错误结构：错误类型、错误原因、失败阶段、上下文信息、可恢复操作。
- [x] 定义编辑状态：草稿、保存中、保存成功、保存失败、脏数据提示。
- [x] 定义搜索问答状态：空输入、搜索中、有结果、无结果、回答生成中、回答失败。
- [x] 定义热点文章状态：未导入、导入中、已导入、导入失败。
- [x] 定义页面级加载状态：首次加载、局部刷新、后台同步。
- [x] 定义空状态触发条件：空知识库、空文件夹、空日期、搜索无结果、推荐为空。

### 3.3 后端数据模型

- [x] 新增 `folder` 表。
- [x] `folder` 表字段：`id`、`name`、`parent_id`、`is_system`、`sort_order`、`created_at`、`updated_at`。
- [x] 初始化系统文件夹“未分类”。
- [x] 新增 `import_task` 表。
- [x] `import_task` 表字段：`id`、`url`、`folder_id`、`status`、`stage`、`progress`、`error_code`、`error_message`、`retry_count`、`result_card_id`、`created_at`、`updated_at`。
- [x] 扩展 `knowledge_card.folder_id`。
- [x] 扩展 `knowledge_card.note`。
- [x] 扩展 `knowledge_card.is_important`。
- [x] 扩展 `knowledge_card.is_bad`。
- [x] 扩展 `knowledge_card.deleted_at`。
- [x] 扩展 `knowledge_card.deleted_from_folder_id`。
- [x] 扩展 `knowledge_card.refresh_status`。
- [x] 扩展 `knowledge_card.last_refreshed_at`。
- [x] 扩展 `knowledge_card.user_title`、`user_summary`，避免覆盖 AI 生成内容。
- [x] 新增或确认标签关系表，用于多标签筛选。
- [x] 新增或确认搜索索引字段，保证回收站内容默认不参与检索。
- [x] 评估是否扩展 `knowledge_item.word_count`；若不扩展，使用 `raw_text` 长度动态统计。
- [x] 明确软删除策略：普通查询默认过滤 `deleted_at is null`。
- [x] 明确永久删除策略：先删向量/索引，再删卡片和原文。
- [x] 明确迁移策略：现有无文件夹内容自动归入“未分类”。

### 3.4 Mock 数据

- [x] 准备文件夹 mock 数据，包含“未分类”和多个用户文件夹。
- [x] 补充系统文件夹 mock 标记：`isSystem: true`。
- [x] 准备知识卡片 mock 数据，覆盖不同文件夹、标签、来源、创建日期。
- [x] 补充知识卡片 mock：长标题、长来源域名、无摘要、无标签、坏数据、重要标记。
- [x] 准备导入任务 mock 数据，覆盖 pending/running/succeeded/failed。
- [x] 对齐导入任务 mock 状态命名，避免 `importing/success/error` 和 PRD 状态长期并存。
- [x] 补充导入任务阶段 mock：抓取中、摘要中、embedding 中、写库中、失败可重试。
- [x] 准备日历 mock 数据，覆盖有内容日期和空日期。
- [x] 准备日报 mock 展示内容。
- [x] 补充日报 mock：关键词、主题、值得回看的卡片。
- [x] 准备搜索结果 mock 数据。
- [x] 补充搜索 mock：高亮片段、相关性分数、来源字段。
- [x] 准备问答结果和引用 mock 数据。
- [x] 补充问答 mock：多引用、引用跳转目标、回答失败。
- [x] 准备文章推荐 mock 数据。
- [x] 补充已导入热点状态样例。
- [x] 建立 mock API 数据源层，保证字段后续能平滑映射真实 API。
- [x] 将页面直接引用 `src/mock/data.ts` 的地方逐步替换为 `src/api/*`。
- [x] 为 mock 数据源增加 reset 方法，方便测试每次从干净状态开始。
- [x] 为 mock 数据源补齐编辑/删除等写操作。
- [x] 为 mock 数据源补齐恢复等写操作。
- [x] 为 mock 数据源补齐新增文件夹和新增导入任务写操作。

### 3.5 数据契约和映射

- [x] 建立前端领域类型和后端响应 DTO 的映射表。
- [x] 明确前端 camelCase、后端 snake_case 的转换位置。
- [x] 明确日期字段统一使用 ISO string，页面层再格式化展示。
- [x] 明确空值策略：空字符串、`null`、缺失字段在前端的处理方式。
- [x] 明确错误码枚举：网络错误、抓取失败、模型缺失、解析失败、写库失败。
- [x] 明确搜索和问答引用如何从 chunk 映射回卡片。
- [x] 明确统计字段来源：文章数、字数、Token、文件夹数、本周导入数。

## 4. 前端基础和组件

> 目标：把当前可跑的 FRONT 页面整理成可持续开发的前端架构。先保持视觉不大改，再逐步补 Query、UI store、表单校验、组件复用和真实 API 切换。

### 4.1 项目基础

- [x] 初始化 Vite React TypeScript 项目。
- [x] 配置 TypeScript strict mode。
- [x] 配置 ESLint。
- [x] 配置 Prettier。
- [x] 配置 Vitest。
- [x] 接入 `lucide-react`。
- [x] 接入 `date-fns`。
- [x] 接入 Tailwind CSS v4 和 `src/index.css`。
- [x] 建立 React Router 路由。
- [x] 统一路由常量，避免侧边栏和 `App.tsx` 分别硬编码路径。
- [x] 建立页面标题和导航文案常量，避免“首页/数据看板”等文案漂移。
- [x] 建立环境变量声明：`VITE_API_BASE_URL`、`VITE_USE_MOCK_API`。
- [x] 配置路径别名，例如 `@/components`、`@/api`、`@/types`。
- [x] 建立 TanStack Query Provider。
- [x] 建立 Query key 工厂：home、folders、cards、imports、calendar、search、hot。
- [x] 建立 Query 默认策略：短 staleTime、失败重试次数、后台刷新开关。
- [x] 建立 Zustand UI store。
- [x] UI store 管理：侧边栏折叠、知识库展开、当前视图模式、导入弹窗、toast。
- [x] 建立 React Hook Form + Zod 表单基础。
- [x] 建立表单校验 schema：导入链接、文件夹、新建文件夹、卡片编辑、搜索问答。
- [x] 建立测试 setup，覆盖 Vitest 和 React Testing Library。
- [x] 建立基础 lint/build/test 命令作为提交前验证。

### 4.2 API 和数据源抽象

- [x] 建立 `src/api/client.ts`。
- [x] 在 `client.ts` 中实现真实 `fetchJson`：baseURL、headers、JSON 解析、错误转换。
- [x] 在 `client.ts` 中实现 mock/real 数据源选择，而不是只暴露 env 常量。
- [x] 建立 `src/api/home.ts`。
- [x] 建立 `src/api/folders.ts`。
- [x] 建立 `src/api/cards.ts`。
- [x] 建立 `src/api/imports.ts`。
- [x] 建立 `src/api/calendar.ts`。
- [x] 建立 `src/api/search.ts`。
- [x] 建立 `src/api/hot.ts`。
- [x] 建立 mock service 层。
- [ ] 拆分 mock service：读操作、写操作、测试 reset、模拟延迟。
- [x] 让 Query hooks 第一阶段指向 mock service。
- [x] 建立 `src/queries/home.ts`。
- [x] 建立 `src/queries/folders.ts`。
- [x] 建立 `src/queries/cards.ts`。
- [x] 建立 `src/queries/imports.ts`。
- [x] 建立 `src/queries/calendar.ts`。
- [x] 建立 `src/queries/search.ts`。
- [x] 建立 `src/queries/hot.ts`。
- [x] 预留真实 API 数据源切换开关。
- [x] 为核心 API 方法补齐输入/输出类型和单元测试。
- [x] 让 Home、日历从 Query hooks 读取数据。
- [x] 搜索从 Query hooks 读取数据。
- [x] 文章推荐从 Query hooks 读取数据。
- [x] 知识库列表和详情从 Query hooks 读取数据。
- [x] 接入导入弹窗提交到 `createImportTask`，并刷新最近导入任务。
- [x] 接入热点文章导入入口到同一套导入任务逻辑。
- [x] 接入错误状态映射，避免页面直接展示底层错误对象。

### 4.3 通用组件

- [x] 实现主布局组件：左侧导航 + 内容区。
- [x] 实现渐进式三栏布局组件。
- [x] 三栏布局支持：列表宽度固定、详情区滚动、关闭详情、窄屏逐级进入。
- [x] 实现主导航组件。
- [x] 实现知识库文件夹导航组件。
- [x] 文件夹导航支持：重命名、删除、系统文件夹保护。
- [x] 文件夹创建能力已接入 mock 数据源和导入弹窗。
- [x] 实现按钮组件：`primary`、`secondary`、`ghost`、`danger`、`icon`。
- [x] 按钮组件支持：loading、disabled、icon-only、危险操作状态。
- [x] 实现卡片组件。
- [x] 卡片组件支持：普通卡片、紧凑卡片、选中态、长标题截断。
- [x] 实现紧凑列表项组件。
- [x] 实现标签组件。
- [x] 标签组件支持：普通标签、可删除标签、添加标签入口。
- [x] 实现状态徽标组件。
- [x] 状态徽标覆盖：导入中、完成、失败、已导入、重要、坏数据。
- [x] 实现表单输入组件。
- [x] 实现文件夹选择组件。
- [x] 实现导入弹窗组件。
- [x] 导入弹窗支持：URL 校验、目标文件夹必选/默认未分类、新建文件夹、提交中、错误展示。
- [x] 实现确认弹窗组件。
- [x] 实现空状态组件。
- [x] 实现错误状态组件。
- [x] 实现加载中组件和骨架屏。
- [x] 实现轻量 toast 或状态反馈组件。
- [x] 实现热力图组件，从 Home 页面中抽离。
- [x] 实现日期列表组件，从日历页面中抽离。
- [x] 实现富文本/Markdown 只读内容块，用于摘要、原文和日报。
- [x] 实现引用来源组件，用于搜索问答回答中的引用跳转。

### 4.4 页面接入顺序

- [x] Home：从 `src/api/home.ts` 读取统计、热力图、最近导入。
- [x] 导入弹窗：接入 `createImportTask`，提交后刷新最近导入 Query 缓存。
- [x] 知识库：从 `src/api/folders.ts` 和 `src/api/cards.ts` 读取文件夹和卡片。
- [x] 卡片详情：接入编辑、移动、标记、删除。
- [x] 日历：从 `src/api/calendar.ts` 读取日期聚合和当天卡片。
- [x] 搜索：从 `src/api/search.ts` 读取结果，并接入问答响应。
- [x] 文章推荐：从 `src/api/hot.ts` 读取推荐文章，并接入导入任务。
- [x] 设置：展示 API/模型配置状态，提供备份导出入口。

### 4.5 前端测试补充

- [x] API mock 数据源已有基础 Vitest 覆盖。
- [x] `client.ts` 测试：JSON 解析、错误转换、mock/real 数据源切换。
- [x] `ImportModal` 测试：URL 输入、文件夹选择、新建文件夹、提交校验。
- [x] `Sidebar` 测试：导航文案、知识库展开、文件夹跳转。
- [x] `Home` 测试：统计卡片、热力图月份、最近导入状态。
- [x] `KnowledgeBase` 测试：文件夹筛选、卡片选中、详情展示。
- [x] `Search` 测试：搜索、选卡、提问、引用展示。
- [x] `Recommendations` 测试：分类按钮、文章状态、导入入口。
- [x] Query hooks 测试：mock 数据读取、错误映射、缓存刷新。

## 5. Mock 前端页面和交互

### 5.1 Home

- [x] 展示累计文章数。
- [x] 展示累计文字数。
- [x] 展示文件夹数。
- [x] 展示本周导入数。
- [x] 实现知识活动热力图。
- [x] 热力图 hover 展示当天文章数和文字数。
- [x] 热力图点击进入日历并定位日期。
- [x] 展示最近导入任务。
- [x] 最近导入支持 `导入中`、`导入成功`、`导入失败`。
- [x] 导入失败展示失败原因和重试入口。
- [x] 展示文章推荐摘要。
- [x] 推荐摘要点击进入文章推荐页。

### 5.2 导入弹窗

- [x] 左侧 `+ 导入` 打开导入弹窗。
- [x] 文章推荐页导入操作复用导入弹窗。
- [x] 支持 URL 输入。
- [x] 支持目标文件夹选择。
- [x] 支持新建文件夹入口。
- [x] 未选择文件夹时禁止开始导入。
- [x] 一次只允许导入一个 URL。
- [x] mock API 数据源支持创建导入任务。
- [x] 导入弹窗提交后接入 mock 创建导入任务。
- [x] mock 导入任务阶段流转。
- [x] mock 导入成功后生成卡片。
- [x] mock 导入失败后保留 URL 和目标文件夹。
- [x] mock 导入失败支持重试。
- [x] 导入开始后允许关闭弹窗。

### 5.3 知识库

- [x] 默认进入“全部收藏”。
- [x] 支持网格视图。
- [x] 支持紧凑列表视图。
- [x] 支持按文件夹筛选。
- [x] 支持按标签筛选。
- [x] 支持按来源筛选。
- [x] 支持按时间排序。
- [x] 默认排除回收站内容。
- [x] 点击卡片后进入三栏布局。
- [x] 支持关闭详情栏回到双栏。
- [x] 文件夹支持 mock 新建。
- [x] 文件夹支持 mock 重命名。
- [x] 文件夹支持 mock 删除。
- [x] 删除文件夹时卡片 mock 移动到“未分类”。
- [x] 系统文件夹“未分类”不允许删除。

### 5.4 卡片详情

- [x] 展示标题。
- [x] 展示来源链接。
- [x] 展示来源站点。
- [x] 展示文件夹名称。
- [x] 展示标签。
- [x] 展示 AI 摘要。
- [x] 展示原文预览。
- [x] 支持查看完整原文。
- [x] 展示纯文本备注。
- [x] 展示更新时间。
- [x] 展示创建时间。
- [x] 展示重要标记。
- [x] 展示坏数据标记。
- [x] 支持 mock 编辑标题。
- [x] 支持 mock 编辑摘要。
- [x] 支持 mock 编辑标签。
- [x] 支持 mock 编辑备注。
- [x] 支持 mock 移动到其他文件夹。
- [x] 支持打开来源链接。
- [x] 支持 mock 重新抓取原文。
- [x] 支持 mock 重新生成摘要和标签。
- [x] 支持标记或取消标记重要。
- [x] 支持标记或取消标记坏数据。
- [x] 支持移到回收站。
- [x] 重新抓取前明确提示可能覆盖内容。
- [x] 重新生成摘要/标签前明确提示可能覆盖内容。
- [x] 覆盖用户手动编辑内容时二次确认。

### 5.5 回收站

- [x] 普通删除进入回收站。
- [x] 知识库列表默认排除回收站内容。
- [x] 搜索默认排除回收站内容。
- [x] 问答默认排除回收站内容。
- [x] 日历默认排除回收站内容。
- [x] 支持从回收站恢复卡片。
- [x] 恢复时优先回到原文件夹。
- [x] 原文件夹不存在时恢复到“未分类”。
- [x] 支持 mock 永久删除。
- [x] 永久删除前二次确认。

### 5.6 日历和日报

- [x] 日历页按日期展示导入卡片。
- [x] 支持从左侧导航进入日历。
- [x] 支持从 Home 热力图进入指定日期。
- [x] 日期详情展示当天导入卡片列表。
- [x] 日期详情展示当天文章数。
- [x] 日期详情展示当天文字数。
- [x] 日期详情支持打开卡片详情。
- [x] 展示 mock 当天日报。
- [x] 日报包含当天导入文章列表。
- [x] 日报包含当天知识内容总结。
- [x] 日报包含主题。
- [x] 日报包含关键词。
- [x] 日报包含值得回看的卡片。
- [ ] 日报第一版不保存为知识库卡片。

### 5.7 搜索和 AI 问答

- [x] 实现自然语言搜索输入。
- [x] mock 查询改写。
- [x] mock 召回匹配卡片。
- [x] 搜索结果展示标题、摘要、来源、文件夹、标签和相关性信息。
- [x] 支持选择一张或多张卡片。
- [x] 支持基于所选卡片提问。
- [x] mock 基于所选卡片和原文生成回答。
- [x] 回答展示引用来源。
- [x] 引用支持跳回卡片详情。
- [x] 搜索和问答默认不使用回收站内容。

### 5.8 文章推荐

- [x] 展示热点文章列表。
- [x] 展示分类按钮。
- [x] 支持分类筛选：全部、AI 产品、技巧、精选。
- [x] 点击文章打开预览面板。
- [x] 列表展示标题。
- [x] 列表展示来源。
- [x] 列表展示发布时间。
- [x] 列表展示简介。
- [x] 列表展示原链接。
- [x] 列表中提供单篇导入入口。
- [x] 导入支持选择文件夹。
- [x] 已导入文章展示状态，避免重复导入。
- [x] 第一版不做批量导入。

### 5.9 设置、备份和导出

- [x] 建立设置页入口。
- [x] 建立备份入口。
- [x] 建立导出入口。
- [x] 设置页至少能展示模型/API 配置缺失提示。
- [x] 模型不可用时，相关功能提示清楚，不静默失败。

## 6. 真实后端和产品 API

> 当前已建立 `backend/app` FastAPI 产品 API 壳，使用本地 SQLite store 对齐前端字段和交互；抓取、摘要、embedding、FTS/向量检索和问答已接入 `backend/reference/local_rag`。
> 2026-06-11 更新：产品 API 壳已从 JSON 持久化升级为 SQLite 表结构，数据位于 `backend/data/product_store.sqlite3`；RAG 数据默认位于 `DATA_DIR` 指向的 local_rag 数据目录。

### 6.1 后端业务

- [x] 从 `backend/reference/local_rag` 迁移或复用 FastAPI/RAG 基础能力。
- [x] 实现文件夹业务：创建、重命名、删除、系统文件夹保护。
- [x] 实现删除文件夹时卡片移动到“未分类”。
- [x] 实现导入任务创建、阶段更新、成功记录和失败记录。
- [x] 实现导入任务重试。
- [x] 实现第一版本地持久化，避免重启后数据全部丢失。
- [x] 保留现有链接抓取、摘要、embedding、写库链路。
- [x] 确保模型 API key 缺失时返回明确错误。
- [x] 实现 Home 统计聚合。
- [x] 实现知识活动热力图数据聚合。
- [x] 实现日历按日期聚合。
- [x] 实现日报生成。
- [x] 实现文章推荐数据获取。
- [x] 实现热点文章已导入状态识别，避免重复导入。
- [x] 确保评测工作台不进入主应用导航。

### 6.2 产品 API

- [x] `GET /api/home/summary`
- [x] `GET /api/home/activity`
- [x] `GET /api/import-tasks/recent`
- [x] `POST /api/import-tasks`
- [x] `POST /api/import-tasks/{task_id}/retry`
- [x] `GET /api/folders`
- [x] `POST /api/folders`
- [x] `PATCH /api/folders/{folder_id}`
- [x] `DELETE /api/folders/{folder_id}`
- [x] `GET /api/cards`
- [x] `GET /api/cards/{card_id}`
- [x] `PATCH /api/cards/{card_id}`
- [x] `DELETE /api/cards/{card_id}`
- [x] `POST /api/cards/{card_id}/restore`
- [x] `DELETE /api/cards/{card_id}/permanent`
- [x] `POST /api/cards/{card_id}/refresh`
- [x] `POST /api/cards/{card_id}/regenerate`
- [x] `GET /api/calendar/days`
- [x] `GET /api/calendar/days/{date}`
- [x] `POST /api/calendar/days/{date}/daily-report`
- [x] `GET /api/hot/articles`
- [x] `GET /api/hot/articles/{article_id}`
- [x] `POST /api/hot/articles/{article_id}/import`
- [x] `POST /search`
- [x] `POST /answer`

## 7. 替换 mock 数据源

- [x] 将 API client 数据源从 mock service 切换到真实 FastAPI。
- [x] 配置 `VITE_API_BASE_URL=http://127.0.0.1:8001` 的读取、开发态默认值和文档说明。
- [x] 对齐前端领域类型和真实 API 响应字段。
- [x] 对齐错误结构和前端错误状态展示。
- [x] 对齐导入任务状态和阶段文案。
- [x] 对齐文件夹数据映射。
- [x] 对齐卡片数据映射。
- [x] 对齐回收站数据映射。
- [x] 对齐日历和日报数据映射。
- [x] 对齐搜索和问答数据映射。
- [x] 对齐文章推荐数据映射。
- [x] 保留 mock 数据开关，用于离线开发和视觉回归。
- [ ] 验证真实接口下 Home 状态展示正确。
- [x] 验证真实接口下导入单个链接到指定文件夹。
- [x] 验证真实接口下导入失败、模型配置缺失和重试入口。
- [ ] 验证真实接口下知识库双栏/三栏切换自然。
- [ ] 验证真实接口下卡片查看、编辑、移动和状态标记。
- [ ] 验证真实接口下回收站、恢复和永久删除。
- [ ] 验证真实接口下日历日期详情和日报生成。
- [x] 验证真实接口下搜索、选卡问答和引用跳转。
- [ ] 验证真实接口下文章推荐预览和单篇导入。

## 8. 视觉、状态和响应式验收

### 8.1 视觉规范

- [ ] 页面整体保持白色、浅灰、近黑为主。
- [ ] 避免大面积渐变、光晕、装饰球和玻璃拟态。
- [x] 左侧导航宽度稳定，当前按截图基准为 `264px`。
- [ ] `+ 导入` 醒目但不过度花哨。
- [ ] 卡片圆角控制在 `8px - 12px`。
- [ ] 标签使用浅灰胶囊样式。
- [ ] 状态色只小面积使用。
- [ ] 热力图使用单一蓝色阶梯。
- [ ] 详情区适合阅读，信息不拥挤。
- [ ] 文案短、直接、少解释。
- [ ] 图标保持线性、轻量、统一尺寸。
- [ ] 不把 AI 问答做成唯一主舞台。
- [ ] 不把评测工作台放进主应用导航。
- [ ] 长标题、长标签、长来源域名不撑破布局。

### 8.2 状态和动效

- [ ] 页面级加载使用骨架屏或轻量占位区。
- [ ] 列表加载使用 3 到 5 条骨架列表项。
- [ ] 按钮加载时按钮尺寸不变。
- [ ] 导入任务作为后台任务展示，不阻塞浏览。
- [ ] 空状态包含短标题、弱提示和明确行动。
- [ ] 搜索无结果时不清空输入。
- [ ] 错误状态说明发生了什么、影响范围和下一步操作。
- [ ] 导入失败展示 URL、目标文件夹、失败阶段、失败原因和重试入口。
- [ ] 模型/API 错误提供进入设置或重试入口。
- [ ] 不使用浏览器默认 alert。
- [ ] 常规过渡控制在 `120ms - 180ms`。
- [ ] 弹窗进入退出控制在 `160ms - 220ms`。
- [ ] 卡片 hover 不放大、不弹跳。
- [x] 保存成功使用短暂状态文字或轻量 toast。
- [ ] 风险操作通过确认弹窗，不只依赖 toast。

### 8.3 响应式

- [x] 窄屏时左侧导航可折叠。
- [ ] 窄屏时知识库从三栏降级为逐级进入。
- [ ] 卡片网格降级为单列列表。
- [ ] 弹窗宽度使用屏幕安全边距。
- [ ] 文字不能溢出按钮或卡片。

## 9. 测试和验证

### 9.1 后端测试

- [x] 文件夹 CRUD。
- [x] 导入任务状态流转。
- [x] 导入成功写入文件夹。
- [x] 导入失败记录错误。
- [ ] 卡片编辑。
- [x] 软删除、恢复、永久删除。
- [x] 搜索排除回收站。
- [x] 日历聚合。
- [ ] 日报生成失败提示。

### 9.2 前端测试

- [x] Vitest：API mock 数据源适配。
- [x] Vitest：工具函数、状态转换。
- [x] React Testing Library：关键组件行为。
- [ ] Playwright：导航可用。
- [ ] Playwright：导入弹窗可用。
- [ ] Playwright：Home 状态展示正确。
- [ ] Playwright：知识库双栏/三栏切换自然。
- [ ] Playwright：错误状态和空状态符合规范。
- [ ] Playwright：窄屏基本可用。

### 9.3 E2E 验收

- [ ] 导入单个链接到指定文件夹。
- [ ] 查看、编辑和维护卡片。
- [ ] 回收站、恢复和永久删除。
- [ ] 日历日期详情和日报生成。
- [ ] 搜索、选卡问答和引用跳转。
- [ ] 文章推荐预览和单篇导入。
- [ ] 复查 `docs/product/prd.md` 验收标准。
- [ ] 复查 `docs/product/design.md` 设计验收清单。
