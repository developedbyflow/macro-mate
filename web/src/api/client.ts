import i18n, { currentLanguage } from '@/i18n'
import type {
  AdminUser,
  AiStatus,
  FoodDemand,
  OpenReport,
  PromotedFood,
  BarcodeProduct,
  FoodEnrichRequest,
  FoodEnrichResponse,
  InviteCreated,
  InviteInfo,
  KitchenInfo,
  MealScanResult,
  LeaveResult,
  MeResponse,
  RecipeDraft,
  RecipeGenerateRequest,
  SyncPullResponse,
  SyncPushResponse,
  TableName,
} from './types'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export class OfflineError extends Error {
  constructor() {
    super(i18n.t('errors.offline'))
  }
}

async function request<T>(method: string, url: string, body?: unknown, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
      ...init,
      headers: {
        'Accept-Language': currentLanguage(),
        ...(body === undefined ? undefined : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
    })
  } catch {
    throw new OfflineError()
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null)
    if (!problem && response.status >= 502 && response.status <= 504) throw new ApiError(response.status, i18n.t('errors.serverDown'))
    throw new ApiError(response.status, problem?.detail ?? problem?.title ?? i18n.t('errors.status', { status: response.status }))
  }
  if (response.status === 204 || response.status === 202) return undefined as T
  return (await response.json()) as T
}

export type SyncChange = {
  table: TableName
  op: 'upsert' | 'delete'
  id: string
  data?: unknown
}

export const api = {
  login: (email: string, password: string) => request<MeResponse>('POST', '/api/auth/login', { email, password }),
  logout: () => request<void>('POST', '/api/auth/logout'),
  me: () => request<MeResponse>('GET', '/api/auth/me'),
  forgotPassword: (email: string) => request<void>('POST', '/api/auth/forgot-password', { email }),
  resetPassword: (email: string, token: string, password: string) => request<void>('POST', '/api/auth/reset-password', { email, token, password }),
  confirmEmail: (userId: string, email: string, token: string) => request<MeResponse>('POST', '/api/auth/confirm-email', { userId, email, token }),
  changeName: (displayName: string) => request<MeResponse>('PUT', '/api/auth/me/name', { displayName }),
  changePassword: (currentPassword: string, newPassword: string) => request<void>('POST', '/api/auth/me/password', { currentPassword, newPassword }),
  changeEmail: (newEmail: string, currentPassword: string) => request<void>('POST', '/api/auth/me/email', { newEmail, currentPassword }),
  signUp: (email: string, displayName: string, password: string) => request<void>('POST', '/api/auth/register', { email, displayName, password }),
  confirmAccount: (userId: string, token: string) => request<MeResponse>('POST', '/api/auth/confirm-account', { userId, token }),
  resendConfirmation: (email: string) => request<void>('POST', '/api/auth/resend-confirmation', { email }),
  startDemo: () => request<MeResponse>('POST', '/api/auth/demo'),
  deleteAccount: (password: string | null) => request<void>('POST', '/api/auth/me/delete', { password }),

  reportFood: (foodId: string, message: string) => request<void>('POST', `/api/foods/${foodId}/reports`, { message }),

  adminUsers: () => request<AdminUser[]>('GET', '/api/admin/users'),
  setAdmin: (userId: string, admin: boolean) => request<AdminUser>('PUT', `/api/admin/users/${userId}/role`, { admin }),
  foodDemand: () => request<FoodDemand[]>('GET', '/api/admin/food-demand'),
  promoteFood: (foodId: string) => request<PromotedFood>('POST', `/api/admin/food-demand/${foodId}/promote`),
  openReports: () => request<OpenReport[]>('GET', '/api/admin/reports'),
  resolveReport: (reportId: string) => request<void>('POST', `/api/admin/reports/${reportId}/resolve`),

  kitchen: () => request<KitchenInfo>('GET', '/api/kitchen'),
  createInvite: () => request<InviteCreated>('POST', '/api/kitchen/invites'),
  leaveKitchen: () => request<LeaveResult>('POST', '/api/kitchen/leave'),
  restoreArchive: () => request<KitchenInfo>('POST', '/api/kitchen/archive/restore'),
  removeMember: (memberId: string) => request<KitchenInfo>('POST', `/api/kitchen/members/${memberId}/remove`),
  invite: (token: string) => request<InviteInfo>('GET', `/api/invites/${encodeURIComponent(token)}`),
  acceptInvite: (token: string, bringMine: boolean) => request<KitchenInfo>('POST', `/api/invites/${encodeURIComponent(token)}/accept`, { bringMine }),
  register: (token: string, email: string, displayName: string, password: string) =>
    request<MeResponse>('POST', `/api/invites/${encodeURIComponent(token)}/register`, { token, email, displayName, password }),

  pull: (since: number) => request<SyncPullResponse>('GET', `/api/sync?since=${since}`),
  push: (changes: SyncChange[]) => request<SyncPushResponse>('POST', '/api/sync', { changes }),

  barcode: (code: string) => request<BarcodeProduct>('GET', `/api/barcode/${encodeURIComponent(code)}`),

  aiStatus: () => request<AiStatus>('GET', '/api/ai/status'),
  enrichFood: (body: FoodEnrichRequest) => request<FoodEnrichResponse>('POST', '/api/ai/foods/enrich', body),
  generateRecipe: (body: RecipeGenerateRequest) => request<RecipeDraft>('POST', '/api/ai/recipes/generate', body),
  scanMeal: (imageDataUrl: string) => request<MealScanResult>('POST', '/api/ai/meals/scan', { imageDataUrl }),

  uploadPhoto: (id: string, blob: Blob) =>
    request<void>('PUT', `/api/photos/${id}`, undefined, {
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
    }),
}
