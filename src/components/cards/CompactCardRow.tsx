import type { KnowledgeCard } from '../../types';

interface CompactCardRowProps {
  card: KnowledgeCard;
  onClick?: () => void;
}

export function CompactCardRow({ card, onClick }: CompactCardRowProps) {
  return (
    <button className="flex w-full items-center justify-between gap-4 border-b border-[#F1F3F5] px-2 py-3 text-left hover:bg-[#F8F9FA]" onClick={onClick} type="button">
      <div className="min-w-0">
        <h3 className="truncate text-[14px] font-medium text-[#1A1A1A]">{card.userTitle || card.title}</h3>
        <p className="mt-1 truncate text-[12px] text-[#868E96]">{card.siteName}</p>
      </div>
      <span className="shrink-0 text-[12px] text-[#ADB5BD]">{card.wordCount ?? 0} 字</span>
    </button>
  );
}
