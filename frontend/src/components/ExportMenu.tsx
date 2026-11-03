import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Editor } from 'tldraw'
import { Download, FileImage, FileText, FileType2 } from 'lucide-react'
import { useEditorStore } from '../store/useEditorStore'
import { IconButton } from './ui'

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done' } | { kind: 'error'; code: 'empty' | 'failed' }
type ImageOpts = NonNullable<Parameters<Editor['toImage']>[1]>
// darkMode: false để ảnh xuất ra luôn nền sáng, dễ in và gửi cho học sinh
const IMAGE_OPTS = { scale: 2, background: true, padding: 32, darkMode: false } as unknown as ImageOpts

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })

class EmptyPage extends Error {}

async function exportCurrentPage(editor: Editor, format: 'png' | 'svg') {
  const ids = [...editor.getCurrentPageShapeIds()]
  if (!ids.length) throw new EmptyPage()
  const { blob } = await editor.toImage(ids, { format, ...IMAGE_OPTS })
  download(blob, `bang-thong-minh.${format}`)
}

/** PDF nhiều trang: mỗi trang của bảng thành một trang PDF (tạm chuyển qua từng trang rồi quay về trang cũ). */
async function exportPdf(editor: Editor) {
  const { jsPDF } = await import('jspdf') // chỉ tải khi cần
  const original = editor.getCurrentPageId()
  let pdf: InstanceType<typeof jsPDF> | null = null
  try {
    for (const page of editor.getPages()) {
      editor.setCurrentPage(page.id)
      const ids = [...editor.getCurrentPageShapeIds()]
      if (!ids.length) continue
      const { blob, width, height } = await editor.toImage(ids, { format: 'png', ...IMAGE_OPTS })
      const url = await blobToDataUrl(blob)
      const orientation = width >= height ? 'l' : 'p'
      if (!pdf) pdf = new jsPDF({ orientation, unit: 'px', format: [width, height] })
      else pdf.addPage([width, height], orientation)
      pdf.addImage(url, 'PNG', 0, 0, width, height)
    }
  } finally {
    editor.setCurrentPage(original)
  }
  if (!pdf) throw new EmptyPage()
  pdf.save('bang-thong-minh.pdf')
}

/** Nút "Xuất" ở góc trên: PNG và SVG của trang hiện tại, PDF của tất cả các trang. */
export function ExportMenu() {
  const { t } = useTranslation()
  const editor = useEditorStore((s) => s.editor)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  const run = async (job: (e: Editor) => Promise<void>) => {
    if (!editor || status.kind === 'busy') return
    setStatus({ kind: 'busy' })
    try {
      await job(editor)
      setStatus({ kind: 'done' })
    } catch (e) {
      setStatus({ kind: 'error', code: e instanceof EmptyPage ? 'empty' : 'failed' })
    }
  }

  const items = [
    { id: 'png', icon: FileImage, label: t('export.png'), job: (e: Editor) => exportCurrentPage(e, 'png') },
    { id: 'svg', icon: FileType2, label: t('export.svg'), job: (e: Editor) => exportCurrentPage(e, 'svg') },
    { id: 'pdf', icon: FileText, label: t('export.pdf'), job: exportPdf },
  ]
  const message =
    status.kind === 'busy' ? t('export.busy')
    : status.kind === 'done' ? t('export.done')
    : status.kind === 'error' ? t(`export.${status.code}`)
    : ''

  return (
    <div ref={root} className="relative">
      <IconButton icon={Download} label={t('export.label')} active={open} onClick={() => { setOpen((o) => !o); setStatus({ kind: 'idle' }) }} />
      {open && (
        <div role="menu" aria-label={t('export.label')} className="absolute right-0 top-full z-10 mt-2 w-64 rounded-2xl border border-line bg-surface p-1 shadow-ui">
          {items.map(({ id, icon: Icon, label, job }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              disabled={status.kind === 'busy'}
              onClick={() => void run(job)}
              className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-ink transition-colors hover:bg-hover disabled:opacity-50 motion-reduce:transition-none"
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </button>
          ))}
          <p role="status" className="min-h-[1.5rem] px-3 py-1 text-xs" style={{ color: status.kind === 'error' ? 'var(--danger)' : 'var(--muted)' }}>{message}</p>
        </div>
      )}
    </div>
  )
}
