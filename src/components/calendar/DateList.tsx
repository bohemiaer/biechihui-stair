import { format, isSameDay } from 'date-fns';

import { cn } from '../../lib/utils';
import type { KnowledgeCard } from '../../types';

interface DateListProps {
  days: Date[];
  cards: KnowledgeCard[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function DateList({ cards, days, onSelectDate, selectedDate }: DateListProps) {
  return (
    <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
      {days.map((day) => {
        const isSelected = isSameDay(day, selectedDate);
        const count = cards.filter((card) => isSameDay(new Date(card.createdAt), day)).length;

        return (
          <button
            className={cn(
              'group flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-[14px] font-medium transition-colors',
              isSelected ? 'bg-[#F1F3F5] text-[#1A1A1A]' : 'text-[#868E96] hover:bg-[#F8F9FA] hover:text-[#212529]',
            )}
            key={day.toISOString()}
            onClick={() => onSelectDate(day)}
            type="button"
          >
            <div className="flex items-center gap-3">
              <span className={isSelected ? 'text-[#1A1A1A]' : 'text-[#495057]'}>{format(day, 'MMM dd')}</span>
              <span className="text-[12px] font-normal uppercase opacity-70">{format(day, 'EEE')}</span>
            </div>
            {count > 0 && (
              <span className={cn('rounded px-2 py-0.5 text-[11px]', isSelected ? 'bg-[#DEE2E6] text-[#212529]' : 'bg-[#F1F3F5] text-[#868E96]')}>
                {count} 篇
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
