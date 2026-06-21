import React, { useState, useEffect } from 'react';
import { mockCards, mockFolders } from '../mock/data';
import { MoreHorizontal, Plus, Link, Calendar as CalendarIcon, Tag as TagIcon, Trash2, Edit3, Type, Image as ImageIcon, Video, Table, AlignLeft } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { KnowledgeCard } from '../types';
import { useLocation } from 'react-router-dom';

export function KnowledgeBase() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const selectedFolderId = searchParams.get('folder');

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const filteredCards = selectedFolderId
    ? mockCards.filter(c => c.folderId === selectedFolderId)
    : mockCards;

  const selectedCard = mockCards.find(c => c.id === selectedCardId);
  const folderName = selectedFolderId ? mockFolders.find(f => f.id === selectedFolderId)?.name : '全部收藏';

  return (
    <div className="flex h-full w-full bg-[#FFFFFF]">
      {/* Card List Column (Middle Column) */}
      <div className="w-[320px] bg-[#FFFFFF] border-r border-[#EAEAEA] flex flex-col min-w-0 shrink-0">
         <div className="px-6 py-8 pb-4 shrink-0">
           <h2 className="text-[22px] font-semibold text-[#1A1A1A] tracking-tight">{folderName}</h2>
         </div>

         <div className="px-6 pb-4 shrink-0">
           <button className="w-full flex items-center justify-center space-x-2 bg-[#F8F9FA] text-[#1A1A1A] hover:bg-[#F1F3F5] transition-colors py-2.5 px-4 rounded-xl text-[14px] font-medium border border-[#EAEAEA]">
             <Plus size={16} />
             <span>添加新笔记</span>
           </button>
         </div>

         <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
            {filteredCards.map(card => (
              <div
                key={card.id}
                onClick={() => setSelectedCardId(card.id)}
                className={cn(
                  "p-4 rounded-2xl cursor-pointer transition-all border",
                  selectedCardId === card.id
                    ? "bg-[#F8F9FA] border-[#EAEAEA] shadow-sm"
                    : "bg-[#FFFFFF] border-transparent hover:bg-[#F8F9FA]/50"
                )}
              >
                <div className="flex items-start justify-between mb-2">
                   <span className="text-[12px] font-medium text-[#868E96] uppercase tracking-wider">
                     {format(new Date(card.createdAt), 'dd MMM yyyy')}
                   </span>
                </div>
                <h3 className="text-[15px] font-medium text-[#212529] leading-snug mb-1 line-clamp-2">
                  {card.title}
                </h3>
                <p className="text-[13px] text-[#868E96] line-clamp-2 mb-3 leading-relaxed">
                  {card.summary}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {card.tags.slice(0, 3).map(tag => (
                    <span key={tag.id} className="px-2 py-1 bg-[#F1F3F5] text-[#868E96] text-[11px] font-medium rounded-md">
                      {tag.name}
                    </span>
                  ))}
                  {card.tags.length > 3 && (
                    <span className="px-2 py-1 bg-[#F1F3F5] text-[#868E96] text-[11px] font-medium rounded-md flex items-center gap-1">
                      <Plus size={10} /> {card.tags.length - 3} 更多
                    </span>
                  )}
                </div>
              </div>
            ))}
         </div>
      </div>

      {/* Detail Column (Read/Edit State) */}
      <div className="flex-1 flex flex-col bg-[#FFFFFF] min-w-0">
        {selectedCard ? (
          <div className="flex-1 overflow-y-auto flex justify-center">
            <article className="max-w-[720px] w-full px-12 py-16">
               <div className="flex items-center text-[13px] text-[#868E96] mb-8 font-medium">
                 <span>{folderName}</span>
                 <span className="mx-2 text-[#EAEAEA]">/</span>
                 <span className="truncate max-w-[200px] text-[#212529]">{selectedCard.title}</span>
                 <div className="ml-auto flex items-center gap-3">
                   <button className="text-[#868E96] hover:text-[#1A1A1A] transition-colors"><MoreHorizontal size={20} /></button>
                 </div>
               </div>

               <h1 className="text-[32px] font-semibold text-[#1A1A1A] leading-tight tracking-tight mb-8">
                 {selectedCard.title}
               </h1>

               <div className="space-y-4 text-[14px] mb-10 pb-10 border-b border-[#F1F3F5]">
                  <div className="flex items-center">
                    <span className="w-28 text-[#868E96]">来源</span>
                    <a href={selectedCard.url} target="_blank" rel="noopener noreferrer" className="text-[#212529] hover:underline flex items-center gap-2 font-medium">
                      <img src={`https://www.google.com/s2/favicons?domain=${selectedCard.url}`} className="w-4 h-4 rounded-sm" alt="" />
                      {selectedCard.siteName}
                    </a>
                  </div>
                  <div className="flex items-center">
                    <span className="w-28 text-[#868E96]">最近修改</span>
                    <span className="text-[#212529]">{format(new Date(selectedCard.updatedAt), 'dd MMMM yyyy, HH:mm')}</span>
                  </div>
                  <div className="flex items-start pt-2">
                    <span className="w-28 text-[#868E96] mt-1.5">标签</span>
                    <div className="flex flex-wrap gap-2 flex-1">
                      {selectedCard.tags.map(t => (
                        <span key={t.id} className="px-3 py-1 bg-[#E9ECEF] text-[#495057] text-[13px] font-medium rounded-lg cursor-pointer hover:bg-[#DEE2E6] transition-colors">
                          {t.name}
                        </span>
                      ))}
                      <button className="px-3 py-1 bg-[#F8F9FA] text-[#868E96] text-[13px] font-medium rounded-lg hover:bg-[#F1F3F5] hover:text-[#212529] transition-colors flex items-center gap-1 border border-[#EAEAEA] border-dashed">
                        <Plus size={12} /> 添加标签
                      </button>
                    </div>
                  </div>
               </div>

               {/* Editor Toolbar Mock */}
               <div className="flex items-center gap-4 mb-8 pt-2 pb-4 text-[#868E96] overflow-x-auto no-scrollbar">
                 <select className="bg-transparent border-none text-[14px] font-medium text-[#212529] focus:ring-0 cursor-pointer">
                   <option>正文文本</option>
                   <option>标题 1</option>
                 </select>
                 <div className="w-[1px] h-4 bg-[#EAEAEA]" />
                 <span className="text-[14px]">16</span>
                 <div className="w-[1px] h-4 bg-[#EAEAEA]" />
                 <div className="flex items-center gap-3">
                   <span className="font-bold cursor-pointer hover:text-[#212529]">B</span>
                   <span className="italic font-serif cursor-pointer hover:text-[#212529]">I</span>
                   <Link size={16} className="cursor-pointer hover:text-[#212529]" />
                 </div>
                 <div className="w-[1px] h-4 bg-[#EAEAEA]" />
                 <div className="flex items-center gap-3">
                   <AlignLeft size={16} className="cursor-pointer hover:text-[#212529]" />
                 </div>
                 <div className="w-[1px] h-4 bg-[#EAEAEA]" />
                 <div className="flex items-center gap-3">
                   <ImageIcon size={16} className="cursor-pointer hover:text-[#212529]" />
                   <Video size={16} className="cursor-pointer hover:text-[#212529]" />
                   <Table size={16} className="cursor-pointer hover:text-[#212529]" />
                   <CalendarIcon size={16} className="cursor-pointer hover:text-[#212529]" />
                 </div>
               </div>

               <section className="mb-10">
                 <h2 className="text-[20px] font-semibold text-[#1A1A1A] mb-4">AI 摘要笔记</h2>
                 <p className="text-[#495057] leading-[1.8] text-[15px]">
                   {selectedCard.summary}
                 </p>
               </section>

               <section>
                 <h2 className="text-[20px] font-semibold text-[#1A1A1A] mb-4">内容预览</h2>
                 <div className="prose prose-gray max-w-none text-[#495057] leading-[1.8] text-[15px]">
                   <p>{selectedCard.contentPreview}</p>
                   {/* Mock Images */}
                   <div className="grid grid-cols-2 gap-4 mt-6">
                     <div className="aspect-[4/3] bg-[#F8F9FA] rounded-xl flex items-center justify-center border border-[#EAEAEA] text-[#ADB5BD]">
                       <ImageIcon size={24} strokeWidth={1.5} />
                     </div>
                     <div className="aspect-[4/3] bg-[#F8F9FA] rounded-xl flex items-center justify-center border border-[#EAEAEA] text-[#ADB5BD]">
                       <ImageIcon size={24} strokeWidth={1.5} />
                     </div>
                   </div>
                 </div>
               </section>
            </article>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#868E96]">
             请在左侧选择一篇笔记
          </div>
        )}
      </div>
    </div>
  );
}
