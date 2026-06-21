import { format } from 'date-fns';

import {
  generateHeatmapData,
  mockCards,
  mockDailyReports,
  mockFolders,
  mockHotArticles,
  mockStats,
  mockTasks,
} from '../mock/data';
import type {
  AnswerResponse,
  AnswerArchive,
  DailyActivity,
  DailyReport,
  DashboardStats,
  Folder,
  HotArticle,
  ImportTask,
  KnowledgeCard,
  SearchResult,
} from '../types';

type CardFilters = {
  folderId?: string;
  includeDeleted?: boolean;
};

type CreateImportTaskInput = {
  url: string;
  folderId: string;
  targetCardId?: string;
  hotArticleId?: string;
};

type CreateFolderInput = {
  name: string;
};

type UpdateFolderInput = {
  name: string;
};

type AnswerQuestionInput = {
  question: string;
  cardIds: string[];
};

type UpdateCardInput = Partial<
  Pick<
    KnowledgeCard,
    'userTitle' | 'userSummary' | 'note' | 'notes' | 'folderId' | 'isImportant' | 'isBadData' | 'tags'
  >
>;

const queryRewriteMap: Array<{ patterns: string[]; rewrite: string }> = [
  { patterns: ['数据库范式', '范式化', 'normal form', '冗余'], rewrite: 'normalization' },
  { patterns: ['tailwind', '前端样式', 'css'], rewrite: 'tailwind' },
  { patterns: ['设计', '界面', 'ui'], rewrite: 'design' },
];

export function rewriteSearchQuery(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const matchedRule = queryRewriteMap.find((rule) => rule.patterns.some((pattern) => normalizedQuery.includes(pattern.toLowerCase())));

  return matchedRule?.rewrite ?? normalizedQuery;
}

type ImportHotArticleInput = {
  articleId: string;
  folderId: string;
};

let folders: Folder[] = [];
let cards: KnowledgeCard[] = [];
let importTasks: ImportTask[] = [];
let hotArticles: HotArticle[] = [];

const cloneCard = (card: KnowledgeCard): KnowledgeCard => ({
  ...card,
  tags: card.tags.map((tag) => ({ ...tag })),
  suggestedQuestions: [...(card.suggestedQuestions ?? [])],
  answerArchives: card.answerArchives?.map((archive) => ({ ...archive, usedCardIds: [...archive.usedCardIds] })) ?? [],
  imageAssets: card.imageAssets?.map((asset) => ({ ...asset })) ?? [],
});

const cloneTask = (task: ImportTask): ImportTask => ({ ...task });

const cloneFolder = (folder: Folder): Folder => ({ ...folder });

const withCardCount = (folder: Folder): Folder => ({
  ...folder,
  cardCount: cards.filter((card) => card.folderId === folder.id && !card.deletedAt && !card.isDeleted).length,
});

const importStageOrder: Array<ImportTask['stage']> = ['waiting', 'fetching', 'summarizing', 'embedding', 'saving', 'done'];
const importStageProgress: Record<ImportTask['stage'], number> = {
  waiting: 0,
  fetching: 22,
  summarizing: 48,
  embedding: 72,
  saving: 92,
  done: 100,
  failed: 30,
};

const createCardFromTask = (task: ImportTask): KnowledgeCard => {
  const now = new Date().toISOString();
  const host = (() => {
    try {
      return new URL(task.url).hostname;
    } catch {
      return 'Imported Source';
    }
  })();

  return {
    id: `card-${task.id}`,
    title: `Imported article from ${host}`,
    url: task.url,
    siteName: host,
    folderId: task.folderId,
    tags: [{ id: `tag-${task.id}-import`, name: 'Imported' }],
    summary: '这篇文章已完成导入，摘要将在接入真实后端后由模型生成。',
    contentPreview: '这是 mock 导入任务生成的知识卡片，用于验证导入成功后的知识库闭环。',
    fullContent: '这是 mock 导入任务生成的完整原文占位内容。接入真实抓取后，这里会展示解析后的正文。',
    notes: '',
    note: '',
    sourceType: 'web',
    wordCount: 520,
    readingTime: 3,
    createdAt: now,
    updatedAt: now,
    isImportant: false,
    isBadData: false,
    isDeleted: false,
    deletedAt: null,
    deletedFromFolderId: null,
    archivedAt: null,
    refreshStatus: 'idle',
    suggestedQuestions: [
      '这篇导入内容的核心观点是什么？',
      '我可以怎样把它用到当前项目？',
      '还有哪些细节值得继续追问？',
    ],
    imageAssets: [],
  };
};

