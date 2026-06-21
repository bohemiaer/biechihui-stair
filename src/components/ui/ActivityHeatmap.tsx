import type { DailyActivity } from '../../types';

interface ActivityHeatmapProps {
  days: DailyActivity[];
  onDayClick?: (date: string) => void;
}

const colorForCount = (count: number) => {
  if (count >= 8) return 'bg-[#1C7ED6]';
  if (count >= 4) return 'bg-[#339AF0]';
  if (count >= 2) return 'bg-[#74BDFB]';
  if (count >= 1) return 'bg-[#8CCBFF]';
  return 'bg-[#E9ECEF]';
};

export function ActivityHeatmap({ days, onDayClick }: ActivityHeatmapProps) {
  const weekCount = Math.ceil(days.length / 7);

  return (
    <div
      className="grid w-full grid-flow-col grid-rows-7 gap-[4px]"
      data-testid="activity-heatmap"
      style={{ gridTemplateColumns: `repeat(${weekCount}, minmax(0, 1fr))` }}
    >
      {days.map((day) => (
        <button
          aria-label={`查看 ${day.date} 的日历归档`}
          className={`aspect-square min-h-[10px] rounded-[4px] ${colorForCount(day.count)} transition-colors hover:ring-2 hover:ring-[#ADB5BD] hover:ring-offset-1 focus:outline-none focus:ring-2 focus:ring-[#339AF0] focus:ring-offset-1`}
          key={day.date}
          onClick={() => onDayClick?.(day.date)}
          title={`${day.date}：${day.count} 篇，${day.wordCount} 字`}
          type="button"
        />
      ))}
    </div>
  );
}
