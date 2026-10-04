import { api, ApiError } from '@/api/client'
import type { MeResponse } from '@/api/types'
import { clearLocalData, db, getMeta, setMeta } from './database'
import { syncNow } from './sync'

export async function currentUser() {
  return getMeta('me')
}

async function signedIn(me: MeResponse) {
  const previous = await getMeta('me')
  if (previous && previous.id !== me.id) await clearLocalData()
  await setMeta({ key: 'me', value: me })
  await syncNow()
  return me
}

export async function login(email: string, password: string): Promise<MeResponse> {
  return signedIn(await api.login(email, password))
}

export async function register(token: string, email: string, displayName: string, password: string): Promise<MeResponse> {
  return signedIn(await api.register(token, email, displayName, password))
}

export async function confirmAccount(userId: string, token: string): Promise<MeResponse> {
  return signedIn(await api.confirmAccount(userId, token))
}

export async function startDemo(): Promise<MeResponse> {
  return signedIn(await api.startDemo())
}

export async function deleteAccount(password: string | null) {
  await api.deleteAccount(password)
  await clearLocalData()
}

export async function saveMe(me: MeResponse) {
  await setMeta({ key: 'me', value: me })
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
