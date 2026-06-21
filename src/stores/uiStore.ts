import { create } from 'zustand';

type ViewMode = 'card' | 'compact';
type LibrarySort = 'createdAt' | 'updatedAt' | 'title' | 'source';

interface UiState {
  isSidebarCollapsed: boolean;
  isKnowledgeOpen: boolean;
  isImportModalOpen: boolean;
  libraryViewMode: ViewMode;
  selectedKnowledgeCardId: string | null;
  libraryTagFilter: string;
  librarySourceFilter: string;
  librarySortBy: LibrarySort;
  toastMessage: string | null;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setKnowledgeOpen: (open: boolean) => void;
  setImportModalOpen: (open: boolean) => void;
  setLibraryViewMode: (mode: ViewMode) => void;
  setSelectedKnowledgeCardId: (id: string | null) => void;
  setLibraryTagFilter: (tag: string) => void;
  setLibrarySourceFilter: (source: string) => void;
  setLibrarySortBy: (sort: LibrarySort) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarCollapsed: false,
  isKnowledgeOpen: true,
  isImportModalOpen: false,
  libraryViewMode: 'card',
  selectedKnowledgeCardId: null,
  libraryTagFilter: 'all',
  librarySourceFilter: 'all',
  librarySortBy: 'updatedAt',
  toastMessage: null,
  setSidebarCollapsed: (isSidebarCollapsed) => set({ isSidebarCollapsed }),
  setKnowledgeOpen: (isKnowledgeOpen) => set({ isKnowledgeOpen }),
  setImportModalOpen: (isImportModalOpen) => set({ isImportModalOpen }),
  setLibraryViewMode: (libraryViewMode) => set({ libraryViewMode }),
  setSelectedKnowledgeCardId: (selectedKnowledgeCardId) => set({ selectedKnowledgeCardId }),
  setLibraryTagFilter: (libraryTagFilter) => set({ libraryTagFilter }),
  setLibrarySourceFilter: (librarySourceFilter) => set({ librarySourceFilter }),
  setLibrarySortBy: (librarySortBy) => set({ librarySortBy }),
  showToast: (toastMessage) => set({ toastMessage }),
  clearToast: () => set({ toastMessage: null }),
}));
