import { beforeEach, describe, expect, it } from 'vitest';

import {
  answerQuestion,
  createFolder,
  deleteFolder,
  createImportTask,
  deleteCard,
  getCards,
  getCardById,
  getDailyReport,
  getFolders,
  getHomeSummary,
  getHotArticles,
  getRecentImportTasks,
  importHotArticle,
  permanentlyDeleteCard,
  refreshCard,
  regenerateCard,
  resetMockSource,
  restoreCard,
  retryImportTask,
  rewriteSearchQuery,
  searchCards,
  updateCard,
  updateFolder,
} from './mockSource';

describe('mock API source', () => {
  beforeEach(() => {
    resetMockSource();
  });

  it('returns dashboard summary data used by Home', async () => {
    const summary = await getHomeSummary();

    expect(summary.totalCards).toBeGreaterThan(0);
    expect(summary.totalFolders).toBeGreaterThan(0);
    expect(summary.weeklyImports).toBeGreaterThan(0);
  });

  it('recomputes home summary folder count after folder changes', async () => {
    const initialSummary = await getHomeSummary();

    await createFolder({ name: 'Temporary Folder' });
    const afterCreateSummary = await getHomeSummary();
    await deleteFolder('f-4');
    const afterDeleteSummary = await getHomeSummary();

    expect(afterCreateSummary.totalFolders).toBe(initialSummary.totalFolders + 1);
    expect(afterDeleteSummary.totalFolders).toBe(initialSummary.totalFolders);
  });

  it('filters knowledge cards by folder', async () => {
    const allCards = await getCards();
    const filteredCards = await getCards({ folderId: 'f-4' });

    expect(allCards.length).toBeGreaterThan(filteredCards.length);
    expect(filteredCards.length).toBeGreaterThan(0);
    expect(filteredCards.every((card) => card.folderId === 'f-4')).toBe(true);
  });

  it('creates an importing task and exposes it in recent tasks first', async () => {
    const task = await createImportTask({
      url: 'https://example.com/new-article',
      folderId: 'f-1',
    });
    const recentTasks = await getRecentImportTasks();

    expect(task).toMatchObject({
      url: 'https://example.com/new-article',
      folderId: 'f-1',
      status: 'running',
      stage: 'waiting',
      progress: 0,
    });
    expect(task.stage).toBe('waiting');
    expect(recentTasks[0]).toMatchObject({
      id: task.id,
      status: 'running',
      stage: 'fetching',
      progress: 22,
    });
  });

  it('returns folders and hot articles for library navigation and recommendations', async () => {
    const folders = await getFolders();
    const hotArticles = await getHotArticles();

    expect(folders.some((folder) => folder.id === 'uncategorized')).toBe(true);
    expect(folders.find((folder) => folder.id === 'uncategorized')?.isSystem).toBe(true);
    expect(hotArticles.some((article) => article.status === 'imported')).toBe(true);
  });

  it('creates user folders after system folders are initialized', async () => {
    const folder = await createFolder({ name: 'Research Inbox' });
    const folders = await getFolders();

    expect(folder).toMatchObject({
      name: 'Research Inbox',
      isSystem: false,
      parentId: null,
    });
    expect(folders.some((item) => item.id === folder.id)).toBe(true);
  });

  it('renames user folders and moves cards to uncategorized when deleting folders', async () => {
    const renamed = await updateFolder('f-4', { name: 'Renamed Ideas' });
    const result = await deleteFolder('f-4');
    const folders = await getFolders();
    const uncategorizedCards = await getCards({ folderId: 'uncategorized' });

    expect(renamed.name).toBe('Renamed Ideas');
    expect(result.movedCardCount).toBeGreaterThan(0);
    expect(folders.some((folder) => folder.id === 'f-4')).toBe(false);
    expect(uncategorizedCards.some((card) => card.id === 'c-2')).toBe(true);
    await expect(deleteFolder('uncategorized')).rejects.toThrow('System folder cannot be deleted');
  });

  it('returns typed search results with highlights and scores', async () => {
    const results = await searchCards('功能介绍');
    const rewrittenResults = await searchCards('数据库范式化怎么理解');

    expect(results[0]).toMatchObject({
      cardId: 'c-1',
      matchedField: 'title',
    });
    expect(results[0]?.score).toBeGreaterThan(0);
    expect(results[0]?.highlights.length).toBeGreaterThan(0);
    expect(rewriteSearchQuery('数据库范式化怎么理解')).toBe('normalization');
    expect(rewrittenResults).toHaveLength(0);
  });

  it('updates, moves, marks, and soft deletes cards', async () => {
    const updated = await updateCard('c-1', {
      userTitle: 'Edited title',
      note: 'Keep this for exam review',
      folderId: 'f-4',
      isImportant: false,
      isBadData: true,
    });
    const movedCards = await getCards({ folderId: 'f-4' });

    expect(updated).toMatchObject({
      userTitle: 'Edited title',
      note: 'Keep this for exam review',
      folderId: 'f-4',
      isImportant: false,
      isBadData: true,
      editedByUser: true,
    });
    expect(movedCards.some((card) => card.id === 'c-1')).toBe(true);

    await deleteCard('c-1');

    expect(await getCardById('c-1')).toBeUndefined();
    expect((await getCards()).some((card) => card.id === 'c-1')).toBe(false);
    expect((await getCards({ includeDeleted: true })).some((card) => card.id === 'c-1')).toBe(true);
  });

  it('restores and permanently deletes cards from trash', async () => {
    await deleteCard('c-1');
    const restored = await restoreCard('c-1');

    expect(restored.deletedAt).toBeNull();
    expect(restored.folderId).toBe('f-4');
    expect(await getCardById('c-1')).toBeDefined();

    await deleteCard('c-1');
    await permanentlyDeleteCard('c-1');

    expect((await getCards({ includeDeleted: true })).some((card) => card.id === 'c-1')).toBe(false);
  });

  it('returns a daily report and answer citations', async () => {
    const report = await getDailyReport(new Date().toISOString().slice(0, 10));
    const answer = await answerQuestion({
      question: 'What is normalization?',
      cardIds: ['c-1'],
    });

    expect(report.keywords).toContain('Normalization');
    expect(answer.citations[0]?.cardId).toBe('c-1');
  });

  it('retries failed import tasks and imports hot articles into a chosen folder', async () => {
    const retried = await retryImportTask('tsk-3');
    const task = await importHotArticle({ articleId: 'h-1', folderId: 'f-4' });
    const hotArticles = await getHotArticles();

    expect(retried).toMatchObject({
      status: 'running',
      stage: 'fetching',
      errorMessage: undefined,
      retryCount: 2,
    });
    expect(task.folderId).toBe('f-4');
    expect(hotArticles.find((article) => article.id === 'h-1')).toMatchObject({
      status: 'running',
      importTaskId: task.id,
    });
  });

  it('advances running import tasks and creates a card when finished', async () => {
    const task = await createImportTask({
      url: 'https://example.com/progress-source',
      folderId: 'f-4',
    });

    await getRecentImportTasks();
    await getRecentImportTasks();
    await getRecentImportTasks();
    await getRecentImportTasks();
    const recentTasks = await getRecentImportTasks();
    const completedTask = recentTasks.find((item) => item.id === task.id);
    const generatedCard = await getCardById(`card-${task.id}`);

    expect(completedTask).toMatchObject({
      status: 'succeeded',
      stage: 'done',
      progress: 100,
      resultCardId: `card-${task.id}`,
    });
    expect(generatedCard).toMatchObject({
      folderId: 'f-4',
      url: 'https://example.com/progress-source',
    });
  });

  it('refreshes source content and regenerates summaries with tags', async () => {
    const refreshed = await refreshCard('c-1');
    const regenerated = await regenerateCard('c-1');

    expect(refreshed.status).toBe('running');
    expect(refreshed.url).toBe('https://docs.biechihui.local/features');
    expect(regenerated.userSummary).toContain('已重新生成');
    expect(regenerated.tags.some((tag) => tag.name === 'AI 摘要')).toBe(true);

    await getRecentImportTasks();
    await getRecentImportTasks();
    await getRecentImportTasks();
    await getRecentImportTasks();
    await getRecentImportTasks();
    const recentTasks = await getRecentImportTasks();
    const completedRefreshTask = recentTasks.find((task) => task.id === refreshed.id);
    const updatedCard = completedRefreshTask?.resultCardId ? await getCardById(completedRefreshTask.resultCardId) : undefined;

    expect(await getCardById('c-1')).toBeUndefined();
    expect(updatedCard?.fullContent).toContain('旧知识卡片已被删除');
  });
});
