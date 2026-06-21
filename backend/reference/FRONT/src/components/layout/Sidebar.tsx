import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Home,
  Library,
  Calendar,
  Sparkles,
  Settings,
  Plus,
  ChevronDown,
  ChevronRight,
  Folder as FolderIcon
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ImportModal } from '../ui/ImportModal';
import { mockFolders } from '../../mock/data';

const navItems = [
  { name: '数据看板', path: '/', icon: Home },
  { name: '知识库', path: '/knowledge', icon: Library, hasChildren: true },
  { name: '日历视图', path: '/calendar', icon: Calendar },
  { name: '模糊搜索', path: '/search', icon: Search },
  { name: '热点推荐', path: '/recommendations', icon: Sparkles },
];

export function Sidebar() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isKnowledgeOpen, setIsKnowledgeOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const isKnowledgeActive = location.pathname.startsWith('/knowledge');
  const searchParams = new URLSearchParams(location.search);
  const currentFolder = searchParams.get('folder');

  return (
    <>
      <aside className="w-[240px] h-full flex flex-col bg-[#F8F9FA] border-r border-[#EAEAEA] shrink-0 font-sans">
        <div className="p-6 pb-4 flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden shrink-0">
             <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="avatar" className="w-full h-full object-cover" />
          </div>
          <span className="text-[14px] font-medium text-[#1A1A1A]">Floyd Lawton</span>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto pb-4 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            if (item.hasChildren) {
              return (
                <div key={item.name} className="flex flex-col">
                  <button
                    onClick={() => {
                        setIsKnowledgeOpen(!isKnowledgeOpen);
                        if (!isKnowledgeActive) navigate(item.path);
                    }}
                    className={cn(
                      'flex items-center justify-between px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all group w-full',
                      isKnowledgeActive
                        ? 'bg-[#E9ECEF] text-[#1A1A1A]'
                        : 'text-[#868E96] hover:bg-[#F1F3F5] hover:text-[#212529]'
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon size={18} strokeWidth={isKnowledgeActive ? 2 : 1.5} className="group-hover:text-[#1A1A1A]" />
                      <span>{item.name}</span>
                    </div>
                    {isKnowledgeOpen ? <ChevronDown size={14} className="text-[#868E96]" /> : <ChevronRight size={14} className="text-[#868E96]" />}
                  </button>
                  {isKnowledgeOpen && (
                    <div className="mt-1 ml-4 border-l border-[#EAEAEA] pl-2 space-y-1">
                      <button
                        onClick={() => navigate('/knowledge')}
                        className={cn(
                           'flex items-center space-x-2 px-3 py-2 w-full text-left rounded-lg text-[13px] transition-colors',
                           isKnowledgeActive && !currentFolder ? 'bg-[#F1F3F5] text-[#1A1A1A] font-medium' : 'text-[#868E96] hover:bg-[#F1F3F5] hover:text-[#212529]'
                        )}
                      >
                        <Library size={14} />
                        <span>全部收藏</span>
                      </button>
                      {mockFolders.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => navigate(`/knowledge?folder=${f.id}`)}
                          className={cn(
                             'flex items-center justify-between px-3 py-2 w-full text-left rounded-lg text-[13px] transition-colors group',
                             currentFolder === f.id ? 'bg-[#F1F3F5] text-[#1A1A1A] font-medium' : 'text-[#868E96] hover:bg-[#F1F3F5] hover:text-[#212529]'
                          )}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <FolderIcon size={14} />
                            <span className="truncate">{f.name}</span>
                          </div>
                          {!['f-1', 'f-2'].includes(f.id) && <span className="opacity-0 group-hover:opacity-100 text-[#ADB5BD]">...</span>}
                        </button>
                      ))}
                      <button className="flex items-center space-x-2 px-3 py-2 w-full text-left rounded-lg text-[13px] text-[#868E96] hover:bg-[#F1F3F5] hover:text-[#212529] transition-colors mt-1">
                        <Plus size={14} />
                        <span>新建文件夹</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            }
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center space-x-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all group',
                    isActive && !item.hasChildren
                      ? 'bg-[#E9ECEF] text-[#1A1A1A]'
                      : 'text-[#868E96] hover:bg-[#F1F3F5] hover:text-[#212529]'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} strokeWidth={isActive ? 2 : 1.5} className="group-hover:text-[#1A1A1A]" />
                    <span>{item.name}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-6 py-4">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="w-full flex items-center justify-center space-x-2 bg-[#F1F3F5] text-[#212529] hover:bg-[#E9ECEF] border border-[#EAEAEA] transition-colors py-2 px-4 rounded-lg text-[14px] font-medium"
          >
            <Plus size={16} />
            <span>添加新链接</span>
          </button>
        </div>

        <div className="p-4 border-t border-[#EAEAEA]">
           <button className="flex items-center space-x-3 text-[#868E96] hover:text-[#212529] hover:bg-[#F1F3F5] transition-colors px-3 py-2 rounded-xl w-full text-[14px] font-medium group">
             <Settings size={18} strokeWidth={1.5} className="group-hover:text-[#1A1A1A]" />
             <span>设置</span>
           </button>
        </div>
      </aside>

      {isImportModalOpen && (
        <ImportModal onClose={() => setIsImportModalOpen(false)} />
      )}
    </>
  );
}