const advanceRunningTask = (task: ImportTask): ImportTask => {
  if (task.status !== 'running' && task.status !== 'pending') {
    return task;
  }

  const currentIndex = importStageOrder.indexOf(task.stage);
  const nextStage = importStageOrder[Math.min(currentIndex + 1, importStageOrder.length - 1)] ?? 'done';
  const isDone = nextStage === 'done';
  const resultCardId = task.resultCardId ?? (isDone ? `card-${task.id}` : undefined);

  if (isDone && task.targetCardId && resultCardId) {
    cards = cards.filter((card) => card.id !== task.targetCardId);
    cards.unshift({
      ...createCardFromTask({ ...task, resultCardId }),
      id: resultCardId,
      contentPreview: '这是 mock 重新抓取任务生成的新知识卡片，用于验证删除旧卡并新建新卡的流程。',
      fullContent: '这是 mock 重新抓取任务生成的新原文内容。旧知识卡片已被删除，并以新的卡片 ID 重新创建。',
    });
  } else if (isDone && resultCardId && !cards.some((card) => card.id === resultCardId)) {
    cards.unshift(createCardFromTask({ ...task, resultCardId }));
  }

  if (isDone && task.hotArticleId) {
    hotArticles = hotArticles.map((article) => (
      article.id === task.hotArticleId
        ? { ...article, status: 'imported', importTaskId: task.id, importedCardId: resultCardId }
        : article
    ));
  }

  return {
    ...task,
    status: isDone ? 'succeeded' : 'running',
    stage: nextStage,
    progress: importStageProgress[nextStage],
    resultCardId,
    updatedAt: new Date().toISOString(),
  };
};

export function resetMockSource() {
  folders = mockFolders.map(cloneFolder);
  cards = mockCards.map(cloneCard);
  importTasks = mockTasks.map(cloneTask);
  hotArticles = mockHotArticles.map((article) => ({ ...article }));
}

resetMockSource();

export async function getHomeSummary(): Promise<DashboardStats> {
  const visibleCards = cards.filter((card) => !card.deletedAt && !card.isDeleted);
  const totalWords = visibleCards.reduce((sum, card) => sum + (card.wordCount ?? 0), 0);
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  const weeklyImports = importTasks.filter((task) => new Date(task.createdAt) >= weekStart).length;

  return {
    ...mockStats,
    totalCards: visibleCards.length,
    totalWords,
    totalFolders: folders.filter((folder) => !folder.isSystem).length,
    weeklyImports,
  };
}

export async function getDailyActivity(): Promise<DailyActivity[]> {
  return generateHeatmapData();
}

export async function getFolders(): Promise<Folder[]> {
  return folders.map(withCardCount).map(cloneFolder);
}

export async function createFolder(input: CreateFolderInput): Promise<Folder> {
  const now = new Date().toISOString();
  const folder: Folder = {
    id: `folder-${Date.now()}`,
    name: input.name.trim(),
    cardCount: 0,
    parentId: null,
    isSystem: false,
    sortOrder: folders.length + 1,
    createdAt: now,
    updatedAt: now,
  };

  folders.push(folder);

  return cloneFolder(folder);
}

export async function updateFolder(id: string, input: UpdateFolderInput): Promise<Folder> {
  const index = folders.findIndex((folder) => folder.id === id);

  if (index === -1) {
    throw new Error('Folder not found');
  }

  if (folders[index].isSystem) {
    throw new Error('System folder cannot be renamed');
  }

  const next: Folder = {
    ...folders[index],
    name: input.name.trim(),
    updatedAt: new Date().toISOString(),
  };

  folders[index] = next;

  return cloneFolder(withCardCount(next));
}

export async function deleteFolder(id: string): Promise<{ id: string; movedCardCount: number }> {
  const folder = folders.find((item) => item.id === id);

  if (!folder) {
    throw new Error('Folder not found');
  }

  if (folder.isSystem) {
    throw new Error('System folder cannot be deleted');
  }

  let movedCardCount = 0;
  cards = cards.map((card) => {
    if (card.folderId !== id) {
      return card;
    }

    movedCardCount += 1;

    return {
      ...card,
      folderId: 'uncategorized',
      updatedAt: new Date().toISOString(),
    };
  });
  folders = folders.filter((item) => item.id !== id);

  return { id, movedCardCount };
}

export async function getCards(filters: CardFilters = {}): Promise<KnowledgeCard[]> {
  const visibleCards = filters.includeDeleted ? cards : cards.filter((card) => !card.deletedAt && !card.isDeleted);
  const filteredCards = filters.folderId
    ? visibleCards.filter((card) => card.folderId === filters.folderId)
    : visibleCards;

  return filteredCards.map(cloneCard);
}

export async function getCardById(id: string): Promise<KnowledgeCard | undefined> {
  const card = cards.find((item) => item.id === id && !item.deletedAt && !item.isDeleted);

  return card ? cloneCard(card) : undefined;
}

