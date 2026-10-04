import { api } from '@/api/client'
import { syncFully } from './sync'

export async function joinKitchen(token: string, bringMine: boolean) {
  await syncFully()
  const kitchen = await api.acceptInvite(token, bringMine)
  await syncFully()
  return kitchen
}

export async function leaveKitchen() {
  await syncFully()
  const result = await api.leaveKitchen()
  await syncFully()
  return result
}

export async function restoreArchive() {
  const kitchen = await api.restoreArchive()
  await syncFully()
  return kitchen
}

export async function removeMember(memberId: string) {
  return api.removeMember(memberId)
}
