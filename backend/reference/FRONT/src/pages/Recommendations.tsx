import React from 'react';
import { mockHotArticles } from '../mock/data';
import { Flame, Plus, ExternalLink, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

export function Recommendations() {
  return (
    <div className="h-full overflow-y-auto bg-[#FFFFFF]">
      <div className="max-w-[800px] mx-auto px-12 py-16">
        <header className="mb-12">
          <h1 className="text-[32px] font-semibold tracking-tight text-[#1A1A1A] mb-3 flex items-center gap-3">
            <Flame size={28} className="text-[#868E96]" strokeWidth={1.5} /> 灵感推荐
          </h1>
          <p className="text-[#868E96] text-[14px] font-medium">基于知识库拓扑，为你优选的内容节点。</p>
        </header>

        <div className="flex flex-wrap gap-2 mb-12">
           {['全部分类', 'AI & 数据', '前端开发', 'UX 设计', '思考与沉淀'].map((cat, i) => (
             <button key={cat} className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all ${i === 0 ? 'bg-[#1A1A1A] text-[#FFFFFF]' : 'bg-[#F8F9FA] text-[#868E96] border border-[#EAEAEA] hover:bg-[#E9ECEF] hover:text-[#212529]'}`}>
               {cat}
             </button>
           ))}
        </div>

        <div className="space-y-6">
          {mockHotArticles.map(article => (
            <article key={article.id} className="bg-[#FFFFFF] p-8 rounded-2xl border border-[#EAEAEA] hover:border-[#CED4DA] hover:bg-[#F8F9FA] transition-all group flex flex-col gap-6">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-medium uppercase text-[#495057] bg-[#E9ECEF] px-2 py-0.5 rounded flex items-center gap-1.5">
                    <Sparkles size={12} /> 关联匹配度高
                  </span>
                  <span className="text-[12px] text-[#ADB5BD]">{article.source} • {format(new Date(article.publishedAt), 'MMM d')}</span>
                </div>
                <h3 className="text-[20px] font-medium text-[#1A1A1A] leading-snug group-hover:underline transition-colors decoration-[#EAEAEA] underline-offset-4">
                  <a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a>
                </h3>
                <p className="text-[#868E96] leading-[1.8] text-[14px]">
                  {article.summary}
                </p>
              </div>
              <div className="flex gap-3 pt-4 border-t border-[#F1F3F5]">
                 <button className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#1A1A1A] text-[#FFFFFF] text-[13px] font-medium rounded-lg hover:bg-[#212529] transition-colors">
                   <Plus size={14} /> 加入索引
                 </button>
                 <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#F8F9FA] text-[#495057] text-[13px] font-medium rounded-lg hover:bg-[#E9ECEF] border border-[#EAEAEA] transition-colors">
                   预览原文 <ExternalLink size={12} />
                 </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
