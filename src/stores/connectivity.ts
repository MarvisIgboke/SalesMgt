import { create } from 'zustand'

export type ConnectionStatus = 'online' | 'offline' | 'syncing' | 'sync_complete' | 'sync_failed'

interface ConnectivityState {
  status: ConnectionStatus
  lastSyncedAt: string | null
  offlineQueueCount: number
  setStatus: (status: ConnectionStatus) => void
  setSyncing: () => void
  setSyncComplete: () => void
  setSyncFailed: () => void
  setOfflineQueueCount: (count: number) => void
}

function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  status: isOnline() ? 'online' : 'offline',
  lastSyncedAt: null,
  offlineQueueCount: 0,

  setStatus: (status) => set({ status }),
  setSyncing: () => set({ status: 'syncing' }),
  setSyncComplete: () =>
    set({ status: 'sync_complete', lastSyncedAt: new Date().toISOString() }),
  setSyncFailed: () => set({ status: 'sync_failed' }),
  setOfflineQueueCount: (count) => set({ offlineQueueCount: count }),
}))

export function initConnectivityListeners() {
  const store = useConnectivityStore.getState()
  window.addEventListener('online', () => store.setStatus('online'))
  window.addEventListener('offline', () => store.setStatus('offline'))
}

export function syncStateChanged(count: number) {
  const store = useConnectivityStore.getState()
  store.setOfflineQueueCount(count)
  if (count > 0 && window.navigator.onLine) {
    store.setSyncing()
  }
}