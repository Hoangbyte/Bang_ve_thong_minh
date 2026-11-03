import { useEffect, useRef, useState, type ElementType } from 'react'
import { useTranslation } from 'react-i18next'
import 'mathlive' // đăng ký thẻ <math-field>, tự hiện bàn phím toán trên màn hình cảm ứng
import { PencilLine, Wand2 } from 'lucide-react'
import { recognizeMath } from '../api/contract'
import { analyse } from '../graph/model'
import { API_URL } from '../api/http'
import { useEditorStore } from '../store/useEditorStore'

type MathFieldEl = HTMLElement & { value: string }
// Dùng ElementType để khỏi phải khai báo JSX cho thẻ tùy biến
const MathField = 'math-field' as unknown as ElementType

/**
 * Soạn công thức bằng MathLive; "Đọc chữ viết tay" gọi recognizeMath (hiện là mock) và đổ kết quả vào ô
 * để người dùng kiểm tra, sửa rồi mới vẽ. Công thức hợp lệ được đưa lên qua onDraw (dạng LaTeX).
 */
export function FormulaEditor({ onDraw }: { onDraw: (latex: string) => void }) {
  const { t } = useTranslation()
  const ref = useRef<MathFieldEl>(null)
  const editor = useEditorStore((s) => s.editor)
  const [latex, setLatex] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [consent, setConsent] = useState(!API_URL) // có back end thì cần người dùng đồng ý gửi ảnh nét viết

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const on = () => setLatex(el.value)
    el.addEventListener('input', on)
    return () => el.removeEventListener('input', on)
  }, [])

  const read = async () => {
    setBusy(true)
    setNote('')
    const slow = API_URL ? setTimeout(() => setNote(t('graph.mathWarm')), 3000) : 0
    try {
      // Ảnh các nét viết đang chọn trên bảng (nền sáng cho dễ đọc)
      let image: Blob | null = null
      const ids = editor ? [...editor.getSelectedShapeIds()] : []
      if (editor && ids.length) {
        const bnd = editor.getSelectionPageBounds()
        const scale = bnd ? Math.min(1, 1024 / Math.max(bnd.w, bnd.h)) : 1 // thu nhỏ: cạnh dài tối đa ~1024 px
        image = (await editor.toImage(ids, { format: 'png', scale, background: true, padding: 16, darkMode: false } as never)).blob
      }
      if (API_URL && !image) { setNote(t('graph.mathSelect')); return }
      const r = await recognizeMath(image)
      if (ref.current) ref.current.value = r.latex
      setLatex(r.latex)
      setNote(t('graph.mathChecked', { p: Math.round(r.confidence * 100) }))
    } catch {
      setNote(t('graph.mathFail'))
    } finally {
      clearTimeout(slow)
      setBusy(false)
    }
  }

  const m = latex.trim() ? analyse(latex) : null
  const error = m && !m.ok && m.error !== 'empty' ? t(`graph.errors.${m.error}`) : null
  const btn = 'flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-40 motion-reduce:transition-none'

  return (
    <section aria-labelledby="g-math">
      <h2 id="g-math" className="mb-1.5 text-sm font-semibold text-ink">{t('graph.mathTitle')}</h2>
      <MathField ref={ref} aria-label={t('graph.mathTitle')} style={{ display: 'block', fontSize: '1.15rem', padding: '6px 10px', borderRadius: 12, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink)' }} />
      <div role="status" className="min-h-[1.5rem] py-1 text-xs" style={{ color: error ? 'var(--danger)' : 'var(--muted)' }}>{error ?? note}</div>
      <div className="flex gap-2">
        <button type="button" disabled={busy || !consent} onClick={() => void read()} className={`${btn} border border-line text-ink`}>
          <Wand2 size={18} aria-hidden="true" />{t('graph.mathRead')}
        </button>
        <button type="button" disabled={!m || !m.ok} onClick={() => onDraw(latex)} className={`${btn} bg-accent text-on-accent`}>
          <PencilLine size={18} aria-hidden="true" />{t('graph.mathDraw')}
        </button>
      </div>
      {API_URL && (
        <label className="mt-2 flex items-start gap-2 text-xs text-muted">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          {t('graph.privacy')}
        </label>
      )}
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{t('graph.mathHint')}</p>
    </section>
  )
}
