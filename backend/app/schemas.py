from typing import List, Optional

from pydantic import BaseModel, Field


ImportTaskStatus = str
ImportTaskStage = str
HotArticleStatus = str


class Folder(BaseModel):
    id: str
    name: str
    cardCount: int = 0
    parentId: Optional[str] = None
    isSystem: bool = False
    createdAt: str
    updatedAt: str
    sortOrder: int = 0


class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)


class FolderUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=40)


class Tag(BaseModel):
    id: str
    name: str


class CardImageAsset(BaseModel):
    id: str
    cardId: str
    sourceUrl: str
    localPath: str = ""
    mimeType: str = ""
    sortOrder: int = 0
    status: str = "pending"
    createdAt: str


class AnswerArchive(BaseModel):
    id: str
    cardId: str
    question: str
    answer: str
    usedCardIds: List[str]
    model: str
    createdAt: str


class AnswerArchiveCreate(BaseModel):
    cardId: str = Field(min_length=1)
    question: str = Field(min_length=1)
    answer: str = Field(min_length=1)
    usedCardIds: List[str] = Field(default_factory=list)
    model: str = ""


class KnowledgeCard(BaseModel):
    id: str
    title: str
    url: str
    siteName: str
    folderId: str
    tags: List[Tag]
    summary: str
    contentPreview: str
    fullContent: Optional[str] = None
    notes: str = ""
    note: Optional[str] = None
    sourceType: str = "web"
    author: Optional[str] = None
    publishedAt: Optional[str] = None
    wordCount: int = 0
    readingTime: int = 1
    userTitle: Optional[str] = None
    userSummary: Optional[str] = None
    lastEditedAt: Optional[str] = None
    editedByUser: bool = False
    createdAt: str
    updatedAt: str
    isImportant: bool = False
    isBadData: bool = False
    isDeleted: bool = False
    deletedAt: Optional[str] = None
    deletedFromFolderId: Optional[str] = None
    archivedAt: Optional[str] = None
    refreshStatus: str = "idle"
    lastRefreshedAt: Optional[str] = None
    suggestedQuestions: List[str] = Field(default_factory=list)
    answerArchives: List[AnswerArchive] = Field(default_factory=list)
    imageAssets: List[CardImageAsset] = Field(default_factory=list)


class KnowledgeCardUpdate(BaseModel):
    userTitle: Optional[str] = None
    userSummary: Optional[str] = None
    note: Optional[str] = None
    notes: Optional[str] = None
    folderId: Optional[str] = None
    isImportant: Optional[bool] = None
    isBadData: Optional[bool] = None
    tags: Optional[List[Tag]] = None


class ImportTask(BaseModel):
    id: str
    url: str
    folderId: str
    status: ImportTaskStatus
    stage: ImportTaskStage
    progress: int
    errorCode: Optional[str] = None
    errorMessage: Optional[str] = None
    retryCount: int = 0
    resultCardId: Optional[str] = None
    targetCardId: Optional[str] = None
    hotArticleId: Optional[str] = None
    createdAt: str
    updatedAt: str


class ImportTaskCreate(BaseModel):
    url: str
    folderId: str


class DailyActivity(BaseModel):
    date: str
    count: int
    tokenCount: int
    wordCount: int
    cardIds: List[str]


class DailyReport(BaseModel):
  date: str
  summary: str
  topics: List[str]
  keywords: List[str]
  highlightCardIds: List[str]
  createdAt: str


class CardRefreshRequest(BaseModel):
    preserveNotes: bool = True


class DashboardStats(BaseModel):
    totalCards: int
    totalWords: int
    totalFolders: int
    weeklyImports: int


class HotArticle(BaseModel):
    id: str
    title: str
    source: str
    publishedAt: str
    summary: str
    url: str
    status: HotArticleStatus
    category: str
    reason: Optional[str] = None
    importTaskId: Optional[str] = None
    importedCardId: Optional[str] = None


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)


class SearchResult(BaseModel):
    cardId: str
    card: KnowledgeCard
    score: float
    matchedText: str
    matchedField: str
    highlights: List[str]


class CitationSource(BaseModel):
    cardId: str
    title: str
    url: str
    snippet: str


class AnswerRequest(BaseModel):
    question: str = Field(min_length=1)
    cardIds: List[str]


class AnswerResponse(BaseModel):
    answer: str
    citations: List[CitationSource]
    usedCardIds: List[str]
    model: str
    createdAt: str


class RuntimeConfigStatus(BaseModel):
    chatConfigured: bool = False
    embeddingConfigured: bool = False
    rerankConfigured: bool = False
    siliconflowConfigured: bool = False
    siliconflowBaseUrl: str = ""
    chatBaseUrl: str = ""
    chatModel: str = ""
    embeddingBaseUrl: str = ""
    embeddingModel: str = ""
    rerankApiUrl: str = ""
    rerankModel: str = ""
    useLancedb: bool = False
    configPath: str = ""


class RuntimeConfigUpdate(BaseModel):
    siliconflowApiKey: Optional[str] = None
    siliconflowBaseUrl: Optional[str] = None
    chatApiKey: Optional[str] = None
    chatBaseUrl: Optional[str] = None
    chatModel: Optional[str] = None
    embeddingApiKey: Optional[str] = None
    embeddingBaseUrl: Optional[str] = None
    embeddingModel: Optional[str] = None
    rerankApiKey: Optional[str] = None
    rerankApiUrl: Optional[str] = None
    rerankModel: Optional[str] = None
    useLancedb: Optional[bool] = None


class FeedgrabLoginRequest(BaseModel):
    platform: str = Field(min_length=1)
