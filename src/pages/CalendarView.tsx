import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, subDays, isSameDay, isValid, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, FileText, Sparkles } from 'lucide-react';
import { DateList } from '../components/calendar/DateList';
import { routes } from '../app/routes';
import { useCardsQuery } from '../queries/cards';
import { useCreateDailyReportMutation, useDailyReportQuery } from '../queries/calendar';
import { getErrorMessage } from '../lib/errors';

const parseDateParam = (date: string | null) => {
  if (!date) {
    return new Date();
  }

  const parsedDate = parseISO(date);

  return isValid(parsedDate) ? parsedDate : new Date();
};

export function CalendarView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<Date>(() => parseDateParam(searchParams.get('date')));
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const cardsQuery = useCardsQuery();
  const reportQuery = useDailyReportQuery(selectedDateKey);
  const createDailyReportMutation = useCreateDailyReportMutation(selectedDateKey);
  const cards = cardsQuery.data ?? [];
  const report = reportQuery.data;
  const days = Array.from({ length: 365 }).map((_, i) => subDays(new Date(), i));
  const cardsForDate = cards.filter(c => isSameDay(new Date(c.createdAt), selectedDate));
  const wordCount = cardsForDate.reduce((total, card) => total + (card.wordCount ?? 0), 0);

  React.useEffect(() => {
    setSelectedDate(parseDateParam(searchParams.get('date')));
  }, [searchParams]);

  const handleSelectDate = (day: Date) => {
    setSelectedDate(day);
    setSearchParams({ date: format(day, 'yyyy-MM-dd') });
  };

  return (
    <div className="flex h-full w-full bg-[#FFFFFF]">
      <div className="w-[352px] border-r border-[#EAEAEA] flex flex-col h-full flex-shrink-0 bg-[#FFFFFF]">
        <div className="p-6 border-b border-[#F1F3F5]">
           <h2 className="text-[22px] font-semibold text-[#1A1A1A] flex items-center gap-2">
             时间线
           </h2>
        </div>
        <DateList cards={cards} days={days} onSelectDate={handleSelectDate} selectedDate={selectedDate} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-[#FFFFFF]">
         {cardsForDate.length > 0 ? (
           <div className="flex-1 overflow-y-auto w-full">
             <div className="max-w-[720px] mx-auto px-12 py-16">
               <header className="flex items-start justify-between gap-6 mb-12">
                 <div>
                    <h1 className="text-[32px] font-semibold text-[#1A1A1A] tracking-tight">{format(selectedDate, 'yyyy年 MMMM d日')}</h1>
                    <p className="text-[#868E96] text-[14px] mt-2">当日归档了 {cardsForDate.length} 篇知识内容，约 {wordCount.toLocaleString()} 字。</p>
                 </div>
                 <div className="flex flex-col items-end gap-2">
                   <button
                     className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] hover:bg-[#212529] text-[#FFFFFF] text-[14px] font-medium rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                     disabled={createDailyReportMutation.isPending}
                     onClick={() => createDailyReportMutation.mutate()}
                     type="button"
                   >
                     {createDailyReportMutation.isPending ? (
                       <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                     ) : (
                       <Sparkles size={16} />
                     )}
                     {createDailyReportMutation.isPending ? '生成中' : '生成日报摘要'}
                   </button>
                   {createDailyReportMutation.isError ? (
                     <p className="max-w-[260px] text-right text-[12px] leading-relaxed text-[#C92A2A]">
                       {getErrorMessage(createDailyReportMutation.error, '日报生成失败，请检查 DeepSeek 配置后重试。')}
                     </p>
                   ) : null}
                 </div>
               </header>

               <div className="space-y-12">
                 {/* AI 日报 */}
                 <div className="bg-[#F8F9FA] border border-[#EAEAEA] p-8 rounded-2xl">
                   <div className="flex justify-between items-start mb-6">
                     <h3 className="text-[16px] font-semibold text-[#1A1A1A] flex items-center gap-2">
                       智能归纳报告
                     </h3>
                     <span className="text-[11px] font-medium text-[#868E96] bg-[#E9ECEF] px-2 py-1 rounded">AI Generated</span>
                   </div>
                   <div className="space-y-4 text-[#495057] leading-[1.8] text-[14px]">
                     {report ? (
                       <>
                         <p>{report.summary}</p>
                         <ul className="list-disc pl-5 space-y-2 text-[#868E96]">
                           {report.topics.map((topic) => (
                             <li key={topic}>{topic}</li>
                           ))}
                           {report.keywords.slice(0, 4).map((keyword) => (
                             <li key={keyword}>关键词：{keyword}</li>
                           ))}
                         </ul>
                       </>
                     ) : (
                       <p className="text-[#868E96]">还没有生成日报。点击右上角“生成日报摘要”后，这里才会出现当天总结。</p>
                     )}
                     {report?.highlightCardIds?.length ? (
                       <div className="flex flex-wrap gap-2 pt-2">
                         {report.highlightCardIds.map((cardId) => {
                           const card = cards.find((item) => item.id === cardId);

                           return card ? (
                             <button
                               className="rounded-lg bg-white px-3 py-1.5 text-[12px] font-medium text-[#495057] hover:text-[#1A1A1A]"
                               key={cardId}
                               onClick={() => navigate(`${routes.knowledge}?card=${cardId}`)}
                               type="button"
                             >
                               值得回看：{card.userTitle || card.title}
                             </button>
                           ) : null;
                         })}
                       </div>
                     ) : null}
                   </div>
                 </div>

                 {/* 卡片列表 */}
                 <div>
                   <h3 className="text-[14px] font-bold text-[#868E96] uppercase tracking-widest mb-6 border-b border-[#F1F3F5] pb-2">归档索引 ({cardsForDate.length})</h3>
                   <div className="space-y-4">
                     {cardsForDate.map(card => (
                       <button
                         key={card.id}
                         className="flex w-full cursor-pointer items-start gap-5 rounded-2xl border border-[#EAEAEA] bg-[#FFFFFF] p-5 text-left transition-colors hover:bg-[#F8F9FA]"
                         onClick={() => navigate(`${routes.knowledge}?card=${card.id}`)}
                         type="button"
                       >
                          <div className="w-10 h-10 rounded-xl bg-[#F1F3F5] flex items-center justify-center flex-shrink-0 text-[#868E96]">
                            <FileText size={18} strokeWidth={1.5} />
                          </div>
                          <div>
                            <h4 className="text-[16px] font-medium text-[#212529] mb-1">{card.title}</h4>
                            <p className="text-[14px] text-[#868E96] line-clamp-2 leading-relaxed">{card.summary}</p>
                          </div>
                       </button>
                     ))}
                   </div>
                 </div>
               </div>
             </div>
           </div>
         ) : (
           <div className="flex-1 flex flex-col items-center justify-center text-[#868E96] p-12">
             <CalendarIcon size={48} strokeWidth={1} className="mb-6 opacity-50" />
             <p className="text-[14px]">该日期未产生任何知识归档。</p>
           </div>
         )}
      </div>
    </div>
  );
}
