import type { AuthUser } from '@/types/auth.types';

const memStore = new Map<string, unknown>();

jest.mock('@/offline/persisted-json', () => ({
  readPersistedJson: jest.fn(async (key: string) => memStore.get(key) ?? null),
  writePersistedJson: jest.fn(async (key: string, value: unknown) => {
    memStore.set(key, value);
  }),
  deletePersistedJson: jest.fn(async (key: string) => {
    memStore.delete(key);
  }),
}));

import {
  clearRecordDraft,
  hasMeaningfulDraftContent,
  loadRecordDraft,
  saveRecordDraft,
} from '@/offline/draft-store';

const userA: AuthUser = {
  id: 'user-a',
  email: 'a@example.com',
  username: 'a',
  firstName: 'A',
  lastName: 'User',
  role: 'USER',
  status: 'ACTIVE',
};

const userB: AuthUser = {
  id: 'user-b',
  email: 'b@example.com',
  username: 'b',
  firstName: 'B',
  lastName: 'User',
  role: 'USER',
  status: 'ACTIVE',
};

const emptyDraft = {
  meterTypeId: '',
  serialNumber: '',
  year: '',
  calibrationYear: '',
  installationAddress: '',
  city: '',
  municipality: '',
  measuringPoint: '',
  installationDate: '2026-11-20',
  latitude: '',
  longitude: '',
  notes: '',
  dynamicFieldValues: {},
};

describe('Mobile record draft auto-save store', () => {
  beforeEach(() => {
    memStore.clear();
    jest.clearAllMocks();
  });

  it('ignores empty drafts and detects meaningful content', async () => {
    expect(
      hasMeaningfulDraftContent({ ...emptyDraft, savedAt: '2026-11-20T00:00:00Z' }),
    ).toBe(false);

    await saveRecordDraft(userA, 'new:sim-1', emptyDraft);
    expect(await loadRecordDraft(userA, 'new:sim-1')).toBeNull();
  });

  it('persists, isolates per user & scope, and clears drafts cleanly', async () => {
    await saveRecordDraft(userA, 'new:sim-1', {
      ...emptyDraft,
      serialNumber: 'MET-2026-0042',
      installationAddress: 'Zmaja od Bosne 7',
    });

    const loadedA = await loadRecordDraft(userA, 'new:sim-1');
    expect(loadedA).not.toBeNull();
    expect(loadedA?.serialNumber).toBe('MET-2026-0042');
    expect(loadedA?.installationAddress).toBe('Zmaja od Bosne 7');

    // Different user or scope cannot read userA's draft
    expect(await loadRecordDraft(userB, 'new:sim-1')).toBeNull();
    expect(await loadRecordDraft(userA, 'new:sim-2')).toBeNull();

    await clearRecordDraft(userA, 'new:sim-1');
    expect(await loadRecordDraft(userA, 'new:sim-1')).toBeNull();
  });
});
