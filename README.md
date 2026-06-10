# 别吃灰 Web

别吃灰 Web 是本地个人知识库管理应用的网页端。第一阶段先实现浏览器中的 Web 应用，后续再基于同一套前端做网页套壳桌面应用。

## 产品方向

第一版聚焦轻量收藏整理：

- 单链接导入。
- Home 数据看板。
- 知识库文件夹和卡片管理。
- 日历与日报。
- 模糊记忆搜索和选卡问答。
- AI 热点文章推荐。

## 文档

- [产品 PRD](docs/product/prd.md)
- [视觉设计规范](docs/product/design.md)
- [技术架构](docs/architecture/technical-architecture.md)
- [技术栈规划](docs/tech-stack.md)

## 技术路线

网页端采用 React、TypeScript 和 Vite。桌面端后续优先考虑 Tauri 套壳，同一套 Web UI 复用到桌面应用中。

详细技术栈见 [docs/tech-stack.md](docs/tech-stack.md)。

## 当前状态

本仓库当前只包含技术规划文档，尚未初始化前端代码。
