import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Flame, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

import { Button, EmptyState, ErrorState, StatusBadge } from '../components/ui';
import { ImportModal } from '../components/ui/ImportModal';
import { useHotArticlesQuery, useImportHotArticleMutation } from '../queries/hot';
import { useRecentImportTasksQuery } from '../queries/imports';
import { getErrorMessage, getImportTaskFailureMessage } from '../lib/errors';
import { queryKeys } from '../queries/keys';
import type { HotArticle } from '../types';

const categories = [
  { label: '全部', value: 'all' },
  { label: 'AI 产品', value: 'ai-product' },
  { label: '技巧', value: 'skills' },
  { label: '精选', value: 'featured' },
  { label: '前端', value: 'frontend' },
  { label: 'UX', value: 'ux' },
] as const;

const AIHOT_FETCH_LIMIT = 30;

type CategoryValue = (typeof categories)[number]['value'];

export function Recommendations() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryValue>('all');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [articleForImport, setArticleForImport] = useState<HotArticle | null>(null);
  const queryClient = useQueryClient();
  const hotArticlesQuery = useHotArticlesQuery();
  const importHotArticleMutation = useImportHotArticleMutation();
  const recentImportTasksQuery = useRecentImportTasksQuery();
  const articles = hotArticlesQuery.data ?? [];
  const aihotArticleCount = articles.filter((article) => article.id.startsWith('aihot-')).length;
  const connectedArticleCount = aihotArticleCount || articles.length;
  const filteredArticles = useMemo(
    () => articles.filter((article) => selectedCategory === 'all' || article.category === selectedCategory),
    [articles, selectedCategory],
  );
  const selectedArticle = articles.find((article) => article.id === selectedArticleId) ?? filteredArticles[0];

  useEffect(() => {
    if (!recentImportTasksQuery.data) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: queryKeys.hot.articles });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
  }, [queryClient, recentImportTasksQuery.data]);

  const getImportStatus = (article: HotArticle) => article.status;

  const getImportButtonLabel = (article: HotArticle) => {
    const status = getImportStatus(article);

    if (status === 'imported') return '已加入知识库';
    if (status === 'running') return '导入中';
    return '加入知识库';
  };

  const isImportLocked = (article: HotArticle) => {
    const status = getImportStatus(article);

    return status === 'imported' || status === 'running';
  };

  const openImportModal = (article: HotArticle) => {
    if (isImportLocked(article)) {
      return;
    }

    setSelectedArticleId(article.id);
    setArticleForImport(article);
  };

  const handleImportArticle = async (folderId: string) => {
    if (!articleForImport) {
      return;
    }

    try {
      const task = await importHotArticleMutation.mutateAsync({
        articleId: articleForImport.id,
        folderId,
      });

      if (task.status === 'failed') {
        throw new Error(getImportTaskFailureMessage(task));
      }
    } catch (error) {
      throw error;
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#FFFFFF]">
      <div className="mx-auto max-w-[1120px] px-12 py-16">
        <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-3 flex items-center gap-3 text-[32px] font-semibold tracking-tight text-[#1A1A1A]">
              <Flame className="text-[#868E96]" size={28} strokeWidth={1.5} />
              文章推荐
            </h1>
            <p className="text-[14px] font-medium text-[#868E96]">
              基于知识库拓扑，为你优选的内容节点。每次从 AIHOT 拉取 {AIHOT_FETCH_LIMIT} 篇，当前列表 {connectedArticleCount} 篇。
            </p>
          </div>
          <Button
            className="mt-1"
            loading={hotArticlesQuery.isFetching}
            onClick={() => void hotArticlesQuery.refetch()}
            type="button"
            variant="secondary"
          >
            <RefreshCw size={15} />
            刷新推荐
          </Button>
        </header>

        <div className="mb-10 flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              className={`rounded-lg px-4 py-1.5 text-[13px] font-medium transition-all ${
                selectedCategory === category.value
                  ? 'bg-[#1A1A1A] text-[#FFFFFF]'
                  : 'border border-[#EAEAEA] bg-[#F8F9FA] text-[#868E96] hover:bg-[#E9ECEF] hover:text-[#212529]'
              }`}
              key={category.value}
              onClick={() => setSelectedCategory(category.value)}
              type="button"
            >
              {category.label}
            </button>
          ))}
        </div>

        <div>
          <div className="space-y-5">
            {hotArticlesQuery.isError && (
              <ErrorState
                message={getErrorMessage(hotArticlesQuery.error, '推荐文章加载失败，请稍后重试。')}
                onRetry={() => void hotArticlesQuery.refetch()}
              />
            )}
            {filteredArticles.map((article) => (
              <article
                className={`group flex cursor-pointer flex-col gap-5 rounded-2xl border p-6 transition-all ${
                  selectedArticle?.id === article.id ? 'border-[#CED4DA] bg-[#F8F9FA]' : 'border-[#EAEAEA] bg-[#FFFFFF] hover:border-[#CED4DA] hover:bg-[#F8F9FA]'
                }`}
                key={article.id}
                onClick={() => setSelectedArticleId(article.id)}
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1.5 rounded bg-[#E9ECEF] px-2 py-0.5 text-[11px] font-medium uppercase text-[#495057]">
                      <Sparkles size={12} /> 关联匹配度高
                    </span>
                    <span className="text-[12px] text-[#ADB5BD]">{article.source} • {format(new Date(article.publishedAt), 'MMM d')}</span>
                    {getImportStatus(article) !== 'idle' && <StatusBadge status={getImportStatus(article)} />}
                  </div>
                  <h3 className="text-[20px] font-medium leading-snug text-[#1A1A1A] decoration-[#EAEAEA] underline-offset-4 group-hover:underline">
                    {article.title}
                  </h3>
                  <p className="text-[14px] leading-[1.8] text-[#868E96]">{article.summary}</p>
                </div>
                <div className="flex gap-3 border-t border-[#F1F3F5] pt-4">
                  <Button
                    disabled={isImportLocked(article)}
                    loading={importHotArticleMutation.isPending && articleForImport?.id === article.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      openImportModal(article);
                    }}
                    variant={isImportLocked(article) ? 'secondary' : 'primary'}
                  >
                    <Plus size={14} />
                    {getImportButtonLabel(article)}
                  </Button>
                  <a
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-[#F8F9FA] px-4 py-2 text-[13px] font-medium text-[#495057] transition-colors hover:bg-[#E9ECEF]"
                    href={article.url}
                    onClick={(event) => event.stopPropagation()}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    打开原文 <ExternalLink size={12} />
                  </a>
                </div>
              </article>
            ))}

            {filteredArticles.length === 0 && (
              <EmptyState title="暂无推荐文章" description="当前分类下没有可推荐内容，稍后可以换个分类看看。" />
            )}
          </div>
        </div>
      </div>

      {articleForImport && (
        <ImportModal
          initialUrl={articleForImport.url}
          onClose={() => setArticleForImport(null)}
          onSubmitImport={({ folderId }) => handleImportArticle(folderId)}
          submitLabel="加入知识库"
          title="导入推荐文章"
        />
      )}
    </div>
  );
}
