import React, { useState } from 'react';
import { X } from 'lucide-react';
import { mockFolders } from '../../mock/data';

interface ImportModalProps {
  onClose: () => void;
}

export function ImportModal({ onClose }: ImportModalProps) {
  const [url, setUrl] = useState('');
  const [folder, setFolder] = useState('');

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A1A]/30 backdrop-blur-[2px] p-4 font-sans">
      <div className="bg-[#FFFFFF] rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-[480px] overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-[#EAEAEA]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#F1F3F5]">
          <h2 className="text-[16px] font-semibold text-[#1A1A1A] tracking-tight">导入新内容</h2>
          <button onClick={onClose} className="text-[#868E96] hover:text-[#1A1A1A] transition-colors w-7 h-7 rounded-full hover:bg-[#F1F3F5] flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleImport} className="p-6 space-y-6">
          <div className="space-y-2">
            <label htmlFor="url" className="text-[13px] font-medium text-[#495057]">目标链接</label>
            <input
              id="url"
              type="url"
              required
              placeholder="https://..."
              className="w-full px-4 py-3 border border-[#EAEAEA] rounded-xl bg-[#F8F9FA] focus:outline-none focus:border-[#ADB5BD] focus:bg-[#FFFFFF] text-[14px] text-[#212529] transition-colors"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="folder" className="text-[13px] font-medium text-[#495057]">目标分类</label>
            <select
              id="folder"
              className="w-full px-4 py-3 border border-[#EAEAEA] rounded-xl bg-[#F8F9FA] focus:outline-none focus:border-[#ADB5BD] focus:bg-[#FFFFFF] text-[14px] text-[#212529] transition-colors appearance-none"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
            >
              <option value="">未分类 (存入根目录)</option>
              {mockFolders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div className="pt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-[14px] font-medium text-[#495057] bg-[#F8F9FA] border border-[#EAEAEA] hover:bg-[#E9ECEF] rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-[14px] font-medium text-[#FFFFFF] bg-[#1A1A1A] hover:bg-[#212529] rounded-xl transition-colors"
            >
              确认导入
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
