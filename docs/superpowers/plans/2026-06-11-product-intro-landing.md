# Product Intro Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 `/` 产品介绍落地页，并把现有应用工作区迁移到 `/app`。

**Architecture:** `Landing` 页面独立于 `AppLayout` 渲染，作为公开介绍页；`/app/*` 路由继续使用现有 `AppLayout` 和应用页面。路由常量集中在 `src/app/routes.ts`，旧应用路径通过重定向兼容。

**Tech Stack:** React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, lucide-react, Vitest, Testing Library。

---

## 文件结构

- 创建：`src/pages/Landing.tsx`
  - 负责公开产品介绍页的全部内容和页面内区块。
  - 包含 hero、核心工作流、每日知识日报、AI 热点推荐、辅助能力、底部 CTA。
- 创建：`src/App.test.tsx`
  - 覆盖 `/`、`/app`、`立即使用` CTA 和旧路由重定向。
- 修改：`src/app/routes.ts`
  - 新增 landing/app 路由常量。
  - 将主应用导航路径改到 `/app/*`。
- 修改：`src/App.tsx`
  - 让 `/` 渲染 `Landing`。
  - 让 `/app/*` 渲染 `AppLayout` 和现有页面。
  - 增加旧路由到新路由的重定向。
- 修改：`src/components/layout/Sidebar.test.tsx`
  - 更新初始路由和预期跳转路径。
- 修改：`src/pages/Search.test.tsx`
  - 更新初始路由和引用跳转路径。

---

### Task 1: 添加路由集成测试

**Files:**
- Create: `src/App.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/App.test.tsx`：

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetMockSource } from './api/mockSource';
import App from './App';

const renderAppAt = (path: string) => {
  window.history.pushState({}, '', path);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
};

