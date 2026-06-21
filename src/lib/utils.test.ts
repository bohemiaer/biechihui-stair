import { describe, expect, it } from 'vitest';

import { dedupeTagsById } from './utils';

describe('utils helpers', () => {
  it('deduplicates tags by id while keeping the first label', () => {
    const tags = dedupeTagsById([
      { id: 'tag-vibe-coding', name: 'Vibe Coding' },
      { id: 'tag-vibe-coding', name: 'vibe-coding' },
      { id: 'tag-ai', name: 'AI' },
    ]);

    expect(tags).toEqual([
      { id: 'tag-vibe-coding', name: 'Vibe Coding' },
      { id: 'tag-ai', name: 'AI' },
    ]);
  });
});
