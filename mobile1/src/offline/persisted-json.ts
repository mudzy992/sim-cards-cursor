import {
  cacheDirectory,
  documentDirectory,
  deleteAsync,
  getInfoAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy'

function getSafeFilename(key: string): string {
  const normalized = key.replace(/[^a-zA-Z0-9._-]/g, '_')
  return normalized.length > 120 ? normalized.slice(0, 120) : normalized
}

function getBaseDir(): string {
  const base = documentDirectory ?? cacheDirectory
  if (!base) {
    throw new Error('No writable directory available for offline storage')
  }
  return `${base}sim-tracker-offline/`
}

async function ensureBaseDir(): Promise<string> {
  const dir = getBaseDir()
  const info = await getInfoAsync(dir)
  if (!info.exists) {
    await makeDirectoryAsync(dir, { intermediates: true })
  }
  return dir
}

function buildPath(key: string): string {
  const filename = `${getSafeFilename(key)}.json`
  return `${getBaseDir()}${filename}`
}

export async function readPersistedJson<T>(key: string): Promise<T | null> {
  try {
    const path = buildPath(key)
    const info = await getInfoAsync(path)
    if (!info.exists) return null
    const raw = await readAsStringAsync(path)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function writePersistedJson(key: string, value: unknown): Promise<void> {
  const dir = await ensureBaseDir()
  const filename = `${getSafeFilename(key)}.json`
  const path = `${dir}${filename}`
  await writeAsStringAsync(path, JSON.stringify(value))
}

export async function deletePersistedJson(key: string): Promise<void> {
  try {
    const path = buildPath(key)
    const info = await getInfoAsync(path)
    if (!info.exists) return
    await deleteAsync(path, { idempotent: true })
  } catch {
    // ignore
  }
}
