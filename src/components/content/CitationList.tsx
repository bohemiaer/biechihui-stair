import type { CitationSource } from '../../types';

interface CitationListProps {
  citations: CitationSource[];
  onOpenCard?: (cardId: string) => void;
}

export function CitationList({ citations, onOpenCard }: CitationListProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {citations.map((citation) => (
        <button
          className="max-w-[220px] truncate rounded-md border border-[#EAEAEA] bg-[#F8F9FA] px-2.5 py-1.5 text-[12px] text-[#495057] hover:bg-white"
          key={citation.cardId}
          onClick={() => onOpenCard?.(citation.cardId)}
          type="button"
          title={citation.snippet}
        >
          {citation.title}
        </button>
      ))}
    </div>
  );
}
