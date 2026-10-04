import type { RowOf, TableName } from '@/api/types'
import { db, getMeta, kitchenTables, personalTables } from './database'
import { requestSync } from './sync'

type NewRow<T extends TableName> = Omit<RowOf<T>, 'createdAt' | 'updatedAt' | 'deletedAt' | 'version' | 'createdBy' | 'userId' | 'kitchenId'> &
  Partial<Pick<RowOf<T>, 'createdAt' | 'version'>>

export function newId() {
  return crypto.randomUUID()
}

export async function saveRow<T extends TableName>(table: T, row: NewRow<T>, ownerId: string) {
  const now = new Date().toISOString()
  const existing = (await db.table(table).get(row.id)) as Record<string, unknown> | undefined
  const full = {
    ...existing,
    ...row,
    createdAt: (existing?.createdAt as string | undefined) ?? now,
    updatedAt: now,
    deletedAt: null,
    version: (existing?.version as number | undefined) ?? 0,
    ...(personalTables.includes(table)
      ? { userId: (existing?.userId as string | undefined) ?? ownerId }
      : { createdBy: (existing?.createdBy as string | undefined) ?? ownerId }),
    ...(kitchenTables.includes(table) ? { kitchenId: (existing?.kitchenId as string | undefined) ?? (await getMeta('kitchenId')) ?? '' } : {}),
  }

  await db.transaction('rw', [db.table(table), db.outbox], async () => {
    await db.table(table).put(full)
    await db.outbox.add({ table, op: 'upsert', rowId: row.id, data: full, createdAt: now })
  })
  requestSync()
  return full as unknown as RowOf<T>
}

export async function deleteRow(table: TableName, id: string) {
  const now = new Date().toISOString()
  await db.transaction('rw', [db.table(table), db.outbox], async () => {
    await db.table(table).update(id, { deletedAt: now, updatedAt: now })
    await db.outbox.add({ table, op: 'delete', rowId: id, createdAt: now })
  })
  requestSync()
}

export async function deleteRows(changes: { table: TableName; id: string }[]) {
  for (const change of changes) await deleteRow(change.table, change.id)
}
