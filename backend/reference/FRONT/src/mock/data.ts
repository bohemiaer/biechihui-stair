import { KnowledgeCard, Folder, ImportTask, DashboardStats, DailyActivity, HotArticle } from '../types';
import { format, subDays } from 'date-fns';

export const mockFolders: Folder[] = [
  { id: 'f-1', name: 'Exploration Ideas', cardCount: 12 },
  { id: 'f-2', name: 'Database Systems Week 4', cardCount: 8 },
  { id: 'f-3', name: 'Grocery List', cardCount: 2 },
  { id: 'f-4', name: 'Interaction Design', cardCount: 5 },
  { id: 'uncategorized', name: 'Uncategorized', cardCount: 3 },
];

export const mockCards: KnowledgeCard[] = [
  {
    id: 'c-1',
    title: 'Normalization is the process of ordering basic data structures to ensure basic data created is of good quality.',
    url: 'https://example.com/db-normalization',
    siteName: 'Tech Blog',
    folderId: 'f-2',
    tags: [{id: 't1', name: 'College'}, {id: 't2', name: 'Lecture'}, {id: 't3', name: 'Daily'}],
    summary: 'Normalization minimizes data redundancy and inconsistencies. It goes from 1NF to 5NF, usually 3NF or BCNF is sufficient.',
    contentPreview: 'Normalization is the process of ordering basic data structures to ensure that the basic data created is of good quality. Used to minimize data redundancy and data inconsistencies...',
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isImportant: true,
    isBadData: false,
  },
  {
    id: 'c-2',
    title: 'Blandit pharetra tellus metus fermentum pellentesque augue sit. Donec senectus...',
    url: 'https://example.com/design-ideas',
    siteName: 'Design Space',
    folderId: 'f-1',
    tags: [{id: 't4', name: 'Design'}, {id: 't5', name: 'Productivity'}, {id: 't6', name: 'Training'}],
    summary: 'A summary of new design exploration ideas focusing on minimal interfaces.',
    contentPreview: 'Blandit pharetra tellus metus fermentum pellentesque augue sit. Donec senectus...',
    notes: 'Need to review this for the new project.',
    createdAt: subDays(new Date(), 2).toISOString(),
    updatedAt: subDays(new Date(), 2).toISOString(),
    isImportant: false,
    isBadData: false,
  }
];

export const mockTasks: ImportTask[] = [
  {
    id: 'tsk-1',
    url: 'https://news.ycombinator.com/item?id=400000',
    folderId: 'f-1',
    status: 'success',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tsk-2',
    url: 'https://github.com/facebook/react',
    folderId: 'f-4',
    status: 'importing',
    createdAt: new Date().toISOString(),
  }
];

export const mockStats: DashboardStats = {
  totalCards: 154,
  totalWords: 245000,
  totalFolders: 12,
  weeklyImports: 24
};

// Generate some fake heatmap data
export const generateHeatmapData = (): DailyActivity[] => {
  const data: DailyActivity[] = [];
  const today = new Date();
  for (let i = 90; i >= 0; i--) {
    const d = subDays(today, i);
    data.push({
      date: format(d, 'yyyy-MM-dd'),
      count: Math.floor(Math.random() * 5)
    });
  }
  return data;
};

export const mockHotArticles: HotArticle[] = [
  {
    id: 'h-1',
    title: 'The Future of Retrieval-Augmented Generation (RAG)',
    source: 'AI Insights',
    publishedAt: subDays(new Date(), 1).toISOString(),
    summary: 'An overview of how RAG is evolving beyond simple chunking and similarity search, moving towards agentic approaches.',
    url: 'https://example.com/future-of-rag',
    status: 'idle'
  },
  {
    id: 'h-2',
    title: 'Tailwind CSS 4.0 Released: What\'s New?',
    source: 'Frontend Weekly',
    publishedAt: subDays(new Date(), 2).toISOString(),
    summary: 'Tailwind 4.0 brings a new engine, oxide, and drops the need for a tailwind.config.js in favor of standard CSS syntax.',
    url: 'https://example.com/tailwind-4',
    status: 'idle'
  }
];