export async function updateCard(id: string, input: UpdateCardInput): Promise<KnowledgeCard> {
  const index = cards.findIndex((card) => card.id === id);

  if (index === -1) {
    throw new Error('Card not found');
  }

  const now = new Date().toISOString();
  const current = cards[index];
  const next: KnowledgeCard = {
    ...current,
    ...input,
    notes: input.note ?? input.notes ?? current.notes,
    note: input.note ?? current.note,
    editedByUser: true,
    lastEditedAt: now,
    updatedAt: now,
  };

  cards[index] = next;

  return cloneCard(next);
}

export async function archiveAnswer(
  cardId: string,
  input: { question: string; answer: string; usedCardIds: string[]; model: string },
): Promise<AnswerArchive> {
  const index = cards.findIndex((card) => card.id === cardId);

  if (index === -1) {
    throw new Error('Card not found');
  }

  const archive: AnswerArchive = {
    id: `qa-${Date.now()}`,
    cardId,
    question: input.question,
    answer: input.answer,
    usedCardIds: input.usedCardIds,
    model: input.model,
    createdAt: new Date().toISOString(),
  };
  const current = cards[index];
  cards[index] = {
    ...current,
    answerArchives: [archive, ...(current.answerArchives ?? [])],
    updatedAt: archive.createdAt,
  };

  return { ...archive, usedCardIds: [...archive.usedCardIds] };
}

export async function deleteCard(id: string): Promise<KnowledgeCard> {
  const card = cards.find((item) => item.id === id);

  if (!card) {
    throw new Error('Card not found');
  }

  const now = new Date().toISOString();
  const deletedCard: KnowledgeCard = {
    ...card,
    isDeleted: true,
    deletedAt: now,
    deletedFromFolderId: card.folderId,
    updatedAt: now,
  };

  cards = cards.map((item) => (item.id === id ? deletedCard : item));

  return cloneCard(deletedCard);
}

export async function restoreCard(id: string): Promise<KnowledgeCard> {
  const card = cards.find((item) => item.id === id);

  if (!card) {
    throw new Error('Card not found');
  }

  const restoredCard: KnowledgeCard = {
    ...card,
    folderId: card.deletedFromFolderId ?? 'uncategorized',
    isDeleted: false,
    deletedAt: null,
    deletedFromFolderId: null,
    updatedAt: new Date().toISOString(),
  };

  cards = cards.map((item) => (item.id === id ? restoredCard : item));

  return cloneCard(restoredCard);
}

export async function permanentlyDeleteCard(id: string): Promise<{ id: string }> {
  cards = cards.filter((card) => card.id !== id);

  return { id };
}

export async function getRecentImportTasks(): Promise<ImportTask[]> {
  importTasks = importTasks.map(advanceRunningTask);

  return importTasks.map(cloneTask);
}

