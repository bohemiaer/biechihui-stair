import { format, subDays } from 'date-fns';

import type { DailyActivity, DailyReport, DashboardStats, Folder, HotArticle, ImportTask, KnowledgeCard } from '../types';

const now = new Date();
const isoNow = now.toISOString();

export const mockFolders: Folder[] = [
  { id: 'f-4', name: 'Interaction Design', cardCount: 5, isSystem: false, parentId: null, sortOrder: 1, createdAt: isoNow, updatedAt: isoNow },
  { id: 'uncategorized', name: 'Uncategorized', cardCount: 3, isSystem: true, parentId: null, sortOrder: 999, createdAt: isoNow, updatedAt: isoNow },
];

export const mockCards: KnowledgeCard[] = [
  {
    id: 'c-1',
    title: '别吃灰功能介绍：这个知识库现在能帮你做什么',
    url: 'https://docs.biechihui.local/features',
    siteName: '产品内置指南',
    folderId: 'f-4',
    tags: [{ id: 't1', name: '产品介绍' }, { id: 't2', name: '新手必读' }],
    summary: '你可以把网页链接导入知识库、在知识库里编辑摘要和标签、按时间线回看当天归档、用 AI 检索问答做基于文章的问答。',
    contentPreview: '功能总览：1. 导入网页链接生成知识卡片；2. 编辑标题、摘要、备注和标签；3. 时间线回看；4. AI 检索问答；5. 推荐文章一键入库。',
    fullContent: '---\ntitle: "别吃灰功能介绍：这个知识库现在能帮你做什么"\nsource: "https://docs.biechihui.local/features"\nauthor: "Biechihui"\ntweet_count: 1\nitem_id: c-1\n---\n功能总览\n1. 导入网页链接，系统会抓取原文、生成摘要与标签，并写入本地知识库。\n2. 在知识库中，你可以编辑标题、摘要、备注、标签，并用重要/坏数据状态管理内容质量。\n3. 在时间线页面，你可以按日期回看当天新增的知识卡片，并在需要时生成日报。\n4. 在 AI 检索问答页面，你可以先检索，再基于选中的知识卡片进行问答，并把回答归档回文章。\n5. 推荐页会展示外部热点文章，支持直接导入到指定文件夹。',
    notes: '',
    note: '',
    sourceType: 'web',
    author: 'Biechihui',
    publishedAt: subDays(now, 1).toISOString(),
    wordCount: 920,
    readingTime: 2,
    userTitle: '',
    userSummary: '',
    lastEditedAt: undefined,
    editedByUser: false,
    createdAt: isoNow,
    updatedAt: isoNow,
    isImportant: true,
    isBadData: false,
    isDeleted: false,
    deletedAt: null,
    deletedFromFolderId: null,
    archivedAt: null,
    refreshStatus: 'idle',
    lastRefreshedAt: isoNow,
    suggestedQuestions: [
      '这篇文章适合用来解决什么问题？',
      '我可以怎样开始使用这个知识库？',
      '这套流程最容易踩坑的地方是什么？',
    ],
    imageAssets: [
      {
        id: 'asset-c1-1',
        cardId: 'c-1',
        sourceUrl: 'https://example.com/source-image-1.jpg',
        localPath: 'card_assets/c-1/01.jpg',
        mimeType: 'image/jpeg',
        sortOrder: 0,
        status: 'downloaded',
        createdAt: isoNow,
      },
    ],
  },
  {
    id: 'c-2',
    title: '使用指南：第一次上手建议这样用',
    url: 'https://docs.biechihui.local/getting-started',
    siteName: '产品内置指南',
    folderId: 'uncategorized',
    tags: [{ id: 't4', name: '使用指南' }, { id: 't5', name: '工作流' }],
    summary: '推荐顺序是先导入 3 到 5 篇你真正要用的文章，再补标签和备注，然后去搜索页试一次检索和问答，最后到时间线生成日报。',
    contentPreview: '建议流程：先导入真实文章，不要先堆文件夹；导入后补充备注和标签；再去搜索页试检索和问答；最后到时间线生成日报。',
    notes: '',
    note: '',
    sourceType: 'web',
    wordCount: 840,
    readingTime: 2,
    editedByUser: false,
    createdAt: subDays(now, 2).toISOString(),
    updatedAt: subDays(now, 2).toISOString(),
    lastEditedAt: undefined,
    isImportant: false,
    isBadData: false,
    isDeleted: false,
    deletedAt: null,
    deletedFromFolderId: null,
    archivedAt: null,
    refreshStatus: 'idle',
    suggestedQuestions: [
      '第一次上手应该先导入哪些文章？',
      '如何判断这套工作流是否有效？',
      '导入之后还需要补充哪些信息？',
    ],
    imageAssets: [],
  },
  {
    id: 'c-3',
    title: '导入后的卡片会如何出现在知识库里',
    url: 'https://very-long-domain-name.example.com/articles/a/path/that/keeps/going',
    siteName: '产品内置指南',
    folderId: 'uncategorized',
    tags: [{ id: 't6', name: '知识卡片' }],
    summary: '导入成功后，卡片会保留来源链接、摘要、原文预览、标签和可编辑备注，你可以继续整理，也可以直接拿去做搜索和问答。',
    contentPreview: '导入成功后，知识卡片会成为后续检索、问答、时间线和日报的共同数据来源。',
    notes: '',
    note: '',
    sourceType: 'web',
    wordCount: 360,
    readingTime: 1,
    createdAt: subDays(now, 7).toISOString(),
    updatedAt: subDays(now, 7).toISOString(),
    isImportant: false,
    isBadData: false,
    isDeleted: false,
    deletedAt: null,
    deletedFromFolderId: null,
    archivedAt: null,
    refreshStatus: 'idle',
    suggestedQuestions: [
      '导入成功后我应该检查什么？',
      '这张卡片可以如何参与问答？',
      '后续整理时应该补哪些标签？',
    ],
    imageAssets: [],
  },
];

