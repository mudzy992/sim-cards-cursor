import axios from 'axios'
import type { AuthUser } from '@/types/auth.types'
import { axiosInstance } from '@/api/axios.instance'
import { installationRecordsApi } from '@/api/installation-records.api'
import { deletePersistedJson, readPersistedJson, writePersistedJson } from './persisted-json'

export type OutboxStatus = 'PENDING' | 'SENDING' | 'FAILED' | 'SENT'

export type OutboxKind =
  | 'INSTALLATION_RECORD_CREATE'
  | 'SIM_CARD_CLAIM'
  | 'DEMOUNT_TASK_UPDATE_STATUS'
  | 'DEMOUNT_TASK_COMPLETE'
  | 'INSTALL_TASK_UPDATE_STATUS'
  | 'INSTALL_TASK_COMPLETE'

export type OutboxItem = {
  id: string
  clientRequestId: string
  kind: OutboxKind
  status: OutboxStatus
  createdAt: string
  updatedAt: string
  attemptCount: number
  lastError?: string
  request: {
    method: 'POST' | 'PATCH'
    url: string
    body: unknown
  }
  meta?: {
    taskId?: string
    meterId?: string
    simCardId?: string
    recordNumber?: string
    localPhotoUris?: string[]
  }
}

type OutboxEnvelope = {
  scope: { userId: string }
  items: OutboxItem[]
}

function getKey(user: AuthUser): string {
  return `outbox:v1:${user.id}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function makeClientRequestId(): string {
  return `crid_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

async function readEnvelope(user: AuthUser): Promise<OutboxEnvelope> {
  const existing = await readPersistedJson<OutboxEnvelope>(getKey(user))
  if (!existing || existing.scope.userId !== user.id || !Array.isArray(existing.items)) {
    return { scope: { userId: user.id }, items: [] }
  }
  return existing
}

async function writeEnvelope(user: AuthUser, env: OutboxEnvelope): Promise<void> {
  await writePersistedJson(getKey(user), env as unknown as Record<string, unknown>)
}

export async function listOutbox(user: AuthUser): Promise<OutboxItem[]> {
  const env = await readEnvelope(user)
  return env.items.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export async function getOutboxCounts(user: AuthUser): Promise<{
  pending: number
  failed: number
  total: number
}> {
  const env = await readEnvelope(user)
  const pending = env.items.filter((i) => i.status === 'PENDING' || i.status === 'SENDING').length
  const failed = env.items.filter((i) => i.status === 'FAILED').length
  return { pending, failed, total: env.items.length }
}

export async function clearOutbox(user: AuthUser): Promise<void> {
  await deletePersistedJson(getKey(user))
}

export async function enqueueOutboxItem(
  user: AuthUser,
  input: Omit<
    OutboxItem,
    'id' | 'createdAt' | 'updatedAt' | 'attemptCount' | 'status' | 'clientRequestId'
  > & {
    status?: OutboxStatus
    attemptCount?: number
    clientRequestId?: string
  },
): Promise<OutboxItem> {
  const env = await readEnvelope(user)
  const createdAt = nowIso()
  const item: OutboxItem = {
    id: makeId(),
    clientRequestId: input.clientRequestId ?? makeClientRequestId(),
    kind: input.kind,
    status: input.status ?? 'PENDING',
    createdAt,
    updatedAt: createdAt,
    attemptCount: input.attemptCount ?? 0,
    lastError: undefined,
    request: input.request,
    meta: input.meta,
  }
  env.items.push(item)
  await writeEnvelope(user, env)
  return item
}

async function updateItem(user: AuthUser, id: string, patch: Partial<OutboxItem>): Promise<void> {
  const env = await readEnvelope(user)
  const idx = env.items.findIndex((i) => i.id === id)
  if (idx === -1) return
  env.items[idx] = {
    ...env.items[idx],
    ...patch,
    updatedAt: nowIso(),
  }
  await writeEnvelope(user, env)
}

async function removeItem(user: AuthUser, id: string): Promise<void> {
  const env = await readEnvelope(user)
  env.items = env.items.filter((i) => i.id !== id)
  await writeEnvelope(user, env)
}

function toErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const msg = (error.response?.data as { message?: unknown } | undefined)?.message
    if (typeof msg === 'string') return msg
    return error.response?.status ? `HTTP ${error.response.status}` : 'Network error'
  }
  if (error instanceof Error) return error.message
  return 'Unknown error'
}

async function sendOne(item: OutboxItem): Promise<void> {
  if (item.kind === 'INSTALLATION_RECORD_CREATE' && item.meta?.localPhotoUris?.length) {
    const body = item.request.body as any
    const uploaded: string[] = []
    for (const uri of item.meta.localPhotoUris) {
      const path = await installationRecordsApi.uploadPhoto(uri)
      uploaded.push(path)
    }
    item.request.body = {
      ...body,
      photos: Array.isArray(body?.photos) ? [...body.photos, ...uploaded] : uploaded,
    }
  }
  if (item.request.method === 'POST') {
    await axiosInstance.post(item.request.url, item.request.body)
    return
  }
  await axiosInstance.patch(item.request.url, item.request.body)
}

export async function syncOutbox(user: AuthUser, opts?: { maxItems?: number }): Promise<{
  sent: number
  failed: number
  remaining: number
}> {
  const maxItems = opts?.maxItems ?? 25
  const env = await readEnvelope(user)
  const candidates = env.items
    .filter((i) => i.status === 'PENDING' || i.status === 'FAILED')
    .slice()
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
    .slice(0, maxItems)

  let sent = 0
  let failed = 0

  for (const item of candidates) {
    await updateItem(user, item.id, { status: 'SENDING', lastError: undefined })
    try {
      await sendOne(item)
      sent += 1
      await removeItem(user, item.id)
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        await updateItem(user, item.id, {
          status: 'PENDING',
          attemptCount: item.attemptCount + 1,
          lastError: 'Offline / backend nedostupan',
        })
        break
      }

      const msg = toErrorMessage(error)
      failed += 1
      await updateItem(user, item.id, {
        status: 'FAILED',
        attemptCount: item.attemptCount + 1,
        lastError: msg,
      })
    }
  }

  const updated = await readEnvelope(user)
  return {
    sent,
    failed,
    remaining: updated.items.length,
  }
}

export async function hasPendingForTask(user: AuthUser, taskId: string): Promise<boolean> {
  const env = await readEnvelope(user)
  return env.items.some(
    (i) =>
      i.meta?.taskId === taskId &&
      (i.status === 'PENDING' || i.status === 'SENDING' || i.status === 'FAILED'),
  )
}

