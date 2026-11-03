import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark'
export type GridKind = 'none' | 'square' | 'dots' | 'oxy'
export type PanelTab = 'ai' | 'graph' | 'solid' | 'props'
export const GRID_ORDER: GridKind[] = ['none', 'square', 'dots', 'oxy']

interface UiState {
  theme: Theme
  grid: GridKind
  panelOpen: boolean
  tab: PanelTab
  /** Công tắc "AI làm đẹp nét vẽ". Giai đoạn 2 sẽ đọc giá trị này để quyết định có snap hình hay không. */
  aiBeautify: boolean
  /** Khi nắn đa giác: tự gắn nhãn đỉnh A, B, C... */
  labelVertices: boolean
  /** Khi nắn đa giác: vẽ ký hiệu góc vuông. */
  rightAngles: boolean
  toggleTheme: () => void
  cycleGrid: () => void
  togglePanel: () => void
  setTab: (tab: PanelTab) => void
  toggleAi: () => void
  toggleLabelVertices: () => void
  toggleRightAngles: () => void
}

const prefersDark =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches

// Lưu cục bộ (localStorage) các tuỳ chọn giao diện; nội dung bảng do tldraw tự lưu bằng persistenceKey.
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: prefersDark ? 'dark' : 'light',
      grid: 'square',
      panelOpen: false,
      tab: 'ai',
      aiBeautify: true,
      labelVertices: true,
      rightAngles: true,
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      cycleGrid: () =>
        set((s) => ({ grid: GRID_ORDER[(GRID_ORDER.indexOf(s.grid) + 1) % GRID_ORDER.length] })),
      togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
      setTab: (tab) => set({ tab }),
      toggleAi: () => set((s) => ({ aiBeautify: !s.aiBeautify })),
      toggleLabelVertices: () => set((s) => ({ labelVertices: !s.labelVertices })),
      toggleRightAngles: () => set((s) => ({ rightAngles: !s.rightAngles })),
    }),
    { name: 'btm-ui' }
  )
)
