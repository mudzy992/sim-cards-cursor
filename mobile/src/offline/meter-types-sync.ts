import type { AuthUser } from '@/types/auth.types'
import { meterTypeDefinitionsApi } from '@/api/meter-type-definitions.api'
import { offlineCache } from './offline-cache'

export async function syncMeterTypesOfflineCache(user: AuthUser): Promise<{
  typesCount: number
  fieldsCount: number
}> {
  const types = await meterTypeDefinitionsApi.list()
  let fieldsCount = 0

  for (const t of types) {
    const fields = await meterTypeDefinitionsApi.listFields(t.id)
    fieldsCount += fields.length
    await offlineCache.meterTypeFields.set(user, t.id, fields)
  }

  await offlineCache.meterTypeDefinitions.set(user, types)
  return { typesCount: types.length, fieldsCount }
}

