import { api, ApiError } from '@/api/client'
import type { MeResponse } from '@/api/types'
import { clearLocalData, db, getMeta, setMeta } from './database'
import { syncNow } from './sync'

export async function currentUser() {
  return getMeta('me')
}

export async function login(email: string, password: string): Promise<MeResponse> {
  const me = await api.login(email, password)
  const previous = await getMeta('me')
  if (previous && previous.id !== me.id) await clearLocalData()
  await setMeta({ key: 'me', value: me })
  await syncNow()
  return me
}

export async function logout() {
  if ((await db.outbox.count()) > 0) await syncNow()
  await api.logout().catch(() => undefined)
  await clearLocalData()
}

export async function verifySession() {
  try {
    const me = await api.me()
    await setMeta({ key: 'me', value: me })
    return true
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return false
    return true
  }
}
