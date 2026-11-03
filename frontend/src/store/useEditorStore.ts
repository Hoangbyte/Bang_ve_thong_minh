import { create } from 'zustand'
import { useValue, type Editor } from 'tldraw'

// Giữ tham chiếu tới editor của tldraw để các nút giao diện bên ngoài điều khiển được.
export const useEditorStore = create<{ editor: Editor | null; setEditor: (e: Editor | null) => void }>(
  (set) => ({ editor: null, setEditor: (editor) => set({ editor }) })
)

/** Đọc một giá trị phản ứng (reactive) từ editor, tự cập nhật khi giá trị đổi. */
export function useEditorValue<T>(name: string, getter: (e: Editor) => T, fallback: T): T {
  const editor = useEditorStore((s) => s.editor)
  return useValue(name, () => (editor ? getter(editor) : fallback), [editor])
}
