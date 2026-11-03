import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { View } from '../graph/view'

export const MAX_EXPRS = 6

interface GraphState {
  /** Mỗi dòng là một phương trình hoặc bất phương trình; tối đa MAX_EXPRS dòng. */
  exprs: string[]
  /** Giá trị tham số dùng chung cho mọi dòng. */
  params: Record<string, number>
  /** Khung nhìn hiện tại (không lưu: mỗi lần mở lại sẽ tự chọn vừa khung). */
  view: View | null
  /** Bộ biểu thức đã được chọn khung nhìn vừa khung, để không đặt lại khi chuyển tab. */
  fitFor: string | null
  setExpr: (i: number, e: string) => void
  setExprs: (list: string[]) => void
  addExpr: () => void
  removeExpr: (i: number) => void
  setParam: (name: string, value: number) => void
  setView: (v: View) => void
  markFit: (key: string) => void
}

export const useGraphStore = create<GraphState>()(
  persist(
    (set) => ({
      exprs: ['y = x^2 - 4x + 3'],
      params: {},
      view: null,
      fitFor: null,
      setExpr: (i, e) => set((s) => ({ exprs: s.exprs.map((x, k) => (k === i ? e : x)) })),
      setExprs: (exprs) => set({ exprs }),
      addExpr: () => set((s) => (s.exprs.length < MAX_EXPRS ? { exprs: [...s.exprs, ''] } : s)),
      removeExpr: (i) => set((s) => (s.exprs.length > 1 ? { exprs: s.exprs.filter((_, k) => k !== i) } : s)),
      setParam: (name, value) => set((s) => ({ params: { ...s.params, [name]: value } })),
      setView: (view) => set({ view }),
      markFit: (fitFor) => set({ fitFor }),
    }),
    { name: 'btm-graph', partialize: (s) => ({ exprs: s.exprs, params: s.params }) }
  )
)
