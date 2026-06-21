export interface User {
  id: string;
  name: string;
  avatar: string;
}

export interface Folder {
  id: string;
  name: string;
  cardCount: number;
}

export interface Tag {
  id: string;
  name: string;
}

export interface KnowledgeCard {
  id: string;
  title: string;
  url: string;
  siteName: string;
  folderId: string;
  tags: Tag[];
  summary: string;
  contentPreview: string;
  fullContent?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  isImportant: boolean;
  isBadData: boolean;
  isDeleted?: boolean;
}

export interface ImportTask {
  id: string;
  url: string;
  folderId: string;
  status: 'importing' | 'success' | 'error';
  errorMessage?: string;
  createdAt: string;
}

export interface DailyActivity {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface DashboardStats {
  totalCards: number;
  totalWords: number;
  totalFolders: number;
  weeklyImports: number;
}

export interface HotArticle {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  summary: string;
  url: string;
  status: 'idle' | 'imported';
}
