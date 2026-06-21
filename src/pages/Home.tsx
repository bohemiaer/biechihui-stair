import React from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { routes } from '../app/routes';
import { ActivityHeatmap } from '../components/ui/ActivityHeatmap';
import { Button, ErrorState, SkeletonList, StatusBadge } from '../components/ui';
import { useDailyActivityQuery, useHomeSummaryQuery } from '../queries/home';
import { useRecentImportTasksQuery, useRetryImportTaskMutation } from '../queries/imports';
import { useHotArticlesQuery } from '../queries/hot';
import { importStageMeta, importStatusLabel } from '../lib/status';
import { getErrorMessage } from '../lib/errors';

const monthLabels = ['7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月', '4月', '5月', '6月'];

export function Home() {
  const navigate = useNavigate();
  const summaryQuery = useHomeSummaryQuery();
  const activityQuery = useDailyActivityQuery();
  const importTasksQuery = useRecentImportTasksQuery();
  const retryImportTaskMutation = useRetryImportTaskMutation();
  const hotArticlesQuery = useHotArticlesQuery();
  const stats = summaryQuery.data ?? { totalCards: 0, totalWords: 0, totalFolders: 0, weeklyImports: 0 };
  const importTasks = importTasksQuery.data ?? [];
  const hotArticles = (hotArticlesQuery.data ?? []).slice(0, 2);
  const activityDays = React.useMemo(() => {
    const recentActivity = new Map((activityQuery.data ?? []).map((day) => [day.date, day]));
    const today = new Date();
    const startDate = startOfWeek(startOfMonth(subMonths(today, 11)), { weekStartsOn: 1 });
    const endDate = endOfWeek(endOfMonth(today), { weekStartsOn: 1 });
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1;

    return Array.from({ length: totalDays }, (_, index) => {
      const date = addDays(startDate, index);
      const key = format(date, 'yyyy-MM-dd');
      const activity = recentActivity.get(key);

      return {
        date: key,
        count: activity?.count ?? 0,
        tokenCount: activity?.tokenCount ?? 0,
        wordCount: activity?.wordCount ?? 0,
        cardIds: activity?.cardIds ?? [],
      };
    });
  }, [activityQuery.data]);

  return (
    <div className="h-full overflow-y-auto bg-[#FFFFFF]">
      <div className="max-w-[1040px] mx-auto px-12 py-16">
        <header className="mb-12">
          <h1 className="text-[32px] font-semibold text-[#1A1A1A] tracking-tight mb-2">首页</h1>
          <p className="text-[#868E96] text-[14px]">你的知识库数据概览与近期活动。</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
            {summaryQuery.isError && (
              <div className="md:col-span-4">
                <ErrorState
                  message={getErrorMessage(summaryQuery.error, '首页统计加载失败，请稍后重试。')}
                  onRetry={() => void summaryQuery.refetch()}
                />
              </div>
            )}
            {[
              { label: '总计文章', value: stats.totalCards, desc: '已索引' },
              { label: '总计字数', value: Math.round(stats.totalWords / 1000) + 'k', desc: '系统内' },
              { label: '文件夹数', value: stats.totalFolders, desc: '活跃的知识节点' },
              { label: '本周导入', value: stats.weeklyImports, desc: '文章导入树' },
            ].map((stat, i) => (
              <div key={i} className="p-6 rounded-2xl bg-[#F8F9FA] border border-[#EAEAEA]">
                 <p className="text-[12px] font-medium text-[#868E96] uppercase tracking-wider mb-2">{stat.label}</p>
                 <p className="text-[32px] font-semibold text-[#1A1A1A] mb-1">{stat.value}</p>
                 <p className="text-[12px] text-[#868E96]">{stat.desc}</p>
              </div>
            ))}
        </div>

        <div className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-[#1A1A1A]">知识活跃度</h2>
          </div>
          <div className="rounded-2xl border border-[#EAEAEA] bg-[#F8F9FA] px-7 py-8">
             <div className="overflow-hidden">
               <ActivityHeatmap days={activityDays} onDayClick={(date) => navigate(`${routes.calendar}?date=${date}`)} />
             </div>
             <div className="mt-5 flex justify-between text-[13px] text-[#868E96]">
               {monthLabels.map((label) => (
                 <span key={label}>{label}</span>
               ))}
             </div>
          </div>
        </div>

        <div className="mb-12">
           <h2 className="text-[16px] font-semibold text-[#1A1A1A] mb-6">最新导入记录</h2>
           <div className="space-y-3">
              {importTasksQuery.isError && (
                <ErrorState
                  message={getErrorMessage(importTasksQuery.error, '最近导入记录加载失败，请稍后重试。')}
                  onRetry={() => void importTasksQuery.refetch()}
                />
              )}
              {importTasksQuery.isLoading && <SkeletonList rows={2} />}
              {importTasks.map((task) => {
                const stage = importStageMeta[task.stage];

                return (
                <div key={task.id} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-[#EAEAEA] hover:bg-[#F8F9FA] transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`shrink-0 rounded px-2 py-1 text-[12px] font-medium ${stage.colorClassName}`}>
                        {importStatusLabel[task.status]}
                      </span>
                      <span className="truncate text-[14px] text-[#212529]">{task.url}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-[#868E96]">
                      <span>{stage.label}</span>
                      {task.status === 'running' && <span>{task.progress}%</span>}
                      {task.errorMessage && <span className="text-[#C92A2A]">{task.errorMessage}</span>}
                      {task.status === 'failed' && (
                        <button
                          className="font-medium text-[#1A1A1A] hover:underline disabled:opacity-60"
                          disabled={retryImportTaskMutation.isPending}
                          onClick={() => void retryImportTaskMutation.mutateAsync(task.id)}
                          type="button"
                        >
                          重试
                        </button>
                      )}
                    </div>
                  </div>
                  <span className="text-[13px] text-[#868E96] shrink-0 ml-4 font-mono">{format(new Date(task.createdAt), 'MM/dd HH:mm')}</span>
                </div>
                );
              })}
           </div>
        </div>

        <div>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-[#1A1A1A]">文章推荐摘要</h2>
            <Button onClick={() => navigate(routes.recommendations)} variant="ghost">查看全部</Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {hotArticlesQuery.isError && (
              <div className="md:col-span-2">
                <ErrorState
                  message={getErrorMessage(hotArticlesQuery.error, '文章推荐加载失败，请稍后重试。')}
                  onRetry={() => void hotArticlesQuery.refetch()}
                />
              </div>
            )}
            {hotArticles.map((article) => (
              <button
                className="rounded-2xl border border-[#EAEAEA] bg-[#F8F9FA] p-5 text-left transition-colors hover:bg-white"
                key={article.id}
                onClick={() => navigate(routes.recommendations)}
                type="button"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-[12px] text-[#868E96]">{article.source}</span>
                  {article.status === 'imported' && <StatusBadge status="imported" />}
                </div>
                <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-[#1A1A1A]">{article.title}</h3>
                <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-[#868E96]">{article.summary}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
