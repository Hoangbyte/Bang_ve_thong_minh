import { Component, type ReactNode } from 'react'
import i18n from 'i18next'

/** Bọc từng panel để một panel lỗi không làm trắng cả bảng vẽ. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="flex flex-col gap-3 p-4 text-sm text-ink">
        <p>{i18n.t('error.panel', 'Khung này gặp lỗi. Bảng vẽ vẫn an toàn.')}</p>
        <button type="button" onClick={() => this.setState({ failed: false })} className="h-11 rounded-xl border border-line font-medium hover:bg-hover">
          {i18n.t('error.retry', 'Thử lại')}
        </button>
      </div>
    )
  }
}
