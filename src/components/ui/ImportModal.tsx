import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

import { folderSchema, importLinkSchema } from '../../forms/schemas';
import { useCreateFolderMutation, useFoldersQuery } from '../../queries/folders';
import { useCreateImportTaskMutation } from '../../queries/imports';
import { getImportTaskFailureMessage } from '../../lib/errors';
import { useUiStore } from '../../stores/uiStore';
import { TextField } from '../forms/TextField';
import { Button } from './Button';

interface ImportModalProps {
  initialFolderId?: string;
  initialUrl?: string;
  onClose: () => void;
  onSubmitImport?: (input: { folderId: string; url: string }) => Promise<void>;
  submitLabel?: string;
  title?: string;
}

export function ImportModal({
  initialFolderId = 'uncategorized',
  initialUrl = '',
  onClose,
  onSubmitImport,
  submitLabel = '确认导入',
  title = '导入新内容',
}: ImportModalProps) {
  const [url, setUrl] = useState(initialUrl);
  const [folderId, setFolderId] = useState(initialFolderId);
  const [formError, setFormError] = useState('');
  const [isCustomSubmitting, setIsCustomSubmitting] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderError, setFolderError] = useState('');
  const foldersQuery = useFoldersQuery();
  const createImportTaskMutation = useCreateImportTaskMutation();
  const createFolderMutation = useCreateFolderMutation();
  const showToast = useUiStore((state) => state.showToast);
  const isMountedRef = useRef(true);

  const folders = foldersQuery.data ?? [];
  const isSubmitting = createImportTaskMutation.isPending || isCustomSubmitting;
  const isSavingFolder = createFolderMutation.isPending;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const parsed = importLinkSchema.safeParse({ url, folderId });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? '请检查导入信息');
      return;
    }

    try {
      if (onSubmitImport) {
        if (isMountedRef.current) {
          setIsCustomSubmitting(true);
        }
        await onSubmitImport(parsed.data);
      } else {
        const task = await createImportTaskMutation.mutateAsync(parsed.data);

        if (task.status === 'failed') {
          if (isMountedRef.current) {
            setFormError(getImportTaskFailureMessage(task));
          }
          return;
        }
      }

      showToast('任务创建成功，请前往首页查看任务进度');
      if (isMountedRef.current) {
        onClose();
      }
    } catch {
      if (isMountedRef.current) {
        setFormError('导入任务创建失败，请稍后重试。');
      }
    } finally {
      if (isMountedRef.current) {
        setIsCustomSubmitting(false);
      }
    }
  };

  const handleCreateFolder = async () => {
    setFolderError('');

    const parsed = folderSchema.safeParse({ name: newFolderName });

    if (!parsed.success) {
      setFolderError(parsed.error.issues[0]?.message ?? '请检查文件夹名称');
      return;
    }

    try {
      const folder = await createFolderMutation.mutateAsync(parsed.data);
      setFolderId(folder.id);
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch {
      setFolderError('文件夹创建失败，请稍后重试。');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A1A]/30 backdrop-blur-[2px] p-4 font-sans">
      <div
        aria-labelledby="import-modal-title"
        aria-modal="true"
        className="w-full max-w-[480px] overflow-hidden rounded-2xl border border-[#EAEAEA] bg-[#FFFFFF] shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-[#F1F3F5] px-6 py-5">
          <h2 className="text-[16px] font-semibold tracking-tight text-[#1A1A1A]" id="import-modal-title">{title}</h2>
          <button
            aria-label="关闭导入弹窗"
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#868E96] transition-colors hover:bg-[#F1F3F5] hover:text-[#1A1A1A]"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <form className="space-y-6 p-6" noValidate onSubmit={handleImport}>
          <TextField
            disabled={isSubmitting}
            id="url"
            label="目标链接"
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            type="url"
            value={url}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-medium text-[#495057]" htmlFor="folder">目标分类</label>
              <button
                className="text-[12px] font-medium text-[#495057] hover:text-[#1A1A1A]"
                onClick={() => setIsCreatingFolder((value) => !value)}
                type="button"
              >
                新建文件夹
              </button>
            </div>
            <select
              className="w-full appearance-none rounded-xl border border-[#EAEAEA] bg-[#F8F9FA] px-4 py-3 text-[14px] text-[#212529] transition-colors focus:border-[#ADB5BD] focus:bg-[#FFFFFF] focus:outline-none"
              disabled={isSubmitting || foldersQuery.isLoading}
              id="folder"
              onChange={(e) => setFolderId(e.target.value)}
              value={folderId}
            >
              <option value="uncategorized">未分类 (存入根目录)</option>
              {folders
                .filter((folder) => folder.id !== 'uncategorized')
                .map((folder) => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
            </select>
          </div>

          {isCreatingFolder && (
            <div className="rounded-xl border border-[#EAEAEA] bg-[#F8F9FA] p-4">
              <div className="mt-2 flex gap-2">
                <TextField
                  className="rounded-lg bg-white px-3 py-2"
                  disabled={isSavingFolder}
                  error={folderError}
                  id="new-folder-name"
                  label="新文件夹名称"
                  onChange={(e) => setNewFolderName(e.target.value)}
                  value={newFolderName}
                  wrapperClassName="min-w-0 flex-1"
                />
                <Button loading={isSavingFolder} onClick={handleCreateFolder} type="button" variant="secondary">保存文件夹</Button>
              </div>
            </div>
          )}

          {formError && <p className="rounded-lg bg-[#FFF5F5] px-3 py-2 text-[13px] text-[#C92A2A]">{formError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button onClick={onClose} type="button" variant="secondary">取消</Button>
            <Button loading={isSubmitting} type="submit" variant="primary">{submitLabel}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
