import type { ImportTaskStage, ImportTaskStatus } from '../types';

export const importStatusLabel: Record<ImportTaskStatus, string> = {
  pending: '等待中',
  running: '导入中',
  succeeded: '完成',
  failed: '失败',
};

export const importStageMeta: Record<
  ImportTaskStage,
  {
    label: string;
    colorClassName: string;
    recoverable: boolean;
  }
> = {
  waiting: {
    label: '等待队列',
    colorClassName: 'bg-[#F1F3F5] text-[#868E96]',
    recoverable: false,
  },
  fetching: {
    label: '抓取原文',
    colorClassName: 'bg-[#E7F5FF] text-[#1971C2]',
    recoverable: false,
  },
  summarizing: {
    label: '生成摘要',
    colorClassName: 'bg-[#E7F5FF] text-[#1971C2]',
    recoverable: false,
  },
  embedding: {
    label: '写入索引',
    colorClassName: 'bg-[#E7F5FF] text-[#1971C2]',
    recoverable: false,
  },
  saving: {
    label: '保存知识库',
    colorClassName: 'bg-[#E7F5FF] text-[#1971C2]',
    recoverable: false,
  },
  done: {
    label: '已完成',
    colorClassName: 'bg-[#E9ECEF] text-[#495057]',
    recoverable: false,
  },
  failed: {
    label: '失败可重试',
    colorClassName: 'bg-[#FFF5F5] text-[#C92A2A]',
    recoverable: true,
  },
};
