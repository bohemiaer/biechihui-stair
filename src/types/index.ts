export interface User {
  id: string;
  name: string;
  avatar: string;
}

export interface Folder {
  id: string;
  name: string;
  cardCount: number;
  parentId?: string | null;
  isSystem?: boolean;
  createdAt?: string;
  updatedAt?: string;
  sortOrder?: number;
}

export interface Tag {
  id: string;
  name: string;
}

export interface CardImageAsset {
  id: string;
  cardId: string;
  sourceUrl: string;
  localPath: string;
  mimeType: string;
  sortOrder: number;
  status: string;
  createdAt: string;
}

export type SourceType = 'web' | 'pdf' | 'note' | 'rss';
export type RefreshStatus = 'idle' | 'refreshing' | 'failed';

export interface KnowledgeItem {
  id: string;
  cardId: string;
  rawText: string;
  parsedText: string;
  chunks: Array<{
    id: string;
    text: string;
    embeddingStatus: 'pending' | 'embedded' | 'failed';
  }>;
  wordCount: number;
  createdAt: string;
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
  note?: string;
  sourceType?: SourceType;
  author?: string;
  publishedAt?: string;
  wordCount?: number;
  readingTime?: number;
  userTitle?: string;
  userSummary?: string;
  lastEditedAt?: string;
  editedByUser?: boolean;
  createdAt: string;
  updatedAt: string;
  isImportant: boolean;
  isBadData: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedFromFolderId?: string | null;
  archivedAt?: string | null;
  refreshStatus?: RefreshStatus;
  lastRefreshedAt?: string;
  suggestedQuestions?: string[];
  answerArchives?: AnswerArchive[];
  imageAssets?: CardImageAsset[];
}

export type ImportTaskStatus = 'pending' | 'running' | 'succeeded' | 'failed';
export type ImportTaskStage = 'waiting' | 'fetching' | 'summarizing' | 'embedding' | 'saving' | 'done' | 'failed';

export interface ImportTask {
  id: string;
  url: string;
  folderId: string;
  status: ImportTaskStatus;
  stage: ImportTaskStage;
  progress: number;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  resultCardId?: string;
  targetCardId?: string;
  hotArticleId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyActivity {
  date: string;
  count: number;
  tokenCount: number;
  wordCount: number;
  cardIds: string[];
}

export interface DailyReport {
  date: string;
  summary: string;
  topics: string[];
  keywords: string[];
  highlightCardIds: string[];
  createdAt: string;
}

export interface DashboardStats {
  totalCards: number;
  totalWords: number;
  totalFolders: number;
  weeklyImports: number;
}

export type HotArticleStatus = 'idle' | 'running' | 'imported' | 'failed';

export interface HotArticle {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  summary: string;
  url: string;
  status: HotArticleStatus;
  category: string;
  reason?: string;
  importTaskId?: string;
  importedCardId?: string;
}

export interface SearchResult {
  cardId: string;
  card: KnowledgeCard;
  score: number;
  matchedText: string;
  matchedField: 'title' | 'summary' | 'content' | 'tag' | 'source';
  highlights: string[];
}

export interface CitationSource {
  cardId: string;
  title: string;
  url: string;
  snippet: string;
}

export interface AnswerResponse {
  answer: string;
  citations: CitationSource[];
  usedCardIds: string[];
  model: string;
  createdAt: string;
}

export interface AnswerArchive {
  id: string;
  cardId: string;
  question: string;
  answer: string;
  usedCardIds: string[];
  model: string;
  createdAt: string;
}

export interface ApiError {
  type: 'network' | 'fetch_failed' | 'model_missing' | 'parse_failed' | 'save_failed' | 'unknown';
  message: string;
  stage?: ImportTaskStage;
  recoverable: boolean;
  context?: Record<string, unknown>;
}

export interface PageRequest {
  page?: number;
  pageSize?: number;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export type SortOption = 'createdAt' | 'updatedAt' | 'title' | 'source';
