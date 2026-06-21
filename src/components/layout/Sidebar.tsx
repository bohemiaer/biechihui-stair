import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Library,
  Settings,
  Plus,
  ChevronDown,
  ChevronRight,
  Folder as FolderIcon,
  MoreHorizontal,
  Pencil,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2
} from 'lucide-react';
import { navItems, routes } from '../../app/routes';
import logoLongUrl from '../../../docs/logo.png';
import { cn } from '../../lib/utils';
import { useUiStore } from '../../stores/uiStore';
import { ConfirmDialog } from '../ui';
import { ImportModal } from '../ui/ImportModal';
import { useCreateFolderMutation, useDeleteFolderMutation, useFoldersQuery, useUpdateFolderMutation } from '../../queries/folders';

export function Sidebar() {
  const isSidebarCollapsed = useUiStore((state) => state.isSidebarCollapsed);
  const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed);
  const isImportModalOpen = useUiStore((state) => state.isImportModalOpen);
  const setImportModalOpen = useUiStore((state) => state.setImportModalOpen);
  const isKnowledgeOpen = useUiStore((state) => state.isKnowledgeOpen);
  const setKnowledgeOpen = useUiStore((state) => state.setKnowledgeOpen);
  const showToast = useUiStore((state) => state.showToast);
  const location = useLocation();
  const navigate = useNavigate();
  const foldersQuery = useFoldersQuery();
  const createFolderMutation = useCreateFolderMutation();
  const updateFolderMutation = useUpdateFolderMutation();
  const deleteFolderMutation = useDeleteFolderMutation();
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [actionsFolderId, setActionsFolderId] = useState<string | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const folders = foldersQuery.data ?? [];

  const isKnowledgeActive = location.pathname.startsWith(routes.knowledge) || location.pathname.startsWith(routes.libraryAlias);
  const searchParams = new URLSearchParams(location.search);
  const currentFolder = searchParams.get('folder');

  const handleCreateFolder = async () => {
    const name = folderName.trim();

    if (!name) return;

    const folder = await createFolderMutation.mutateAsync({ name });
    setFolderName('');
    setIsCreatingFolder(false);
    navigate(`${routes.knowledge}?folder=${folder.id}`);
  };

  const handleRenameFolder = async () => {
    if (!editingFolderId || !editingFolderName.trim()) return;

    await updateFolderMutation.mutateAsync({
      id: editingFolderId,
      input: { name: editingFolderName },
    });
    showToast('已重命名文件夹');
    setEditingFolderId(null);
    setEditingFolderName('');
  };

  const handleDeleteFolder = async () => {
    if (!deletingFolderId) return;

    const result = await deleteFolderMutation.mutateAsync(deletingFolderId);
    showToast(result.movedCardCount > 0 ? `已删除文件夹，${result.movedCardCount} 篇内容移入未分类` : '已删除文件夹');
    setDeletingFolderId(null);
    setActionsFolderId(null);

    if (currentFolder === deletingFolderId) {
      navigate(routes.knowledge);
    }
  };

  return (
    <>
      <aside
        className={cn(
          'h-full flex flex-col bg-[#F8F9FA] border-r border-[#EAEAEA] shrink-0 font-sans transition-[width] duration-200',
          isSidebarCollapsed ? 'w-[5vw] min-w-[56px] max-w-[96px]' : 'w-[264px]',
        )}
      >
        <div className={cn('flex h-[72px] items-center px-4', isSidebarCollapsed ? 'justify-end' : 'justify-between gap-3')}>
          {!isSidebarCollapsed && (
            <img
              alt="Biechihui"
              className="h-10 min-w-0 max-w-[168px] object-contain object-left"
              src={logoLongUrl}
            />
          )}
          <button
            aria-label={isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#868E96] transition-colors hover:bg-[#F1F3F5] hover:text-[#212529]"
            onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
            type="button"
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto pb-4 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            if (item.hasChildren) {
              return (
                <div key={item.name} className="flex flex-col">
                  <button
                    aria-label={item.name}
                    onClick={() => {
                        setKnowledgeOpen(!isKnowledgeOpen);
                        if (!isKnowledgeActive) navigate(item.path);
                    }}
                    title={isSidebarCollapsed ? item.name : undefined}
                    className={cn(
                      'flex items-center justify-between px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all group w-full',
                      isSidebarCollapsed && 'justify-center px-0',
                      isKnowledgeActive
                        ? 'bg-[#E9ECEF] text-[#1A1A1A]'
                        : 'text-[#868E96] hover:bg-[#F1F3F5] hover:text-[#212529]'
                    )}
                    >
                    <div className={cn('flex items-center', !isSidebarCollapsed && 'space-x-3')}>
                      <Icon size={18} strokeWidth={isKnowledgeActive ? 2 : 1.5} className="group-hover:text-[#1A1A1A]" />
                      {!isSidebarCollapsed && <span>{item.name}</span>}
                    </div>
                    {!isSidebarCollapsed && (isKnowledgeOpen ? <ChevronDown size={14} className="text-[#868E96]" /> : <ChevronRight size={14} className="text-[#868E96]" />)}
                  </button>
                  {isKnowledgeOpen && !isSidebarCollapsed && (
                    <div className="mt-1 ml-4 border-l border-[#EAEAEA] pl-2 space-y-1">
                      <button
                        onClick={() => navigate(routes.knowledge)}
                        className={cn(
                           'flex items-center space-x-2 px-3 py-2 w-full text-left rounded-lg text-[13px] transition-colors',
                           isKnowledgeActive && !currentFolder ? 'bg-[#F1F3F5] text-[#1A1A1A] font-medium' : 'text-[#868E96] hover:bg-[#F1F3F5] hover:text-[#212529]'
                        )}
                      >
                        <Library size={14} />
                        <span>全部收藏</span>
                      </button>
                      {folders.map((f) => (
                        <div className="relative" key={f.id}>
                          {editingFolderId === f.id ? (
                            <div className="space-y-2 px-3 py-2">
                              <input
                                autoFocus
                                className="w-full rounded-lg border border-[#EAEAEA] bg-white px-3 py-2 text-[13px] text-[#212529] outline-none focus:border-[#ADB5BD]"
                                onChange={(event) => setEditingFolderName(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') void handleRenameFolder();
                                  if (event.key === 'Escape') setEditingFolderId(null);
                                }}
                                value={editingFolderName}
                              />
                              <div className="flex gap-2">
                                <button
                                  className="rounded-md bg-[#1A1A1A] px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-50"
                                  disabled={!editingFolderName.trim() || updateFolderMutation.isPending}
                                  onClick={() => void handleRenameFolder()}
                                  type="button"
                                >
                                  保存
                                </button>
                                <button
                                  className="rounded-md px-2.5 py-1 text-[12px] font-medium text-[#868E96] hover:bg-[#F1F3F5]"
                                  onClick={() => setEditingFolderId(null)}
                                  type="button"
                                >
                                  取消
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => navigate(`${routes.knowledge}?folder=${f.id}`)}
                              className={cn(
                                 'flex items-center justify-between px-3 py-2 w-full text-left rounded-lg text-[13px] transition-colors group',
                                 currentFolder === f.id ? 'bg-[#F1F3F5] text-[#1A1A1A] font-medium' : 'text-[#868E96] hover:bg-[#F1F3F5] hover:text-[#212529]'
                              )}
                            >
                              <div className="flex min-w-0 items-center space-x-2">
                                <FolderIcon size={14} className="shrink-0" />
                                <span className="truncate">{f.name}</span>
                              </div>
                              {!f.isSystem && (
                                <span
                                  className="rounded p-1 text-[#ADB5BD] opacity-0 transition-opacity hover:bg-[#E9ECEF] group-hover:opacity-100"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setActionsFolderId(actionsFolderId === f.id ? null : f.id);
                                  }}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <MoreHorizontal size={13} />
                                </span>
                              )}
                            </button>
                          )}
                          {actionsFolderId === f.id && !editingFolderId && !f.isSystem && (
                            <div className="absolute right-1 top-9 z-10 w-28 rounded-xl border border-[#EAEAEA] bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
                              <button
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-[#495057] hover:bg-[#F8F9FA]"
                                onClick={() => {
                                  setEditingFolderId(f.id);
                                  setEditingFolderName(f.name);
                                  setActionsFolderId(null);
                                }}
                                type="button"
                              >
                                <Pencil size={12} />
                                重命名
                              </button>
                              <button
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-[#C92A2A] hover:bg-[#FFF5F5]"
                                onClick={() => setDeletingFolderId(f.id)}
                                type="button"
                              >
                                <Trash2 size={12} />
                                删除
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      {isCreatingFolder ? (
                        <div className="space-y-2 px-3 py-2">
                          <input
                            autoFocus
                            className="w-full rounded-lg border border-[#EAEAEA] bg-white px-3 py-2 text-[13px] text-[#212529] outline-none focus:border-[#ADB5BD]"
                            onChange={(event) => setFolderName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') void handleCreateFolder();
                              if (event.key === 'Escape') setIsCreatingFolder(false);
                            }}
                            placeholder="文件夹名称"
                            value={folderName}
                          />
                          <div className="flex gap-2">
                            <button
                              className="rounded-md bg-[#1A1A1A] px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-50"
                              disabled={!folderName.trim() || createFolderMutation.isPending}
                              onClick={() => void handleCreateFolder()}
                              type="button"
                            >
                              创建
                            </button>
                            <button
                              className="rounded-md px-2.5 py-1 text-[12px] font-medium text-[#868E96] hover:bg-[#F1F3F5]"
                              onClick={() => setIsCreatingFolder(false)}
                              type="button"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="flex items-center space-x-2 px-3 py-2 w-full text-left rounded-lg text-[13px] text-[#868E96] hover:bg-[#F1F3F5] hover:text-[#212529] transition-colors mt-1"
                          onClick={() => setIsCreatingFolder(true)}
                          type="button"
                        >
                          <Plus size={14} />
                          <span>新建文件夹</span>
                        </button>
                      )}
                      <button
                        className="flex items-center space-x-2 px-3 py-2 w-full text-left rounded-lg text-[13px] text-[#868E96] hover:bg-[#F1F3F5] hover:text-[#212529] transition-colors"
                        onClick={() => navigate(routes.trash)}
                        type="button"
                      >
                        <Trash2 size={14} />
                        <span>回收站</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            }
            return (
              <NavLink
                aria-label={item.name}
                key={item.name}
                to={item.path}
                title={isSidebarCollapsed ? item.name : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center space-x-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all group',
                    isSidebarCollapsed && 'justify-center space-x-0 px-0',
                    isActive && !item.hasChildren
                      ? 'bg-[#E9ECEF] text-[#1A1A1A]'
                      : 'text-[#868E96] hover:bg-[#F1F3F5] hover:text-[#212529]'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} strokeWidth={isActive ? 2 : 1.5} className="group-hover:text-[#1A1A1A]" />
                    {!isSidebarCollapsed && <span>{item.name}</span>}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className={cn('py-4', isSidebarCollapsed ? 'px-4' : 'px-6')}>
          <button
            onClick={() => setImportModalOpen(true)}
            aria-label="添加新链接"
            className={cn(
              'w-full flex items-center justify-center bg-[#F1F3F5] text-[#212529] hover:bg-[#E9ECEF] border border-[#EAEAEA] transition-colors py-2 rounded-lg text-[14px] font-medium',
              isSidebarCollapsed ? 'px-0' : 'space-x-2 px-4',
            )}
          >
            <Plus size={16} />
            {!isSidebarCollapsed && <span>添加新链接</span>}
          </button>
        </div>

        <div className="p-4 border-t border-[#EAEAEA]">
           <button
             className={cn(
               'flex items-center text-[#868E96] hover:text-[#212529] hover:bg-[#F1F3F5] transition-colors px-3 py-2 rounded-xl w-full text-[14px] font-medium group',
               isSidebarCollapsed ? 'justify-center px-0' : 'space-x-3',
             )}
             onClick={() => navigate(routes.settings)}
             type="button"
           >
             <Settings size={18} strokeWidth={1.5} className="group-hover:text-[#1A1A1A]" />
             {!isSidebarCollapsed && <span>设置</span>}
           </button>
        </div>
      </aside>

      {isImportModalOpen && (
        <ImportModal onClose={() => setImportModalOpen(false)} />
      )}
      {deletingFolderId && (
        <ConfirmDialog
          cancelLabel="取消"
          confirmLabel="删除文件夹"
          description="文件夹删除后，其中的知识卡片会移动到未分类，不会进入回收站。"
          onCancel={() => setDeletingFolderId(null)}
          onConfirm={() => void handleDeleteFolder()}
          title="确认删除这个文件夹？"
        />
      )}
    </>
  );
}
