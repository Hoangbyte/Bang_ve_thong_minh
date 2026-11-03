import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getSnapshot, loadSnapshot } from 'tldraw'
import { FolderOpen, Save } from 'lucide-react'
import { useEditorStore } from '../store/useEditorStore'

const APP = 'bang-thong-minh'
const btn = 'flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink hover:bg-hover'

/** Lưu và mở bài giảng bằng file JSON (toàn bộ các trang, kèm công thức đồ thị lưu trong từng hình). */
export function FileMenu() {
  const { t } = useTranslation()
  const editor = useEditorStore((s) => s.editor)
  const input = useRef<HTMLInputElement>(null)

  const save = () => {
    if (!editor) return
    const data = { app: APP, version: 1, snapshot: getSnapshot(editor.store) }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `bai-giang-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const open = async (file: File) => {
    if (!editor) return
    try {
      const data = JSON.parse(await file.text())
      if (data?.app !== APP || typeof data.snapshot !== 'object' || !data.snapshot) throw new Error('format')
      if (!window.confirm(t('file.confirm'))) return
      loadSnapshot(editor.store, data.snapshot)
    } catch {
      window.alert(t('file.error'))
    }
  }
  return (
    <>
      <button type="button" className={btn} aria-label={t('file.save')} title={t('file.save')} onClick={save}><Save size={20} aria-hidden="true" /></button>
      <button type="button" className={btn} aria-label={t('file.open')} title={t('file.open')} onClick={() => input.current?.click()}><FolderOpen size={20} aria-hidden="true" /></button>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void open(f) }} />
    </>
  )
}
