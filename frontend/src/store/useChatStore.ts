import { create } from 'zustand'
import { askAssistant } from '../api/contract'
import { useGraphStore } from './useGraphStore'
import { useSolidStore } from './useSolidStore'

export interface ChatMessage { id: number; role: 'user' | 'assistant'; text: string }

/** Lấy tối đa 8 tin gần nhất và không quá 4000 ký tự, bỏ câu hỏi hiện tại nằm cuối. */
function recentHistory(msgs: ChatMessage[], current: string) {
  const m = msgs.length && msgs[msgs.length - 1].role === 'user' && msgs[msgs.length - 1].text === current ? msgs.slice(0, -1) : msgs
  const out: { role: 'user' | 'assistant'; text: string }[] = []
  let used = 0
  for (const x of m.slice(-8).reverse()) { used += x.text.length; if (used > 4000) break; out.unshift({ role: x.role, text: x.text }) }
  return out
}
type Status = 'idle' | 'loading' | 'error'

interface ChatState {
  messages: ChatMessage[]
  status: Status
  /** Câu hỏi đang chờ hoặc vừa lỗi, để thử lại mà không thêm tin nhắn trùng. */
  lastQuestion: string | null
  send: (text: string) => Promise<void>
  retry: () => Promise<void>
  clear: () => void
}

let nextId = 1
let epoch = 0 // tăng khi xoá cuộc trò chuyện để bỏ qua câu trả lời đến muộn

export const useChatStore = create<ChatState>((set, get) => {
  const run = async (text: string) => {
    const mine = epoch
    set({ status: 'loading', lastQuestion: text })
    try {
      const graph = useGraphStore.getState().exprs.map((e) => e.trim()).filter(Boolean)
      const reply = await askAssistant(text, { graph, solid: useSolidStore.getState().kind, history: recentHistory(useChatStore.getState().messages, text) })
      if (mine !== epoch) return
      set((s) => ({ messages: [...s.messages, { id: nextId++, role: 'assistant', text: reply }], status: 'idle', lastQuestion: null }))
    } catch {
      if (mine === epoch) set({ status: 'error' })
    }
  }
  return {
    messages: [],
    status: 'idle',
    lastQuestion: null,
    send: async (text) => {
      const q = text.trim()
      if (!q || get().status === 'loading') return
      set((s) => ({ messages: [...s.messages, { id: nextId++, role: 'user', text: q }] }))
      await run(q)
    },
    retry: async () => {
      const q = get().lastQuestion
      if (q && get().status !== 'loading') await run(q)
    },
    clear: () => { epoch++; set({ messages: [], status: 'idle', lastQuestion: null }) },
  }
})
