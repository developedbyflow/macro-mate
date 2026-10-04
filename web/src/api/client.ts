import type {
  AiStatus,
  BarcodeProduct,
  FoodEnrichRequest,
  FoodEnrichResponse,
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
    super('Nu ai internet.')
  }
}

async function request<T>(method: string, url: string, body?: unknown, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      ...init,
    })
  } catch {
    throw new OfflineError()
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null)
    if (!problem && response.status >= 502 && response.status <= 504) throw new ApiError(response.status, 'Serverul nu răspunde. Modificările așteaptă în telefon.')
    throw new ApiError(response.status, problem?.detail ?? problem?.title ?? `Eroare ${response.status}`)
  }
  if (response.status === 204) return undefined as T
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

  pull: (since: number) => request<SyncPullResponse>('GET', `/api/sync?since=${since}`),
  push: (changes: SyncChange[]) => request<SyncPushResponse>('POST', '/api/sync', { changes }),

  barcode: (code: string) => request<BarcodeProduct>('GET', `/api/barcode/${encodeURIComponent(code)}`),

  aiStatus: () => request<AiStatus>('GET', '/api/ai/status'),
  enrichFood: (body: FoodEnrichRequest) => request<FoodEnrichResponse>('POST', '/api/ai/foods/enrich', body),
  generateRecipe: (body: RecipeGenerateRequest) => request<RecipeDraft>('POST', '/api/ai/recipes/generate', body),

  uploadPhoto: (id: string, blob: Blob) =>
    request<void>('PUT', `/api/photos/${id}`, undefined, {
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
    }),
}
