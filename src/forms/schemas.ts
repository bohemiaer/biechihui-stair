import { z } from 'zod';

export const importLinkSchema = z.object({
  url: z.string().trim().url('请输入有效链接'),
  folderId: z.string().min(1, '请选择目标文件夹'),
});

export const folderSchema = z.object({
  name: z.string().trim().min(1, '请输入文件夹名称').max(40, '文件夹名称不能超过 40 个字符'),
});

export const cardEditSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空'),
  summary: z.string().trim().optional(),
  note: z.string().trim().optional(),
  folderId: z.string().min(1, '请选择文件夹'),
  tagNames: z.array(z.string().trim().min(1)).max(12, '标签不能超过 12 个'),
});

export const searchQuestionSchema = z.object({
  question: z.string().trim().min(1, '请输入问题'),
  cardIds: z.array(z.string()).min(1, '请选择至少一张知识卡'),
});

export type ImportLinkFormValues = z.infer<typeof importLinkSchema>;
export type FolderFormValues = z.infer<typeof folderSchema>;
export type CardEditFormValues = z.infer<typeof cardEditSchema>;
export type SearchQuestionFormValues = z.infer<typeof searchQuestionSchema>;
