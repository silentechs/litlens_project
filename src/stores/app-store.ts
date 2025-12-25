import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppMode = 'OPERATIONS' | 'INTELLIGENCE';

interface AppState {
  // App mode
  mode: AppMode;
  
  // Sidebar state
  isSidebarOpen: boolean;
  
  // Current project context
  currentProjectId: string | null;
  
  // Search state
  globalSearchQuery: string;
  isSearchOpen: boolean;
  
  // Actions
  setMode: (mode: AppMode) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setCurrentProjectId: (id: string | null) => void;
  setGlobalSearchQuery: (query: string) => void;
  setSearchOpen: (open: boolean) => void;
  toggleSearch: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      mode: 'OPERATIONS',
      isSidebarOpen: true,
      currentProjectId: null, // No default - will be set by user
      globalSearchQuery: '',
      isSearchOpen: false,

      setMode: (mode) => set({ mode }),
      
      toggleSidebar: () => set((state) => ({ 
        isSidebarOpen: !state.isSidebarOpen 
      })),
      
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      
      setCurrentProjectId: (id) => set({ currentProjectId: id }),
      
      setGlobalSearchQuery: (query) => set({ globalSearchQuery: query }),
      
      setSearchOpen: (open) => set({ isSearchOpen: open }),
      
      toggleSearch: () => set((state) => ({ 
        isSearchOpen: !state.isSearchOpen 
      })),
    }),
    {
      name: 'litlens-app-state',
      partialize: (state) => ({
        mode: state.mode,
        isSidebarOpen: state.isSidebarOpen,
        currentProjectId: state.currentProjectId,
      }),
    }
  )
);

// Selector hooks for common patterns
export const useAppMode = () => useAppStore((state) => state.mode);
export const useIsSidebarOpen = () => useAppStore((state) => state.isSidebarOpen);
export const useCurrentProjectId = () => useAppStore((state) => state.currentProjectId);
export const useGlobalSearch = () => useAppStore((state) => ({
  query: state.globalSearchQuery,
  isOpen: state.isSearchOpen,
  setQuery: state.setGlobalSearchQuery,
  setOpen: state.setSearchOpen,
  toggle: state.toggleSearch,
}));
