# 别吃灰 Web 技术栈规划

日期：2026-06-10

## 目标

先构建一个可在浏览器中运行的网页端应用，再为后续网页套壳桌面应用预留架构空间。网页端和桌面端尽量复用同一套 UI、路由、状态管理和 API 调用层。

第一阶段只做 Web，不做桌面套壳代码。

## 推荐技术栈

### 前端框架

- React
- TypeScript
- Vite

选择理由：

- Vite 启动快，适合本地应用开发。
- React 生态成熟，适合构建多页面工作台、三栏布局、弹窗、列表和详情页。
- TypeScript 能让 API 数据结构、卡片状态、导入任务状态更稳定。
- 后续迁移到 Tauri 或 Electron 套壳时，Vite 构建产物可直接复用。

### 路由

- React Router

建议路由：

```text
/home
/library
/library/folder/:folderId
/library/trash
/calendar
/calendar/:date
/search
/hot
/settings
```

选择理由：

- 页面结构清晰。
- 浏览器端和桌面套壳端都能复用。
- 后续支持深链和刷新恢复。

### 服务端状态

- TanStack Query

使用范围：

- Home 统计。
- 导入任务列表。
- 文件夹列表。
- 卡片列表和详情。
- 日历聚合。
- AI 热点推荐。
- 搜索和问答请求。

选择理由：

- 自动缓存、刷新和错误状态管理成熟。
- 适合导入任务轮询。
- 能减少手写 loading/error/retry 逻辑。

### 本地 UI 状态

- Zustand

使用范围：

- 当前导航折叠状态。
- 知识库网格/列表视图偏好。
- 当前选中卡片。
- 导入弹窗开关。
- 轻量筛选条件。

选择理由：

- API 简单。
- 比 Redux 更轻。
- 适合本地工作台应用。

### 表单

- React Hook Form
- Zod

使用范围：

- 导入弹窗 URL 和文件夹选择。
- 文件夹新建/重命名。
- 卡片详情编辑。
- 设置页表单。

选择理由：

- React Hook Form 性能好，样板代码少。
- Zod 可以复用数据校验规则，和 TypeScript 配合稳定。

### 样式方案

- CSS Modules
- 全局 design tokens

暂不建议第一版使用 Tailwind。

选择理由：

- 当前设计强调克制、稳定、细节统一，不需要大量 utility class。
- CSS Modules 足够支撑页面级和组件级样式隔离。
- design tokens 能统一颜色、间距、圆角、字号和阴影。

建议结构：

```text
src/styles/
  tokens.css
  global.css
  layout.css
```

### 图标

- lucide-react

选择理由：

- 线性图标风格符合设计规范。
- 图标覆盖导航、操作、状态等常见场景。
- 与 React 技术栈匹配。

### 日期处理

- date-fns

使用范围：

- 日历页。
- Home 热力图。
- 导入任务时间显示。
- 最近导入分组。

选择理由：

- 轻量。
- 函数式 API 清晰。
- 不需要 Moment 这类重依赖。

### 图表和热力图

第一版建议手写轻量热力图组件，不引入重型图表库。

原因：

- Home 热力图是固定形态的小方块网格。
- 手写组件更容易贴合参考图气质。
- 避免 ECharts/Recharts 带来不必要复杂度。

后续如果统计图增加，再评估 Recharts。

### API 客户端

- fetch 封装
- TypeScript 类型定义
- TanStack Query hooks

建议分层：

```text
src/api/
  client.ts
  home.ts
  folders.ts
  cards.ts
  imports.ts
  calendar.ts
  search.ts
  hot.ts
```

`client.ts` 负责：

- base URL。
- JSON 序列化。
- 错误解析。
- 超时或取消。

### 测试

- Vitest
- React Testing Library
- Playwright

测试分层：

- Vitest：工具函数、状态转换、API 数据适配。
- React Testing Library：关键组件行为。
- Playwright：导航、导入弹窗、知识库双栏/三栏、Home 状态等端到端流程。

### 代码质量

- ESLint
- Prettier
- TypeScript strict mode

建议第一版开启 TypeScript strict，避免数据结构随功能扩张变散。

## 未来桌面套壳技术选择

### 推荐：Tauri

桌面端优先考虑 Tauri。

理由：

- 安装包更小。
- 资源占用低。
- 适合本地工具类应用。
- 可以复用 Vite 构建产物。
- 后续可接入本地文件系统、托盘、自动更新等桌面能力。

需要注意：

- Tauri 需要 Rust 工具链。
- Windows 上打包和签名需要单独处理。
- 如果团队不想引入 Rust，Electron 是备选方案。

### 备选：Electron

Electron 的优势：

- 生态成熟。
- 桌面能力丰富。
- 调试资料多。

Electron 的劣势：

- 体积更大。
- 资源占用更高。
- 对“本地个人知识库”这种轻工具来说偏重。

## 与后端的关系

第一阶段 Web 应用调用现有本地 FastAPI 服务。

建议开发模式：

```text
Vite dev server: http://127.0.0.1:5173
FastAPI server:   http://127.0.0.1:8000
```

前端通过环境变量配置 API 地址：

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
```

后续桌面端可以有两种模式：

1. 桌面壳启动本地 FastAPI 服务，再加载 Web UI。
2. 桌面壳只加载 UI，要求用户自行启动本地服务。

第一版 Web 阶段不处理桌面服务编排。

## 建议目录结构

```text
src/
  app/
    App.tsx
    router.tsx
  api/
    client.ts
    home.ts
    folders.ts
    cards.ts
    imports.ts
    calendar.ts
    search.ts
    hot.ts
  components/
    layout/
    cards/
    dialogs/
    navigation/
    status/
  features/
    home/
    import/
    library/
    calendar/
    search/
    hot/
    settings/
  stores/
    uiStore.ts
  styles/
    tokens.css
    global.css
  types/
    api.ts
```

## 第一阶段实施顺序

1. 初始化 Vite React TypeScript 项目。
2. 配置 ESLint、Prettier、Vitest。
3. 建立 design tokens 和全局样式。
4. 搭建主导航和基础路由。
5. 实现 Home 静态版。
6. 实现导入弹窗和最近导入状态接入。
7. 实现知识库列表、文件夹下拉和详情栏。
8. 实现日历和热力图。
9. 实现搜索两段式流程。
10. 实现 AI 热点推荐页。

## 暂不采用

- Next.js：当前不需要 SSR、文件路由或服务端渲染。
- Tailwind：设计需要更精细的组件规范，CSS Modules 更适合第一版控制气质。
- Redux：状态需求不复杂，Zustand 足够。
- ECharts：Home 热力图可手写，不需要重型图表库。
- Electron：桌面阶段再评估，当前优先 Tauri。
