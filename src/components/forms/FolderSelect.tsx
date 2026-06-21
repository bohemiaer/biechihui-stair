import type { SelectHTMLAttributes } from 'react';

import type { Folder } from '../../types';

interface FolderSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  folders: Folder[];
}

export function FolderSelect({ folders, ...props }: FolderSelectProps) {
  return (
    <select
      className="w-full rounded-xl border border-[#EAEAEA] bg-[#F8F9FA] px-4 py-3 text-[14px] text-[#212529] transition-colors focus:border-[#ADB5BD] focus:bg-white focus:outline-none"
      {...props}
    >
      {folders.map((folder) => (
        <option key={folder.id} value={folder.id}>
          {folder.name}
        </option>
      ))}
    </select>
  );
}
