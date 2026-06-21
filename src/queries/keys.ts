export const queryKeys = {
  home: {
    summary: ['home', 'summary'] as const,
    activity: ['home', 'activity'] as const,
  },
  folders: {
    all: ['folders'] as const,
  },
  cards: {
    all: ['cards'] as const,
    list: (folderId?: string) => ['cards', 'list', folderId ?? 'all'] as const,
    detail: (id: string) => ['cards', 'detail', id] as const,
  },
  imports: {
    recent: ['imports', 'recent'] as const,
  },
  calendar: {
    days: ['calendar', 'days'] as const,
    report: (date: string) => ['calendar', 'report', date] as const,
  },
  search: {
    results: (query: string) => ['search', query] as const,
    answer: (question: string, cardIds: string[]) => ['answer', question, cardIds] as const,
  },
  hot: {
    articles: ['hot', 'articles'] as const,
  },
};
