import React, { useState } from 'react';
import { Search as SearchIcon, ArrowRight, MessageSquare, Sparkles } from 'lucide-react';
import { mockCards } from '../mock/data';
import { KnowledgeCard } from '../types';

export function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KnowledgeCard[]>([]);
  const [selectedCards, setSelectedCards] = useState<KnowledgeCard[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    setResults(mockCards);
  };

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question || selectedCards.length === 0) return;
    setAnswer(`基于你所选的笔记，“${question}” 的核心要点是：范式化(Normalization)确保了基础设施的冗余度降到最低，从而提纯数据质量。`);
  };

  const toggleSelectCard = (card: KnowledgeCard) => {
    if (selectedCards.find(c => c.id === card.id)) {
        setSelectedCards(selectedCards.filter(c => c.id !== card.id));
    } else {
        setSelectedCards([...selectedCards, card]);
    }
  };

  return (
    <div className="h-full w-full bg-[#FFFFFF] flex flex-col">
      <header className="px-12 pt-16 pb-8 border-b border-[#F1F3F5] bg-[#FFFFFF] shrink-0">
        <h1 className="text-[32px] font-semibold text-[#1A1A1A] tracking-tight mb-8">AI 检索问答</h1>
        <form onSubmit={handleSearch} className="relative max-w-3xl">
          <div className="relative">
             <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#868E96]" size={20} strokeWidth={1.5} />
             <input
               type="text"
               placeholder="根据模糊记忆检索... (如：关于数据库原理的文章)"
               className="w-full pl-12 pr-6 py-4 text-[15px] border border-[#EAEAEA] rounded-xl bg-[#F8F9FA] focus:bg-[#FFFFFF] focus:outline-none focus:border-[#ADB5BD] transition-all"
               value={query}
               onChange={(e) => setQuery(e.target.value)}
             />
          </div>
        </form>
      </header>

      <div className="flex-1 min-h-0 flex text-[#212529]">
        <div className="w-1/2 p-12 border-r border-[#EAEAEA] overflow-y-auto">
           <h2 className="text-[12px] font-bold text-[#868E96] uppercase tracking-widest mb-6">搜索结果</h2>
           <div className="space-y-4">
             {results.map(card => {
               const isSelected = selectedCards.some(c => c.id === card.id);
               return (
                 <div
                   key={card.id}
                   onClick={() => toggleSelectCard(card)}
                   className={`p-5 rounded-2xl border cursor-pointer transition-all ${isSelected ? 'border-[#868E96] bg-[#FFFFFF] shadow-sm' : 'border-[#EAEAEA] bg-[#F8F9FA] hover:bg-[#FFFFFF]'}`}
                 >
                   <div className="flex justify-between items-start mb-3">
                      <h3 className="text-[16px] font-medium text-[#1A1A1A] leading-snug pr-6 tracking-tight">{card.title}</h3>
                      <div className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'bg-[#1A1A1A] border-[#1A1A1A]' : 'border-[#CED4DA] bg-[#FFFFFF]'}`}>
                         {isSelected && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3 text-white"><polyline points="20 6 9 17 4 12" /></svg>}
                      </div>
                   </div>
                   <p className="text-[14px] text-[#868E96] line-clamp-2 leading-relaxed">{card.summary}</p>
                 </div>
               );
             })}
             {results.length === 0 && (
               <div className="text-[#ADB5BD] text-[14px] text-center py-20">
                 输入关键词开始检索。
               </div>
             )}
           </div>
        </div>

        <div className="w-1/2 p-12 overflow-y-auto flex flex-col bg-[#FFFFFF]">
           <h2 className="text-[12px] font-bold text-[#868E96] uppercase tracking-widest mb-6">多文档问答综述</h2>

           <div className="flex-1 mb-6 flex flex-col justify-end">
             {answer ? (
                <div className="space-y-6 p-2">
                  <div className="flex items-start gap-4">
                     <div className="w-8 h-8 rounded-full bg-[#E9ECEF] flex items-center justify-center flex-shrink-0 text-[#868E96] font-bold text-[12px]">我</div>
                     <div className="bg-[#F8F9FA] border border-[#EAEAEA] rounded-2xl p-5">
                       <p className="text-[#212529] text-[14px] font-medium leading-relaxed">{question}</p>
                     </div>
                  </div>
                  <div className="flex items-start gap-4">
                     <div className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center flex-shrink-0">
                       <Sparkles className="text-[#FFFFFF] w-4 h-4" />
                     </div>
                     <div className="bg-[#FFFFFF] border border-[#EAEAEA] rounded-2xl p-6 space-y-4 shadow-sm">
                       <p className="text-[#495057] text-[14px] leading-[1.8]">{answer}</p>
                       <div className="pt-4 border-t border-[#F1F3F5] flex flex-wrap gap-2 items-center">
                         <span className="text-[11px] font-bold text-[#868E96]">参考信源:</span>
                         {selectedCards.map(c => (
                            <span key={c.id} className="text-[11px] text-[#495057] bg-[#F8F9FA] border border-[#EAEAEA] px-2 py-1 rounded truncate max-w-[200px]">{c.title}</span>
                         ))}
                       </div>
                     </div>
                  </div>
                </div>
             ) : (
                <div className="flex flex-col items-center justify-center text-[#ADB5BD] h-full space-y-4">
                  <MessageSquare size={32} strokeWidth={1} />
                  <p className="text-[14px] text-center max-w-xs leading-relaxed">选中左侧文档组合，发起提问。</p>
                </div>
             )}
           </div>

           <form onSubmit={handleAsk} className="relative mt-8 pt-4 border-t border-[#F1F3F5]">
             <input
               type="text"
               placeholder={selectedCards.length > 0 ? "向选中的知识卡提问..." : "请先勾选知识卡..."}
               disabled={selectedCards.length === 0}
               className="w-full pl-5 pr-14 py-4 text-[14px] border border-[#EAEAEA] rounded-xl bg-[#F8F9FA] focus:outline-none focus:border-[#ADB5BD] focus:bg-[#FFFFFF] transition-all disabled:bg-[#F1F3F5] disabled:text-[#ADB5BD] disabled:cursor-not-allowed"
               value={question}
               onChange={(e) => setQuestion(e.target.value)}
             />
             <button
               type="submit"
               disabled={selectedCards.length === 0 || !question}
               className="absolute right-3 top-1/2 -translate-y-1/2 mt-2 w-8 h-8 bg-[#1A1A1A] text-[#FFFFFF] rounded-lg flex items-center justify-center disabled:bg-[#E9ECEF] disabled:text-[#ADB5BD] transition-colors"
             >
               <ArrowRight size={16} />
             </button>
           </form>
        </div>
      </div>
    </div>
  );
}
