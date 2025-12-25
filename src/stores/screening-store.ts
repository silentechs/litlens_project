import { create } from 'zustand';
import type { ScreeningDecision, ScreeningPhase } from '@/types/screening';

/**
 * Screening Store - UI state only
 * Server state (studies, decisions) is managed by TanStack Query
 */

interface ScreeningUIState {
  // Current item index in the queue
  currentIndex: number;
  
  // UI mode
  isFocusMode: boolean;
  
  // Current phase
  currentPhase: ScreeningPhase;
  
  // Filter state
  filters: {
    search: string;
    hasAiSuggestion: boolean | undefined;
    aiSuggestion: ScreeningDecision | undefined;
  };
  
  // Decision timing
  decisionStartTime: number | null;
  
  // Actions
  setCurrentIndex: (index: number) => void;
  next: () => void;
  previous: () => void;
  toggleFocusMode: () => void;
  setCurrentPhase: (phase: ScreeningPhase) => void;
  setFilters: (filters: Partial<ScreeningUIState['filters']>) => void;
  resetFilters: () => void;
  startDecisionTimer: () => void;
  getDecisionTime: () => number | null;
}

const DEFAULT_FILTERS = {
  search: '',
  hasAiSuggestion: undefined,
  aiSuggestion: undefined,
};

export const useScreeningStore = create<ScreeningUIState>((set, get) => ({
  currentIndex: 0,
  isFocusMode: false,
  currentPhase: 'TITLE_ABSTRACT',
  filters: DEFAULT_FILTERS,
  decisionStartTime: null,

  setCurrentIndex: (index) => set({ 
    currentIndex: index,
    decisionStartTime: Date.now(), // Reset timer on navigation
  }),

  next: () => set((state) => ({ 
    currentIndex: state.currentIndex + 1,
    decisionStartTime: Date.now(),
  })),

  previous: () => set((state) => ({ 
    currentIndex: Math.max(0, state.currentIndex - 1),
    decisionStartTime: Date.now(),
  })),

  toggleFocusMode: () => set((state) => ({ 
    isFocusMode: !state.isFocusMode 
  })),

  setCurrentPhase: (phase) => set({ 
    currentPhase: phase,
    currentIndex: 0,
    decisionStartTime: Date.now(),
  }),

  setFilters: (filters) => set((state) => ({
    filters: { ...state.filters, ...filters },
    currentIndex: 0,
  })),

  resetFilters: () => set({ 
    filters: DEFAULT_FILTERS,
    currentIndex: 0,
  }),

  startDecisionTimer: () => set({ 
    decisionStartTime: Date.now() 
  }),

  getDecisionTime: () => {
    const { decisionStartTime } = get();
    if (!decisionStartTime) return null;
    return Date.now() - decisionStartTime;
  },
}));

// Selector hooks for common patterns
export const useCurrentIndex = () => useScreeningStore((state) => state.currentIndex);
export const useIsFocusMode = () => useScreeningStore((state) => state.isFocusMode);
export const useCurrentPhase = () => useScreeningStore((state) => state.currentPhase);
export const useScreeningFilters = () => useScreeningStore((state) => state.filters);
