import React from 'react';
import { mockStats, mockTasks, generateHeatmapData } from '../mock/data';
import { format } from 'date-fns';

export function Home() {
  const heatmapData = React.useMemo(() => generateHeatmapData(), []);

  return (
    <div className="h-full overflow-y-auto bg-[#FFFFFF]">
      <div className="max-w-[900px] mx-auto px-12 py-16">
        <header className="mb-12">
          <h1 className="text-[32px] font-semibold text-[#1A1A1A] tracking-tight mb-2">数据看板</h1>
          <p className="text-[#868E96] text-[14px]">你的知识库数据概览与近期活动。</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
            {[
              { label: '总计文章', value: mockStats.totalCards, desc: '已索引' },
              { label: '总计字数', value: Math.round(mockStats.totalWords / 1000) + 'k', desc: '系统内' },
              { label: '文件夹数', value: mockStats.totalFolders, desc: '活跃的知识节点' },
              { label: '本周导入', value: mockStats.weeklyImports, desc: '较上周同期 +12' },
            ].map((stat, i) => (
              <div key={i} className="p-6 rounded-2xl bg-[#F8F9FA] border border-[#EAEAEA]">
                 <p className="text-[12px] font-medium text-[#868E96] uppercase tracking-wider mb-2">{stat.label}</p>
                 <p className="text-[32px] font-semibold text-[#1A1A1A] mb-1">{stat.value}</p>
                 <p className="text-[12px] text-[#868E96]">{stat.desc}</p>
              </div>
            ))}
        </div>

        <div className="mb-12">
          <h2 className="text-[16px] font-semibold text-[#1A1A1A] mb-6">知识活跃度</h2>
          <div className="p-8 rounded-2xl border border-[#EAEAEA] bg-[#F8F9FA]">
             <div className="flex flex-wrap gap-[6px]">
               {heatmapData.map((day, i) => {
                 let color = 'bg-[#E9ECEF]';
                 if (day.count > 0) color = 'bg-[#CED4DA]';
                 if (day.count > 2) color = 'bg-[#868E96]';
                 if (day.count > 4) color = 'bg-[#495057]';

                 return (
                   <div
                     key={i}
                     className={`w-[14px] h-[14px] rounded-sm ${color} transition-colors`}
                     title={`${day.count} 导入于 ${day.date}`}
                   />
                 );
               })}
             </div>
             <div className="flex items-center justify-end text-[12px] text-[#868E96] mt-6 gap-2">
               <span>少</span>
               <div className="flex gap-[4px]">
                 <div className="w-[12px] h-[12px] rounded-[2px] bg-[#E9ECEF]" />
                 <div className="w-[12px] h-[12px] rounded-[2px] bg-[#CED4DA]" />
                 <div className="w-[12px] h-[12px] rounded-[2px] bg-[#868E96]" />
                 <div className="w-[12px] h-[12px] rounded-[2px] bg-[#495057]" />
               </div>
               <span>多</span>
             </div>
          </div>
        </div>

        <div>
           <h2 className="text-[16px] font-semibold text-[#1A1A1A] mb-6">最新导入记录</h2>
           <div className="space-y-3">
              {mockTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-4 rounded-xl border border-[#EAEAEA] hover:bg-[#F8F9FA] transition-colors">
                  <div className="flex items-center gap-4 truncate">
                    {task.status === 'success' && <span className="text-[12px] text-[#495057] font-medium bg-[#E9ECEF] px-2 py-1 rounded">完成</span>}
                    {task.status === 'importing' && <span className="text-[12px] text-[#495057] font-medium bg-[#E9ECEF] px-2 py-1 rounded">导入中</span>}
                    {task.status === 'error' && <span className="text-[12px] text-[#C92A2A] font-medium bg-[#FFF5F5] px-2 py-1 rounded">失败</span>}
                    <span className="text-[14px] text-[#212529] truncate">{task.url}</span>
                  </div>
                  <span className="text-[13px] text-[#868E96] shrink-0 ml-4 font-mono">{format(new Date(task.createdAt), 'MM/dd HH:mm')}</span>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}
