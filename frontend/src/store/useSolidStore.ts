import { create } from 'zustand'
import { DIM_DEFS, SOLID_KINDS, defaultDims, type Dims, type SolidKind } from '../solid/defs'

interface SolidState {
  kind: SolidKind
  /** Kích thước riêng cho từng loại khối, đổi loại khối không mất kích thước đã chỉnh. */
  dims: Record<SolidKind, Dims>
  showHidden: boolean
  setKind: (k: SolidKind) => void
  setDim: (key: string, value: number) => void
  setShowHidden: (v: boolean) => void
}

export const useSolidStore = create<SolidState>((set) => ({
  kind: 'box',
  dims: Object.fromEntries(SOLID_KINDS.map((k) => [k, defaultDims(k)])) as Record<SolidKind, Dims>,
  showHidden: true,
  setKind: (kind) => set({ kind }),
  setDim: (key, value) =>
    set((s) => {
      const def = DIM_DEFS[s.kind].find((d) => d.key === key)
      if (!def) return s
      const v = Math.min(def.max, Math.max(def.min, value))
      return { dims: { ...s.dims, [s.kind]: { ...s.dims[s.kind], [key]: v } } }
    }),
  setShowHidden: (showHidden) => set({ showHidden }),
}))
