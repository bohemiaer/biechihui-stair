import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Tag } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function dedupeTagsById<T extends Tag>(tags: T[]) {
  const tagMap = new Map<string, T>();

  tags.forEach((tag) => {
    if (!tagMap.has(tag.id)) {
      tagMap.set(tag.id, tag);
    }
  });

  return Array.from(tagMap.values());
}
