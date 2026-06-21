import { cn } from '../../lib/utils';
import type { HotArticleStatus, ImportTaskStatus } from '../../types';

type Status = ImportTaskStatus | HotArticleStatus | 'important' | 'bad-data';

const statusText: Record<Status, string> = {
  pending: '等待中',
  running: '导入中',
  succeeded: '完成',
  failed: '失败',
  idle: '未导入',
  imported: '已导入',
  important: '重要',
  'bad-data': '坏数据',
};

const statusClassName: Record<Status, string> = {
  pending: 'bg-[#F1F3F5] text-[#868E96]',
  running: 'bg-[#E7F5FF] text-[#1971C2]',
  succeeded: 'bg-[#E9ECEF] text-[#495057]',
  failed: 'bg-[#FFF5F5] text-[#C92A2A]',
  idle: 'bg-[#F1F3F5] text-[#868E96]',
  imported: 'bg-[#E9ECEF] text-[#495057]',
  important: 'bg-[#FFF9DB] text-[#A26B00]',
  'bad-data': 'bg-[#FFF5F5] text-[#C92A2A]',
};

export function StatusBadge({ className, status }: { className?: string; status: Status }) {
  return <span className={cn('inline-flex rounded-md px-2 py-1 text-[12px] font-medium', statusClassName[status], className)}>{statusText[status]}</span>;
}