export async function createImportTask(input: CreateImportTaskInput): Promise<ImportTask> {
  const now = new Date().toISOString();
  const task: ImportTask = {
    id: globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}`,
    url: input.url,
    folderId: input.folderId,
    status: 'running',
    stage: 'waiting',
    progress: 0,
    targetCardId: input.targetCardId,
    hotArticleId: input.hotArticleId,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  importTasks.unshift(task);
  if (input.targetCardId) {
    cards = cards.map((card) => (
      card.id === input.targetCardId
        ? { ...card, refreshStatus: 'refreshing', updatedAt: now }
        : card
    ));
  }
  if (input.hotArticleId) {
    hotArticles = hotArticles.map((article) => (
      article.id === input.hotArticleId
        ? { ...article, status: 'running', importTaskId: task.id }
        : article
    ));
  }

  return cloneTask(task);
}

export async function retryImportTask(id: string): Promise<ImportTask> {
  const index = importTasks.findIndex((task) => task.id === id);

  if (index === -1) {
    throw new Error('Import task not found');
  }

  const now = new Date().toISOString();
  const next: ImportTask = {
    ...importTasks[index],
    status: 'running',
    stage: 'fetching',
    progress: 20,
    errorCode: undefined,
    errorMessage: undefined,
    retryCount: importTasks[index].retryCount + 1,
    updatedAt: now,
  };

  importTasks[index] = next;
  if (next.targetCardId) {
    cards = cards.map((card) => (
      card.id === next.targetCardId
        ? { ...card, refreshStatus: 'refreshing', updatedAt: now }
        : card
    ));
  }
  if (next.hotArticleId) {
    hotArticles = hotArticles.map((article) => (
      article.id === next.hotArticleId
        ? { ...article, status: 'running', importTaskId: next.id }
        : article
    ));
  }

  return cloneTask(next);
}

export async function importHotArticle(input: ImportHotArticleInput): Promise<ImportTask> {
  const articleIndex = hotArticles.findIndex((article) => article.id === input.articleId);

  if (articleIndex === -1) {
    throw new Error('Hot article not found');
  }

  const article = hotArticles[articleIndex];
  return createImportTask({ url: article.url, folderId: input.folderId, hotArticleId: article.id });
}

export async function refreshCard(id: string): Promise<ImportTask> {
  const card = cards.find((item) => item.id === id);

  if (!card) {
    throw new Error('Card not found');
  }

  return createImportTask({
    url: card.url,
    folderId: card.folderId,
    targetCardId: id,
  });
}

export async function regenerateCard(id: string): Promise<KnowledgeCard> {
  const card = cards.find((item) => item.id === id);

  if (!card) {
    throw new Error('Card not found');
  }

  const generatedTagNames = new Set(card.tags.map((tag) => tag.name));
  generatedTagNames.add('AI 摘要');

  const tags = Array.from(generatedTagNames).map((name, index) => ({
    id: `tag-${id}-${index}`,
    name,
  }));

  return updateCard(id, {
    tags,
    userSummary: `${card.summary || card.contentPreview}（已重新生成）`,
  });
}

export async function getCalendarDays(): Promise<DailyActivity[]> {
  const grouped = new Map<string, DailyActivity>();

  cards
    .filter((card) => !card.deletedAt && !card.isDeleted)
    .forEach((card) => {
      const date = format(new Date(card.createdAt), 'yyyy-MM-dd');
      const current = grouped.get(date) ?? {
        date,
        count: 0,
        tokenCount: 0,
        wordCount: 0,
        cardIds: [],
      };

      grouped.set(date, {
        ...current,
        count: current.count + 1,
        tokenCount: current.tokenCount + (card.wordCount ?? 0) * 2,
        wordCount: current.wordCount + (card.wordCount ?? 0),
        cardIds: [...current.cardIds, card.id],
      });
    });

  return Array.from(grouped.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export async function getDailyReport(date: string): Promise<DailyReport> {
  const existing = mockDailyReports.find((report) => report.date === date);

  return existing
    ? { ...existing, topics: [...existing.topics], keywords: [...existing.keywords], highlightCardIds: [...existing.highlightCardIds] }
    : {
        date,
        summary: '该日期暂无日报内容。',
        topics: [],
        keywords: [],
        highlightCardIds: [],
        createdAt: new Date().toISOString(),
      };
}

export async function createDailyReport(date: string): Promise<DailyReport> {
  const dailyCards = cards.filter((card) => !card.isDeleted && card.createdAt.slice(0, 10) === date);

  return {
    date,
    summary:
      dailyCards.length > 0
        ? `当天共归档 ${dailyCards.length} 篇知识内容，重点集中在 ${dailyCards
            .flatMap((card) => card.tags.map((tag) => tag.name))
            .slice(0, 3)
            .join('、') || '近期知识主题'}。`
        : '该日期暂无知识归档内容。',
    topics: dailyCards.slice(0, 3).map((card) => card.summary),
    keywords: Array.from(new Set(dailyCards.flatMap((card) => card.tags.map((tag) => tag.name)))).slice(0, 6),
    highlightCardIds: dailyCards.slice(0, 3).map((card) => card.id),
    createdAt: new Date().toISOString(),
  };
}

export async function searchCards(query: string): Promise<SearchResult[]> {
  const normalizedQuery = rewriteSearchQuery(query);

  if (!normalizedQuery) {
    return [];
  }

  return cards
    .filter((card) => !card.deletedAt && !card.isDeleted)
    .map((card): SearchResult | undefined => {
      const fields = [
        ['title', card.title],
        ['summary', card.summary],
        ['content', card.contentPreview],
        ['source', card.siteName],
        ['tag', card.tags.map((tag) => tag.name).join(' ')],
      ] as const;
      const match = fields.find(([, value]) => value.toLowerCase().includes(normalizedQuery));

      if (!match) {
        return undefined;
      }

      const [matchedField, matchedText] = match;

      return {
        cardId: card.id,
        card: cloneCard(card),
        score: matchedField === 'title' ? 0.94 : 0.72,
        matchedText,
        matchedField,
        highlights: [matchedText],
      };
    })
    .filter((result): result is SearchResult => Boolean(result));
}

export async function answerQuestion(input: AnswerQuestionInput): Promise<AnswerResponse> {
  const usedCards = cards.filter((card) => input.cardIds.includes(card.id));

  return {
    answer: `基于你所选的 ${usedCards.length} 张知识卡，“${input.question}” 的核心要点是：范式化可以减少数据冗余，并提升数据质量。`,
    citations: usedCards.map((card) => ({
      cardId: card.id,
      title: card.title,
      url: card.url,
      snippet: card.summary || card.contentPreview,
    })),
    usedCardIds: usedCards.map((card) => card.id),
    model: 'mock-answer-model',
    createdAt: new Date().toISOString(),
  };
}

export async function getHotArticles(): Promise<HotArticle[]> {
  return hotArticles.map((article) => ({ ...article }));
}
