import { useSyncExternalStore } from 'react'
import { api, ApiError, OfflineError, type SyncChange } from '@/api/client'
import type { SyncPullResponse } from '@/api/types'
import { db, getMeta, resetKitchenData, setMeta, syncedTables } from './database'
import i18n from '@/i18n'

type SyncState = {
  running: boolean
  lastError: string | null
  rejected: number
}

let state: SyncState = { running: false, lastError: null, rejected: 0 }
const listeners = new Set<() => void>()

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function useSyncState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

let onUnauthorized: () => void = () => {}

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

let timer: ReturnType<typeof setTimeout> | undefined
let again = false

export function requestSync(delayMs = 800) {
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delayMs)
}

export async function syncNow() {
  if (state.running) {
    again = true
    return
  }
  if (!navigator.onLine) return

  setState({ running: true })
  try {
    await uploadPhotos()
    await pushOutbox()
    await pull()
    await setMeta({ key: 'lastSyncAt', value: new Date().toISOString() })
    setState({ lastError: null })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      onUnauthorized()
    } else if (!(error instanceof OfflineError)) {
      setState({ lastError: error instanceof Error ? error.message : i18n.t('sync.failedGeneric') })
    }
  } finally {
    setState({ running: false })
    if (again) {
      again = false
      requestSync(100)
    }
  }
}

export async function syncFully() {
  while (state.running) await new Promise((resolve) => setTimeout(resolve, 100))
  await syncNow()
}

async function uploadPhotos() {
  const pending = await db.photos.where('uploaded').equals(0).toArray()
  for (const photo of pending) {
    await api.uploadPhoto(photo.id, photo.blob)
    await db.photos.update(photo.id, { uploaded: 1 })
  }
}

async function pushOutbox() {
  for (;;) {
    const batch = await db.outbox.orderBy('seq').limit(500).toArray()
    if (batch.length === 0) return

    const changes: SyncChange[] = batch.map((entry) => ({
      table: entry.table,
      op: entry.op,
      id: entry.rowId,
      data: entry.op === 'upsert' ? entry.data : undefined,
    }))
    const result = await api.push(changes)
    if (result.rejected.length > 0) {
      console.warn('Modificări respinse de server', result.rejected)
      setState({ rejected: state.rejected + result.rejected.length })
    }
    await db.outbox.bulkDelete(batch.map((entry) => entry.seq!))
  }
}

async function pull() {
  const since = (await getMeta('cursor')) ?? 0
  const response = await api.pull(since)
  const knownKitchen = await getMeta('kitchenId')
  if (knownKitchen && knownKitchen !== response.kitchenId && since > 0) {
    await resetKitchenData(response.kitchenId)
    await applyPull(await api.pull(0))
    return
  }
  await applyPull(response)
}

export async function applyPull(response: SyncPullResponse) {
  const tables = [...syncedTables.map((t) => db.table(t)), db.users, db.outbox, db.meta]
  await db.transaction('rw', tables, async () => {
    const pending = new Set((await db.outbox.toArray()).map((e) => `${e.table}:${e.rowId}`))
    for (const table of syncedTables) {
      const rows = (response[table] ?? []) as { id: string }[]
      const fresh = rows.filter((row) => !pending.has(`${table}:${row.id}`))
      if (fresh.length > 0) await db.table(table).bulkPut(fresh)
    }
    await db.users.bulkPut(response.users)
    await setMeta({ key: 'cursor', value: response.cursor })
    await setMeta({ key: 'kitchenId', value: response.kitchenId })
  })
}

let backgroundStarted = false

export function startBackgroundSync() {
  void syncNow()
  if (backgroundStarted) return
  backgroundStarted = true
  window.addEventListener('online', () => void syncNow())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow()
  }, 60_000)
}

