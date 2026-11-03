import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageRecordType, type TLPage, type TLPageId } from 'tldraw'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEditorStore, useEditorValue } from '../store/useEditorStore'
import { IconButton, barClass } from './ui'

/** Chuyển trang, thêm, đổi tên và xoá trang của bảng (tldraw hỗ trợ nhiều trang sẵn). */
export function PagesMenu() {
  const { t } = useTranslation()
  const editor = useEditorStore((s) => s.editor)
  const pages = useEditorValue<TLPage[]>('pages', (e) => e.getPages(), [])
  const currentId = useEditorValue<TLPageId | ''>('currentPage', (e) => e.getCurrentPageId(), '')
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState<TLPageId | null>(null)
  const [draft, setDraft] = useState('')
  const root = useRef<HTMLDivElement>(null)

  // Trang đầu tiên mặc định tên tiếng Anh: đổi sang tiếng Việt một lần
  useEffect(() => {
    if (editor && pages.length === 1 && /^page 1$/i.test(pages[0].name)) editor.renamePage(pages[0].id, t('pages.defaultName', { n: 1 }))
  }, [editor, pages, t])

  // Đóng menu khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setRenaming(null) } }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  if (!editor || pages.length === 0) return null
  const index = Math.max(0, pages.findIndex((p) => p.id === currentId))
  const current = pages[index]

  const go = (i: number) => { const p = pages[(i + pages.length) % pages.length]; if (p) editor.setCurrentPage(p.id) }
  const add = () => {
    const id = PageRecordType.createId()
    editor.createPage({ id, name: t('pages.defaultName', { n: pages.length + 1 }) })
    editor.setCurrentPage(id)
  }
  const commitRename = () => {
    if (renaming && draft.trim()) editor.renamePage(renaming, draft.trim())
    setRenaming(null)
  }
  const remove = (p: TLPage) => {
    if (pages.length <= 1 || !window.confirm(t('pages.confirmRemove', { name: p.name }))) return
    if (p.id === currentId) editor.setCurrentPage((pages.find((x) => x.id !== p.id) as TLPage).id)
    editor.deletePage(p.id)
  }

  return (
    <div ref={root} className="pointer-events-auto relative">
      <div className={barClass}>
        <IconButton icon={ChevronLeft} label={t('pages.prev')} disabled={pages.length < 2} onClick={() => go(index - 1)} />
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          title={t('pages.menu')}
          onClick={() => setOpen((o) => !o)}
          className="flex h-11 max-w-[11rem] items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-ink transition-colors hover:bg-hover motion-reduce:transition-none"
        >
          <span className="truncate">{current.name}</span>
          <span className="shrink-0 text-xs text-muted tabular-nums">{index + 1}/{pages.length}</span>
          <ChevronDown size={16} aria-hidden="true" className="shrink-0" />
        </button>
        <IconButton icon={ChevronRight} label={t('pages.next')} disabled={pages.length < 2} onClick={() => go(index + 1)} />
        <IconButton icon={Plus} label={t('pages.add')} onClick={add} />
      </div>

      {open && (
        <ul role="listbox" aria-label={t('pages.menu')} className="absolute left-0 top-full z-10 mt-2 max-h-80 w-72 overflow-y-auto rounded-2xl border border-line bg-surface p-1 shadow-ui">
          {pages.map((p) => (
            <li key={p.id} role="option" aria-selected={p.id === currentId} className="flex items-center gap-0.5">
              {renaming === p.id ? (
                <>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) commitRename() }}
                    aria-label={t('pages.rename')}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-transparent px-3 text-sm text-ink"
                  />
                  <IconButton icon={Check} label={t('pages.rename')} onClick={commitRename} />
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { editor.setCurrentPage(p.id); setOpen(false) }}
                    className={`h-11 min-w-0 flex-1 truncate rounded-xl px-3 text-left text-sm transition-colors motion-reduce:transition-none ${p.id === currentId ? 'bg-accent font-medium text-on-accent' : 'text-ink hover:bg-hover'}`}
                  >
                    {p.name}
                  </button>
                  <IconButton icon={Pencil} label={t('pages.rename')} onClick={() => { setRenaming(p.id); setDraft(p.name) }} />
                  <IconButton icon={Trash2} label={t('pages.remove')} disabled={pages.length < 2} onClick={() => remove(p)} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
