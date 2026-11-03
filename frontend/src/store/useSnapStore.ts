import { create } from 'zustand'

/** Kết quả của lần làm đẹp gần nhất, để giao diện hiện hiệu ứng, độ tin cậy và nút hoàn tác. */
export interface SnapEvent {
  key: number
  status: 'snapped' | 'kept'
  /** Khoá i18n trong `shapes.*` (chỉ khi status = snapped). */
  shapeKey?: string
  confidence: number
  /** Đường SVG của nét gốc, toạ độ màn hình. */
  ghost?: string
  /** Khung quanh hình mới, toạ độ màn hình. */
  box?: { x: number; y: number; w: number; h: number }
}

export const useSnapStore = create<{ event: SnapEvent | null; setEvent: (e: SnapEvent | null) => void }>((set) => ({
  event: null,
  setEvent: (event) => set({ event }),
}))