describe('App routes', () => {
  beforeEach(() => {
    resetMockSource();
    window.history.pushState({}, '', '/');
  });

  it('renders the public landing page at /', () => {
    renderAppAt('/');

    expect(screen.getByRole('heading', { name: '别让收藏继续吃灰' })).toBeInTheDocument();
    expect(screen.getByText(/从一个链接开始，建立你的本地个人知识库/)).toBeInTheDocument();
    expect(screen.getByText('每日知识日报')).toBeInTheDocument();
    expect(screen.getByText('AI 热点推荐')).toBeInTheDocument();
  });

  it('navigates from the landing page to the app workspace', async () => {
    renderAppAt('/');

    fireEvent.click(screen.getByRole('link', { name: '立即使用' }));

    await waitFor(() => expect(window.location.pathname).toBe('/app'));
    expect(await screen.findByRole('heading', { name: '首页' })).toBeInTheDocument();
  });

  it('renders the app dashboard at /app', async () => {
    renderAppAt('/app');

    expect(await screen.findByRole('heading', { name: '首页' })).toBeInTheDocument();
    expect(screen.getByText('你的知识库数据概览与近期活动。')).toBeInTheDocument();
  });

  it('redirects legacy app routes to the /app workspace routes', async () => {
    renderAppAt('/knowledge?card=c-1');

    await waitFor(() => expect(window.location.pathname).toBe('/app/knowledge'));
    expect(window.location.search).toBe('?card=c-1');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL。失败原因包括 `Landing` 页面不存在、`/` 当前仍渲染 Home、`/app` 当前未配置。

- [ ] **Step 3: 提交测试**

```bash
git add src/App.test.tsx
git commit -m "test: cover landing and app workspace routes"
```

---

### Task 2: 实现 Landing 页面

**Files:**
- Create: `src/pages/Landing.tsx`

- [ ] **Step 1: 写页面实现**

创建 `src/pages/Landing.tsx`：

```tsx
import { ArrowRight, CalendarDays, CheckCircle2, FileText, FolderOpen, Flame, Library, Search, ShieldCheck, Sparkles, Tags } from 'lucide-react';
import { Link } from 'react-router-dom';

import { routes } from '../app/routes';

const workflowSteps = [
  {
    title: '导入网页链接',
    description: '粘贴一个 URL，选择目标文件夹，把零散收藏稳定放进你的知识库。',
    icon: FileText,
  },
  {
    title: '自动整理成知识卡片',
    description: '生成摘要、标签、来源信息和可阅读的卡片，让资料不再只是一个链接。',
    icon: Library,
  },
  {
    title: '搜索、问答、重新找回',
    description: '用模糊记忆搜索资料，也可以基于选中的卡片提问和回看引用。',
    icon: Search,
  },
] as const;

const supportingFeatures = [
  { title: '文件夹和标签', description: '把文章放进清楚的单层文件夹，用标签补充主题线索。', icon: FolderOpen },
  { title: '知识活动热力图', description: '用低干扰的活动视图看到每天导入和回看的节奏。', icon: Flame },
  { title: '最近导入状态', description: '导入中、成功、失败都在 Home 中可见，失败后可以重试。', icon: CheckCircle2 },
  { title: '回收站和恢复', description: '误删先进入回收站，确认后再永久删除。', icon: ShieldCheck },
] as const;

function ProductPreview() {
  return (
    <div className="rounded-[20px] border border-[#E6E8EB] bg-white p-3 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
      <div className="overflow-hidden rounded-2xl border border-[#ECEFF2] bg-[#F8F9FA]">
        <div className="flex items-center justify-between border-b border-[#ECEFF2] bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF6B6B]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FFD43B]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#51CF66]" />
          </div>
          <span className="text-[12px] font-medium text-[#868E96]">别吃灰工作区</span>
        </div>
        <div className="grid min-h-[360px] grid-cols-[150px_1fr] bg-white">
          <aside className="border-r border-[#ECEFF2] bg-[#F8F9FA] p-4">
            <div className="mb-5 h-8 rounded-lg bg-[#1A1A1A]" />
            <div className="space-y-2">
              {['Home', '知识库', '日历', '搜索'].map((item, index) => (
                <div className={index === 1 ? 'h-8 rounded-lg bg-[#E9ECEF]' : 'h-8 rounded-lg bg-white'} key={item}>
                  <span className="sr-only">{item}</span>
                </div>
              ))}
            </div>
          </aside>
          <div className="p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 h-5 w-32 rounded bg-[#1A1A1A]" />
                <div className="h-3 w-52 rounded bg-[#DEE2E6]" />
              </div>
              <div className="h-9 w-24 rounded-lg bg-[#1A1A1A]" />
            </div>
            <div className="mb-5 grid grid-cols-3 gap-3">
              {[154, '245k', 12].map((value) => (
                <div className="rounded-xl border border-[#ECEFF2] bg-[#F8F9FA] p-4" key={value}>
                  <div className="mb-3 h-3 w-16 rounded bg-[#CED4DA]" />
                  <div className="text-[24px] font-semibold text-[#1A1A1A]">{value}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-[#ECEFF2] bg-[#F8F9FA] p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="h-4 w-24 rounded bg-[#1A1A1A]" />
                <div className="h-3 w-16 rounded bg-[#CED4DA]" />
              </div>
              <div className="grid grid-cols-12 gap-1">
                {Array.from({ length: 84 }, (_, index) => (
                  <span
                    className={
                      index % 17 === 0
                        ? 'h-2.5 rounded-[3px] bg-[#2F72DF]'
                        : index % 7 === 0
                          ? 'h-2.5 rounded-[3px] bg-[#A5D8FF]'
                          : 'h-2.5 rounded-[3px] bg-[#E9ECEF]'
                    }
                    key={index}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-[#868E96]">{children}</p>;
}

export function Landing() {
  return (
    <div className="min-h-screen bg-white text-[#1A1A1A]">
      <header className="sticky top-0 z-20 border-b border-[#ECEFF2] bg-white/90 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5">
          <Link className="text-[15px] font-semibold text-[#1A1A1A]" to="/">别吃灰</Link>
          <div className="hidden items-center gap-7 text-[13px] text-[#6C757D] md:flex">
            <a className="hover:text-[#1A1A1A]" href="#workflow">如何工作</a>
            <a className="hover:text-[#1A1A1A]" href="#daily">日报</a>
            <a className="hover:text-[#1A1A1A]" href="#hot">热点推荐</a>
          </div>
          <Link className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1A1A1A] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#212529]" to={routes.appHome}>
            立即使用
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1180px] gap-12 px-5 pb-20 pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:pt-20">
          <div>
            <SectionLabel>本地个人知识库</SectionLabel>
            <h1 className="max-w-[620px] text-[46px] font-semibold leading-[1.08] tracking-tight text-[#111111] sm:text-[64px]">别让收藏继续吃灰</h1>
            <p className="mt-6 max-w-[560px] text-[17px] leading-8 text-[#5F666D]">
              从一个链接开始，建立你的本地个人知识库。导入网页，自动生成摘要、标签和知识卡片，再用搜索、问答和日报把内容重新找回来。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1A1A1A] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#212529]" to={routes.appHome}>
                立即使用
                <ArrowRight size={16} />
              </Link>
              <a className="inline-flex h-11 items-center justify-center rounded-lg border border-[#E6E8EB] bg-white px-5 text-[14px] font-medium text-[#343A40] transition-colors hover:bg-[#F8F9FA]" href="#workflow">
                看看如何工作
              </a>
            </div>
            <div className="mt-8 grid max-w-[520px] grid-cols-2 gap-3 text-[13px] text-[#6C757D] sm:grid-cols-4">
              {['单链接导入', 'AI 摘要', '模糊搜索', '每日回看'].map((item) => (
                <span className="rounded-lg border border-[#ECEFF2] bg-[#F8F9FA] px-3 py-2 text-center" key={item}>{item}</span>
              ))}
            </div>
          </div>
          <ProductPreview />
        </section>

        <section className="border-y border-[#ECEFF2] bg-[#FAFAFA] px-5 py-20" id="workflow">
          <div className="mx-auto max-w-[1180px]">
            <SectionLabel>如何工作</SectionLabel>
            <h2 className="max-w-[680px] text-[34px] font-semibold tracking-tight text-[#111111]">从导入到找回，知识库自己长出结构。</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {workflowSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <article className="rounded-2xl border border-[#E6E8EB] bg-white p-6" key={step.title}>
                    <div className="mb-6 flex items-center justify-between">
                      <span className="text-[13px] font-medium text-[#868E96]">0{index + 1}</span>
                      <Icon className="text-[#495057]" size={22} />
                    </div>
                    <h3 className="text-[20px] font-semibold text-[#1A1A1A]">{step.title}</h3>
                    <p className="mt-3 text-[14px] leading-7 text-[#6C757D]">{step.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1180px] gap-8 px-5 py-20 lg:grid-cols-2 lg:items-center" id="daily">
          <div>
            <SectionLabel>每日知识日报</SectionLabel>
            <h2 className="text-[34px] font-semibold tracking-tight text-[#111111]">每天读过什么，晚上重新整理一遍。</h2>
            <p className="mt-5 text-[16px] leading-8 text-[#5F666D]">
              日报从日历页生成，把当天导入的文章整理成主题、关键词和值得回看的卡片。它不是发布报告，而是帮你把输入变成可以复盘的线索。
            </p>
          </div>
          <div className="rounded-2xl border border-[#E6E8EB] bg-[#F8F9FA] p-5">
            <div className="rounded-xl bg-white p-5">
              <div className="mb-4 flex items-center gap-3">
                <CalendarDays className="text-[#495057]" size={22} />
                <div>
                  <h3 className="text-[16px] font-semibold text-[#1A1A1A]">今日知识日报</h3>
                  <p className="text-[13px] text-[#868E96]">3 篇文章 · 4 个关键词</p>
                </div>
              </div>
              <div className="space-y-3">
                {['模型上下文管理', '本地知识库工作流', 'AI 产品设计'].map((item) => (
                  <div className="rounded-lg border border-[#ECEFF2] bg-[#FAFAFA] px-4 py-3 text-[14px] text-[#343A40]" key={item}>{item}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#ECEFF2] bg-[#FAFAFA] px-5 py-20" id="hot">
          <div className="mx-auto grid max-w-[1180px] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <SectionLabel>AI 热点推荐</SectionLabel>
              <h2 className="text-[34px] font-semibold tracking-tight text-[#111111]">发现值得读的新文章，再决定要不要收藏。</h2>
              <p className="mt-5 text-[16px] leading-8 text-[#5F666D]">
                热点推荐提供克制的发现入口。你可以先预览文章，再单篇导入，让新的输入自然进入同一套知识库流程。
              </p>
            </div>
            <div className="grid gap-3">
              {['AI 产品设计中的上下文记忆', '从收藏夹到个人知识库', '如何用日报复盘每天的输入'].map((title) => (
                <article className="rounded-xl border border-[#E6E8EB] bg-white p-5" key={title}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-[12px] text-[#868E96]">精选文章</span>
                    <Sparkles className="text-[#495057]" size={16} />
                  </div>
                  <h3 className="text-[16px] font-semibold text-[#1A1A1A]">{title}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#6C757D]">预览后单篇导入，避免把推荐变成新的信息噪音。</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-5 py-20">
          <SectionLabel>辅助能力</SectionLabel>
          <h2 className="max-w-[680px] text-[34px] font-semibold tracking-tight text-[#111111]">整理、状态和恢复，都保持清楚可控。</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {supportingFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <article className="rounded-2xl border border-[#E6E8EB] bg-white p-5" key={feature.title}>
                  <Icon className="mb-5 text-[#495057]" size={22} />
                  <h3 className="text-[16px] font-semibold text-[#1A1A1A]">{feature.title}</h3>
                  <p className="mt-3 text-[13px] leading-6 text-[#6C757D]">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="bg-[#101828] px-5 py-20 text-white">
          <div className="mx-auto max-w-[900px] text-center">
            <Tags className="mx-auto mb-6 text-[#CED4DA]" size={28} />
            <h2 className="text-[40px] font-semibold tracking-tight">开始整理你的第一篇文章</h2>
            <p className="mx-auto mt-4 max-w-[560px] text-[16px] leading-8 text-[#CED4DA]">从一个链接开始，让收藏变成可以回看的知识库。</p>
            <Link className="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-[14px] font-medium text-[#101828] transition-colors hover:bg-[#F1F3F5]" to={routes.appHome}>
              立即使用
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: 运行测试确认仍失败在路由层**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL。`Landing` 已可导入，但 `App` 仍未把 `/` 接到 Landing，`routes.appHome` 也尚未定义。

- [ ] **Step 3: 提交 Landing 页面**

```bash
git add src/pages/Landing.tsx
git commit -m "feat: add product intro landing page"
```

---

### Task 3: 迁移路由到 `/app`

**Files:**
- Modify: `src/app/routes.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: 更新路由常量**

将 `src/app/routes.ts` 替换为：

```ts
import { Calendar, Home, Library, Search, Sparkles } from 'lucide-react';

export const routes = {
  landing: '/',
  appHome: '/app',
  home: '/app',
  homeAlias: '/app/home',
  knowledge: '/app/knowledge',
  trash: '/app/knowledge/trash',
  libraryAlias: '/app/library',
  calendar: '/app/calendar',
  search: '/app/search',
  recommendations: '/app/recommendations',
  hotAlias: '/app/hot',
  settings: '/app/settings',
} as const;

export const legacyRoutes = {
  homeAlias: '/home',
  knowledge: '/knowledge',
  trash: '/knowledge/trash',
  libraryAlias: '/library',
  calendar: '/calendar',
  search: '/search',
  recommendations: '/recommendations',
  hotAlias: '/hot',
  settings: '/settings',
} as const;

export const navItems = [
  { name: '首页', path: routes.home, icon: Home, hasChildren: false },
  { name: '知识库', path: routes.knowledge, icon: Library, hasChildren: true },
  { name: '日历', path: routes.calendar, icon: Calendar, hasChildren: false },
  { name: '搜索', path: routes.search, icon: Search, hasChildren: false },
  { name: '文章推荐', path: routes.recommendations, icon: Sparkles, hasChildren: false },
] as const;
```

- [ ] **Step 2: 更新 App 路由**

将 `src/App.tsx` 替换为：

```tsx
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { legacyRoutes, routes } from './app/routes';
import { AppLayout } from './components/layout/AppLayout';
import { CalendarView } from './pages/CalendarView';
import { Home } from './pages/Home';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { Landing } from './pages/Landing';
import { Recommendations } from './pages/Recommendations';
import { Search } from './pages/Search';
import { Settings } from './pages/Settings';
import { Trash } from './pages/Trash';

function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();

  return <Navigate replace to={`${to}${location.search}${location.hash}`} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={routes.landing} element={<Landing />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="home" element={<Home />} />
          <Route path="knowledge" element={<KnowledgeBase />} />
          <Route path="knowledge/trash" element={<Trash />} />
          <Route path="library" element={<KnowledgeBase />} />
          <Route path="calendar" element={<CalendarView />} />
          <Route path="search" element={<Search />} />
          <Route path="recommendations" element={<Recommendations />} />
          <Route path="hot" element={<Recommendations />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path={legacyRoutes.homeAlias.slice(1)} element={<LegacyRedirect to={routes.homeAlias} />} />
        <Route path={legacyRoutes.knowledge.slice(1)} element={<LegacyRedirect to={routes.knowledge} />} />
        <Route path={legacyRoutes.trash.slice(1)} element={<LegacyRedirect to={routes.trash} />} />
        <Route path={legacyRoutes.libraryAlias.slice(1)} element={<LegacyRedirect to={routes.libraryAlias} />} />
        <Route path={legacyRoutes.calendar.slice(1)} element={<LegacyRedirect to={routes.calendar} />} />
        <Route path={legacyRoutes.search.slice(1)} element={<LegacyRedirect to={routes.search} />} />
        <Route path={legacyRoutes.recommendations.slice(1)} element={<LegacyRedirect to={routes.recommendations} />} />
        <Route path={legacyRoutes.hotAlias.slice(1)} element={<LegacyRedirect to={routes.hotAlias} />} />
        <Route path={legacyRoutes.settings.slice(1)} element={<LegacyRedirect to={routes.settings} />} />
        <Route path="*" element={<Navigate to={routes.landing} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: 运行 App 路由测试**

Run: `npm test -- src/App.test.tsx`

Expected: PASS。`/` 显示落地页，CTA 跳转 `/app`，`/app` 显示 Home，旧 `/knowledge?card=c-1` 重定向到 `/app/knowledge?card=c-1`。

- [ ] **Step 4: 提交路由迁移**

```bash
git add src/app/routes.ts src/App.tsx
git commit -m "feat: route landing page and app workspace"
```

---

### Task 4: 更新受路由影响的现有测试

**Files:**
- Modify: `src/components/layout/Sidebar.test.tsx`
- Modify: `src/pages/Search.test.tsx`

- [ ] **Step 1: 更新 Sidebar 测试路径**

在 `src/components/layout/Sidebar.test.tsx` 中做两处替换：

```tsx
<MemoryRouter initialEntries={['/app']}>
```

并将文件夹跳转断言替换为：

```tsx
await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/app/knowledge?folder=f-1'));
```

- [ ] **Step 2: 运行 Sidebar 测试**

Run: `npm test -- src/components/layout/Sidebar.test.tsx`

Expected: PASS。导航仍渲染，文件夹跳转进入 `/app/knowledge?folder=f-1`，导入弹窗仍可打开。

- [ ] **Step 3: 更新 Search 测试路径**

在 `src/pages/Search.test.tsx` 中做两处替换：

```tsx
<MemoryRouter initialEntries={['/app/search']}>
```

并将引用跳转断言替换为：

```tsx
await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/app/knowledge?card=c-1'));
```

- [ ] **Step 4: 运行 Search 测试**

Run: `npm test -- src/pages/Search.test.tsx`

Expected: PASS。搜索问答和引用跳转仍工作。

- [ ] **Step 5: 运行全量测试**

Run: `npm test`

Expected: PASS。所有现有页面测试和新路由测试通过。

- [ ] **Step 6: 提交测试更新**

```bash
git add src/components/layout/Sidebar.test.tsx src/pages/Search.test.tsx
git commit -m "test: update app workspace route expectations"
```

---

### Task 5: 构建验证和浏览器检查

**Files:**
- No source changes expected.

- [ ] **Step 1: 运行类型检查和构建**

Run: `npm run build`

Expected: PASS。TypeScript build 和 Vite production build 都成功。

- [ ] **Step 2: 启动本地开发服务**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite 输出本地访问地址，例如 `http://127.0.0.1:5173/`。如果 5173 被占用，使用 Vite 输出的实际端口。

- [ ] **Step 3: 浏览器检查桌面端**

Open: `http://127.0.0.1:5173/`

Expected:

- 首屏显示 `别让收藏继续吃灰`。
- 首屏显示 `从一个链接开始，建立你的本地个人知识库`。
- 产品界面预览非空，且没有遮挡主文案。
- 页面包含 `每日知识日报` 独立区块。
- 页面包含 `AI 热点推荐` 独立区块。
- 点击 `立即使用` 进入 `/app`，并显示应用 Home 数据看板。

- [ ] **Step 4: 浏览器检查移动端**

Use browser viewport around `390px x 844px`.

Expected:

- 标题、按钮、导航不溢出。
- CTA 可点击。
- 工作流、日报、热点推荐、辅助能力区块按单列或合理窄屏布局展示。
- 产品预览不压住正文，也不会横向撑破页面。

- [ ] **Step 5: 最终状态检查**

Run: `git status --short`

Expected: 只显示本次实现相关文件改动，且没有 `.superpowers/brainstorm` 文件被跟踪。

---

## 自查记录

- Spec 覆盖：本计划覆盖 `/` 落地页、`/app` 工作区、CTA、日报独立区块、热点推荐独立区块、辅助能力、旧路由兼容和验证流程。
- 占位符扫描：未发现未完成标记或含糊的后续补齐要求。
- 类型一致性：计划统一使用 `routes.appHome` 表示 `/app`，应用页面统一挂在 `/app/*`，旧路由统一通过 `legacyRoutes` 进入 `LegacyRedirect`。
