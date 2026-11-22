import type { AuthUser } from '@/types/auth.types';
import {
  deletePersistedJson,
  readPersistedJson,
  writePersistedJson,
} from './persisted-json';

export interface RecordFormDraft {
  savedAt: string;
  meterTypeId: string;
  serialNumber: string;
  year: string;
  calibrationYear: string;
  installationAddress: string;
  city: string;
  municipality: string;
  measuringPoint: string;
  installationDate: string;
  latitude: string;
  longitude: string;
  notes: string;
  dynamicFieldValues: Record<string, unknown>;
}

interface DraftEnvelope {
  userId: string;
  scopeKey: string;
  draft: RecordFormDraft;
}

function buildDraftKey(user: AuthUser, scopeKey: string): string {
  return `draft:v1:${user.id}:${scopeKey}`;
}

export function hasMeaningfulDraftContent(draft: RecordFormDraft): boolean {
  return Boolean(
    draft.serialNumber.trim() ||
      draft.installationAddress.trim() ||
      draft.measuringPoint.trim() ||
      draft.notes.trim() ||
      draft.meterTypeId ||
      Object.keys(draft.dynamicFieldValues ?? {}).length > 0,
  );
}

export async function saveRecordDraft(
  user: AuthUser,
  scopeKey: string,
  draft: Omit<RecordFormDraft, 'savedAt'>,
): Promise<void> {
  const full: RecordFormDraft = {
    ...draft,
    savedAt: new Date().toISOString(),
  };
  if (!hasMeaningfulDraftContent(full)) {
    return;
  }
  const envelope: DraftEnvelope = {
    userId: user.id,
    scopeKey,
    draft: full,
  };
  await writePersistedJson(buildDraftKey(user, scopeKey), envelope);
}

export async function loadRecordDraft(
  user: AuthUser,
  scopeKey: string,
): Promise<RecordFormDraft | null> {
  const envelope = await readPersistedJson<DraftEnvelope>(
    buildDraftKey(user, scopeKey),
  );
  if (!envelope || envelope.userId !== user.id || envelope.scopeKey !== scopeKey) {
    return null;
  }
  return envelope.draft ?? null;
}

export async function clearRecordDraft(
  user: AuthUser,
  scopeKey: string,
): Promise<void> {
  await deletePersistedJson(buildDraftKey(user, scopeKey));
}
