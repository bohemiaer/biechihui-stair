import React, { useState } from 'react';
import { format, subDays, isSameDay } from 'date-fns';
import { mockCards } from '../mock/data';
import { KnowledgeCard } from '../types';
import { Calendar as CalendarIcon, FileText, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

export function CalendarView() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const days = Array.from({ length: 30 }).map((_, i) => subDays(new Date(), i));
  const cardsForDate = mockCards.filter(c => isSameDay(new Date(c.createdAt), selectedDate));

  return (
    <div className="flex h-full w-full bg-[#FFFFFF]">
      <div className="w-[320px] border-r border-[#EAEAEA] flex flex-col h-full flex-shrink-0 bg-[#FFFFFF]">
        <div className="p-6 border-b border-[#F1F3F5]">
           <h2 className="text-[22px] font-semibold text-[#1A1A1A] flex items-center gap-2">
             时间线
           </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {days.map((day, i) => {
            const isSelected = isSameDay(day, selectedDate);
            const count = isSameDay(day, new Date()) ? mockCards.length : (i % 3 === 0 ? 1 : 0);

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl text-[14px] font-medium transition-colors flex justify-between items-center group",
                  isSelected ? "bg-[#F1F3F5] text-[#1A1A1A]" : "text-[#868E96] hover:bg-[#F8F9FA] hover:text-[#212529]"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={isSelected ? 'text-[#1A1A1A]' : 'text-[#495057]'}>{format(day, 'MMM dd')}</span>
                  <span className="text-[12px] opacity-70 font-normal uppercase">{format(day, 'EEE')}</span>
                </div>
                {count > 0 && (
                   <span className={cn("px-2 py-0.5 rounded text-[11px]", isSelected ? "bg-[#DEE2E6] text-[#212529]" : "bg-[#F1F3F5] text-[#868E96]")}>
                     {count} 篇
                   </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-[#FFFFFF]">
         {cardsForDate.length > 0 ? (
           <div className="flex-1 overflow-y-auto w-full">
             <div className="max-w-[720px] mx-auto px-12 py-16">
               <header className="flex items-center justify-between mb-12">
                 <div>
                    <h1 className="text-[32px] font-semibold text-[#1A1A1A] tracking-tight">{format(selectedDate, 'yyyy年 MMMM d日')}</h1>
                    <p className="text-[#868E96] text-[14px] mt-2">当日归档了 {cardsForDate.length} 篇知识内容。</p>
                 </div>
                 <button className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] hover:bg-[#212529] text-[#FFFFFF] text-[14px] font-medium rounded-xl transition-colors">
                   <Sparkles size={16} />
                   生成日报摘要
                 </button>
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
                     <p>今天的内容焦点主要集中在 <strong>数据库架构 (Database Architecture)</strong> 和 <strong>UI 设计模式 (Design Patterns)</strong>。</p>
                     <ul className="list-disc pl-5 space-y-2 text-[#868E96]">
                       <li>复习并收录了范式理论 (Normalization)，特别是 3NF 和 BCNF 对减少冗余数据的关键性。</li>
                       <li>收集了适用于最小化界面的视觉设计思路与工具资源。</li>
                     </ul>
                   </div>
                 </div>

                 {/* 卡片列表 */}
                 <div>
                   <h3 className="text-[14px] font-bold text-[#868E96] uppercase tracking-widest mb-6 border-b border-[#F1F3F5] pb-2">归档索引 ({cardsForDate.length})</h3>
                   <div className="space-y-4">
                     {cardsForDate.map(card => (
                       <div key={card.id} className="p-5 rounded-2xl border border-[#EAEAEA] bg-[#FFFFFF] flex items-start gap-5 hover:bg-[#F8F9FA] transition-colors cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-[#F1F3F5] flex items-center justify-center flex-shrink-0 text-[#868E96]">
                            <FileText size={18} strokeWidth={1.5} />
                          </div>
                          <div>
                            <h4 className="text-[16px] font-medium text-[#212529] mb-1">{card.title}</h4>
                            <p className="text-[14px] text-[#868E96] line-clamp-2 leading-relaxed">{card.summary}</p>
                          </div>
                       </div>
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
