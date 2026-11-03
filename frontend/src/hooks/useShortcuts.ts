import { useEffect } from 'react'
import { useUiStore } from '../store/useUiStore'
import { useEditorStore } from '../store/useEditorStore'

/**
 * Phím tắt giao diện (phím vẽ như V, D, E, H, T, A, Ctrl+Z đã có sẵn trong tldraw):
 *  G = đổi kiểu lưới | Alt+T = sáng/tối | Alt+B = bật/tắt AI làm đẹp | Alt+P = mở/đóng bảng phải
 */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement | null
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
      if (useEditorStore.getState().editor?.getEditingShapeId()) return
      if (ev.ctrlKey || ev.metaKey) return
      const ui = useUiStore.getState()

      if (ev.altKey) {
        const actions: Record<string, () => void> = {
          KeyT: ui.toggleTheme,
          KeyB: ui.toggleAi,
          KeyP: ui.togglePanel,
        }
        const run = actions[ev.code]
        if (run) {
          ev.preventDefault()
          run()
        }
      } else if (!ev.shiftKey && ev.code === 'KeyG') {
        ui.cycleGrid()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
