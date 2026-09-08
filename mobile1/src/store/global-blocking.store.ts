import { create } from 'zustand'

type GlobalBlockingState = {
  isBlocked: boolean
  title: string | null
  subtitle: string | null
  queuedDeepLink: string | null
  setBlocked: (payload: { title?: string; subtitle?: string } | null) => void
  queueDeepLink: (deepLink: string) => void
  consumeQueuedDeepLink: () => string | null
}

export const useGlobalBlockingStore = create<GlobalBlockingState>((set, get) => ({
  isBlocked: false,
  title: null,
  subtitle: null,
  queuedDeepLink: null,
  setBlocked: (payload) => {
    if (!payload) {
      set({ isBlocked: false, title: null, subtitle: null })
      return
    }
    set({
      isBlocked: true,
      title: payload.title ?? 'Obrada u toku',
      subtitle: payload.subtitle ?? null,
    })
  },
  queueDeepLink: (deepLink) => {
    const { queuedDeepLink } = get()
    if (queuedDeepLink) return
    set({ queuedDeepLink: deepLink })
  },
  consumeQueuedDeepLink: () => {
    const { queuedDeepLink } = get()
    if (!queuedDeepLink) return null
    set({ queuedDeepLink: null })
    return queuedDeepLink
  },
}))