export const mockTasks: ImportTask[] = [
  {
    id: 'tsk-1',
    url: 'https://news.ycombinator.com/item?id=400000',
    folderId: 'f-4',
    status: 'succeeded',
    stage: 'done',
    progress: 100,
    retryCount: 0,
    resultCardId: 'c-2',
    createdAt: isoNow,
    updatedAt: isoNow,
  },
  {
    id: 'tsk-2',
    url: 'https://github.com/facebook/react',
    folderId: 'f-4',
    status: 'running',
    stage: 'embedding',
    progress: 72,
    retryCount: 0,
    createdAt: isoNow,
    updatedAt: isoNow,
  },
  {
    id: 'tsk-3',
    url: 'https://example.com/failed-import',
    folderId: 'uncategorized',
    status: 'failed',
    stage: 'failed',
    progress: 30,
    errorCode: 'fetch_failed',
    errorMessage: '页面抓取失败，请检查链接是否可访问。',
    retryCount: 1,
    createdAt: subDays(now, 1).toISOString(),
    updatedAt: subDays(now, 1).toISOString(),
  },
];

export const mockStats: DashboardStats = {
  totalCards: 154,
  totalWords: 245000,
  totalFolders: 2,
  weeklyImports: 24,
};

export const generateHeatmapData = (): DailyActivity[] => {
  const data: DailyActivity[] = [];
  for (let i = 90; i >= 0; i--) {
    const date = subDays(now, i);
    const count = i % 9 === 0 ? 4 : i % 5 === 0 ? 2 : i % 3 === 0 ? 1 : 0;
    data.push({
      date: format(date, 'yyyy-MM-dd'),
      count,
      tokenCount: count * 1200,
      wordCount: count * 650,
      cardIds: count > 0 ? mockCards.slice(0, Math.min(count, mockCards.length)).map((card) => card.id) : [],
    });
  }
  return data;
};

export const mockDailyReports: DailyReport[] = [
  {
    date: format(now, 'yyyy-MM-dd'),
    summary: '今天的内容焦点集中在数据库架构和 UI 设计模式，适合后续整理成复习路径。',
    topics: ['Database Architecture', 'Design Patterns'],
    keywords: ['Normalization', '3NF', 'BCNF', 'Minimal UI'],
    highlightCardIds: ['c-1', 'c-2'],
    createdAt: isoNow,
  },
];

export const mockHotArticles: HotArticle[] = [
  {
    id: 'h-1',
    title: 'The Future of Retrieval-Augmented Generation (RAG)',
    source: 'AI Insights',
    publishedAt: subDays(now, 1).toISOString(),
    summary: 'An overview of how RAG is evolving beyond simple chunking and similarity search, moving towards agentic approaches.',
    url: 'https://example.com/future-of-rag',
    status: 'idle',
    category: 'ai-product',
    reason: '与你近期收集的 RAG 和数据库内容相关。',
  },
  {
    id: 'h-2',
    title: 'Tailwind CSS 4.0 Released: What\'s New?',
    source: 'Frontend Weekly',
    publishedAt: subDays(now, 2).toISOString(),
    summary: 'Tailwind 4.0 brings a new engine, oxide, and drops the need for a tailwind.config.js in favor of standard CSS syntax.',
    url: 'https://example.com/tailwind-4',
    status: 'imported',
    category: 'frontend',
    reason: '与你当前前端实现栈相关。',
    importedCardId: 'c-2',
  },
];
