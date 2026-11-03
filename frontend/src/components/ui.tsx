import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

const base = 'transition-colors disabled:opacity-40 motion-reduce:transition-none'
const state = (active?: boolean) => (active ? 'bg-accent text-on-accent' : 'text-ink hover:bg-hover')

/** Nút icon vuông 44px (đủ lớn cho ngón tay trên tablet). */
export function IconButton(props: {
  icon: LucideIcon
  label: string
  hint?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  const { icon: Icon, label, hint, active, disabled, onClick } = props
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={hint ? `${label} (${hint})` : label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-11 w-11 place-items-center rounded-xl ${base} ${state(active)}`}
    >
      <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
    </button>
  )
}

/** Nút có chữ; trên màn hình hẹp chỉ hiện icon. */
export function ChipButton(props: {
  icon: LucideIcon
  title: string
  active?: boolean
  onClick: () => void
  children?: ReactNode
}) {
  const { icon: Icon, title, active, onClick, children } = props
  return (
    <button
      type="button"
      aria-label={title}
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={`flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium ${base} ${state(active)}`}
    >
      <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
      {children && <span className="hidden lg:inline">{children}</span>}
    </button>
  )
}

export const Divider = () => <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />

export const barClass =
  'pointer-events-auto flex items-center gap-0.5 rounded-2xl border border-line bg-surface p-1 shadow-ui'
