import { FileText } from 'lucide-react';

import { cn } from '../../lib/utils';
import type { KnowledgeCard } from '../../types';
import { StatusBadge } from '../ui/StatusBadge';
import { Tag } from '../ui/Tag';

interface KnowledgeCardItemProps {
  card: KnowledgeCard;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

export function KnowledgeCardItem({ card, compact = false, onClick, selected }: KnowledgeCardItemProps) {
  return (
    <button
      className={cn(
        'w-full rounded-xl border p-4 text-left transition-colors',
        selected ? 'border-[#CED4DA] bg-white shadow-sm' : 'border-[#EAEAEA] bg-[#F8F9FA] hover:bg-white',
      )}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start gap-3">
        {compact && (
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F1F3F5] text-[#868E96]">
            <FileText size={16} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-[#1A1A1A]">{card.userTitle || card.title}</h3>
            {card.isBadData && <StatusBadge status="bad-data" />}
            {card.isImportant && !card.isBadData && <StatusBadge status="important" />}
          </div>
          {!compact && <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-[#868E96]">{card.userSummary || card.summary || card.contentPreview}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {card.tags.slice(0, 4).map((tag) => (
              <Tag key={tag.id}>{tag.name}</Tag>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}
