import { Calendar, Home, Library, Search, Sparkles } from 'lucide-react';

export const routes = {
  home: '/',
  homeAlias: '/home',
  knowledge: '/knowledge',
  trash: '/knowledge/trash',
  libraryAlias: '/library',
  calendar: '/calendar',
  search: '/search',
  recommendations: '/recommendations',
  hotAlias: '/hot',
  settings: '/settings',
} as const;

export const navItems = [
  { name: '首页', path: routes.home, icon: Home, hasChildren: false },
  { name: '知识库', path: routes.knowledge, icon: Library, hasChildren: true },
  { name: '日历', path: routes.calendar, icon: Calendar, hasChildren: false },
  { name: '搜索', path: routes.search, icon: Search, hasChildren: false },
  { name: '文章推荐', path: routes.recommendations, icon: Sparkles, hasChildren: false },
] as const;
