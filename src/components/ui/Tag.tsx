import { X } from 'lucide-react';

import { cn } from '../../lib/utils';

interface TagProps {
  children: string;
  onRemove?: () => void;
  className?: string;
}

export function Tag({ children, className, onRemove }: TagProps) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1 rounded-md bg-[#E9ECEF] px-2.5 py-1 text-[12px] text-[#495057]', className)}>
      <span className="truncate">{children}</span>
      {onRemove && (
        <button aria-label={`移除 ${children}`} className="text-[#868E96] hover:text-[#1A1A1A]" onClick={onRemove} type="button">
          <X size={12} />
        </button>
      )}
    </span>
  );
}
