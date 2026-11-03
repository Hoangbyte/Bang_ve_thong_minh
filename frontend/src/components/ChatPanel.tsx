import { Fragment, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import katex from 'katex'
import { RotateCcw, SendHorizontal, Trash2 } from 'lucide-react'
import { useChatStore } from '../store/useChatStore'
import { useGraphStore } from '../store/useGraphStore'

/** Hiển thị văn bản, riêng đoạn $...$ được vẽ thành công thức bằng KaTeX. */
function RichText({ text }: { text: string }) {
  return (
    <span className="whitespace-pre-wrap break-words">
      {text.split(/(\$[^$]+\$)/g).map((part, i) =>
        part.length > 2 && part.startsWith('$') && part.endsWith('$') ? (
          <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(part.slice(1, -1), { throwOnError: false }) }} />
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </span>
  )
}

/** Tab "Trợ lý AI": khung chat có trạng thái đang xử lý, lỗi và thử lại. */
export function ChatPanel() {
  const { t } = useTranslation()
  const { messages, status, send, retry, clear } = useChatStore()
  const exprs = useGraphStore((s) => s.exprs)
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const busy = status === 'loading'

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages, status])

  const submit = (text: string) => {
    if (!text.trim() || busy) return
    setDraft('')
    void send(text)
  }
  const graphText = exprs.map((e) => e.trim()).filter(Boolean).join(';  ')
  const suggestions = [
    ...(graphText ? [{ id: 'graph', text: t('chat.askGraph', { expr: graphText }) }] : []),
    { id: 'solve', text: t('chat.askSolve') },
    { id: 'cone', text: t('chat.askCone') },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="log" aria-live="polite" aria-label={t('chat.log')} className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
        {messages.length === 0 && (
          <div>
            <p className="mb-3 text-sm leading-relaxed text-muted">{t('chat.empty')}</p>
            <div className="flex flex-col items-start gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => submit(s.text)}
                  className="rounded-xl border border-line px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-hover motion-reduce:transition-none"
                >
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${m.role === 'user' ? 'bg-accent text-on-accent' : 'bg-hover text-ink'}`}>
              <RichText text={m.text} />
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start" role="status" aria-label={t('chat.thinking')}>
            <div className="flex gap-1 rounded-2xl bg-hover px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2 w-2 animate-pulse rounded-full bg-muted motion-reduce:animate-none" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        )}
        {status === 'error' && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
            <span className="flex-1" style={{ color: 'var(--danger)' }}>{t('chat.error')}</span>
            <button
              type="button"
              onClick={() => void retry()}
              className="flex h-9 items-center gap-1.5 rounded-lg px-3 font-medium text-ink transition-colors hover:bg-hover motion-reduce:transition-none"
            >
              <RotateCcw size={15} aria-hidden="true" />
              {t('chat.retry')}
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="pt-2">
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="mb-2 flex items-center gap-1.5 text-xs text-muted underline-offset-2 hover:underline"
          >
            <Trash2 size={13} aria-hidden="true" />
            {t('chat.clear')}
          </button>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            rows={2}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // isComposing: đang gõ dấu tiếng Việt (Telex/VNI) thì Enter chỉ để chốt chữ, không gửi
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(draft) }
            }}
            placeholder={t('panel.aiPlaceholder')}
            aria-label={t('panel.aiPlaceholder')}
            className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-line bg-transparent px-3 py-2 text-sm text-ink"
          />
          <button
            type="button"
            onClick={() => submit(draft)}
            disabled={busy || !draft.trim()}
            aria-label={t('panel.send')}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-on-accent disabled:opacity-40"
          >
            <SendHorizontal size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
