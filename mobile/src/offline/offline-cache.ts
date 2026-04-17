import type { AuthUser } from '@/types/auth.types'
import type { DemountTaskItem } from '@/api/demount-tasks.api'
import type { InstallTaskItem } from '@/api/install-tasks.api'
import type { MeterTypeDefinitionItem, MeterTypeFieldItem } from '@/api/meter-type-definitions.api'
import type { MobileSimCard } from '@/api/sim-cards.api'
import { deletePersistedJson, readPersistedJson, writePersistedJson } from './persisted-json'

type CacheEnvelope<T> = {
  cachedAt: string
  scope: { userId: string; branchId: string | null; distributionId: string | null }
  data: T
}

function getScope(user: AuthUser): CacheEnvelope<null>['scope'] {
  return {
    userId: user.id,
    branchId: user.branchId ?? null,
    distributionId: user.distributionId ?? null,
  }
}

function buildKey(parts: string[]): string {
  return parts.join(':')
}

async function readScopedCache<T>(key: string, user: AuthUser): Promise<CacheEnvelope<T> | null> {
  const envelope = await readPersistedJson<CacheEnvelope<T>>(key)
  if (!envelope) return null
  if (envelope.scope.userId !== user.id) return null
  return envelope
}

async function writeScopedCache<T>(key: string, user: AuthUser, data: T): Promise<void> {
  const envelope: CacheEnvelope<T> = {
    cachedAt: new Date().toISOString(),
    scope: getScope(user),
    data,
  }
  await writePersistedJson(key, envelope as unknown as Record<string, unknown>)
}

export const offlineCache = {
  meterTypeDefinitions: {
    key: (user: AuthUser) => buildKey(['cache', 'meter-type-definitions', 'v1', user.id]),
    async get(user: AuthUser): Promise<CacheEnvelope<MeterTypeDefinitionItem[]> | null> {
      return readScopedCache<MeterTypeDefinitionItem[]>(this.key(user), user)
    },
    async set(user: AuthUser, data: MeterTypeDefinitionItem[]): Promise<void> {
      await writeScopedCache(this.key(user), user, data)
    },
    async clear(user: AuthUser): Promise<void> {
      await deletePersistedJson(this.key(user))
    },
  },
  meterTypeFields: {
    key: (user: AuthUser, meterTypeDefinitionId: string) =>
      buildKey(['cache', 'meter-type-fields', 'v1', user.id, meterTypeDefinitionId]),
    async get(
      user: AuthUser,
      meterTypeDefinitionId: string,
    ): Promise<CacheEnvelope<MeterTypeFieldItem[]> | null> {
      return readScopedCache<MeterTypeFieldItem[]>(
        this.key(user, meterTypeDefinitionId),
        user,
      )
    },
    async set(
      user: AuthUser,
      meterTypeDefinitionId: string,
      data: MeterTypeFieldItem[],
    ): Promise<void> {
      await writeScopedCache(this.key(user, meterTypeDefinitionId), user, data)
    },
  },
  myAssignedSimCards: {
    key: (user: AuthUser) => buildKey(['cache', 'my-assigned-sim-cards', 'v1', user.id]),
    async get(user: AuthUser): Promise<CacheEnvelope<MobileSimCard[]> | null> {
      return readScopedCache<MobileSimCard[]>(this.key(user), user)
    },
    async set(user: AuthUser, data: MobileSimCard[]): Promise<void> {
      await writeScopedCache(this.key(user), user, data)
    },
  },
  offlineSimInventory: {
    key: (user: AuthUser) => buildKey(['cache', 'offline-sim-inventory', 'v1', user.id]),
    async get(user: AuthUser): Promise<CacheEnvelope<MobileSimCard[]> | null> {
      return readScopedCache<MobileSimCard[]>(this.key(user), user)
    },
    async set(user: AuthUser, data: MobileSimCard[]): Promise<void> {
      await writeScopedCache(this.key(user), user, data)
    },
    async upsert(user: AuthUser, card: MobileSimCard): Promise<void> {
      const existing = (await this.get(user))?.data ?? []
      const filtered = existing.filter((c) => c.iccid !== card.iccid)
      const next = [{ ...card, fromOfflineCache: undefined }, ...filtered]
      await this.set(user, next)
    },
    async removeByIccid(user: AuthUser, iccid: string): Promise<void> {
      const existing = (await this.get(user))?.data ?? []
      await this.set(
        user,
        existing.filter((c) => c.iccid !== iccid),
      )
    },
    async clear(user: AuthUser): Promise<void> {
      await deletePersistedJson(this.key(user))
    },
    async findByIccid(user: AuthUser, iccid: string): Promise<MobileSimCard | null> {
      const existing = (await this.get(user))?.data ?? []
      const found = existing.find((c) => c.iccid === iccid)
      return found ? { ...found, fromOfflineCache: true } : null
    },
  },
  demountTasksMy: {
    key: (user: AuthUser) => buildKey(['cache', 'demount-tasks-my', 'v1', user.id]),
    async get(user: AuthUser): Promise<CacheEnvelope<DemountTaskItem[]> | null> {
      return readScopedCache<DemountTaskItem[]>(this.key(user), user)
    },
    async set(user: AuthUser, data: DemountTaskItem[]): Promise<void> {
      await writeScopedCache(this.key(user), user, data)
    },
  },
  installTasksMy: {
    key: (user: AuthUser) => buildKey(['cache', 'install-tasks-my', 'v1', user.id]),
    async get(user: AuthUser): Promise<CacheEnvelope<InstallTaskItem[]> | null> {
      return readScopedCache<InstallTaskItem[]>(this.key(user), user)
    },
    async set(user: AuthUser, data: InstallTaskItem[]): Promise<void> {
      await writeScopedCache(this.key(user), user, data)
    },
  },
}

