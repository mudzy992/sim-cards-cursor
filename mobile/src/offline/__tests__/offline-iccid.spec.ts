import { isValidIccid, normalizeIccid } from '@sim-tracker/shared';
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

jest.mock('@/api/axios.instance', () => ({
  axiosInstance: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    defaults: { baseURL: 'https://example.test/api' },
  },
}));

jest.mock('@/api/installation-records-upload.api', () => ({
  installationRecordsUploadApi: {
    uploadPhoto: jest.fn().mockResolvedValue('/uploads/photo.jpg'),
  },
}));

jest.mock('@/utils/storage', () => ({
  loadSession: jest.fn().mockResolvedValue(null),
  saveSession: jest.fn().mockResolvedValue(undefined),
  clearSession: jest.fn().mockResolvedValue(undefined),
}));

import { offlineCache } from '@/offline/offline-cache';
import { reconcileOfflineSimInventory } from '@/offline/sim-inventory-reconcile';
import { queueInstallationRecord } from '@/api/installation-records.api';
import { listOutbox } from '@/offline/outbox';
import { simCardsApi } from '@/api/sim-cards.api';
import { axiosInstance } from '@/api/axios.instance';
import { useAuthStore } from '@/store/auth.store';

const testUser: AuthUser = {
  id: 'user-1',
  email: 'operator@example.com',
  username: 'operator',
  firstName: 'Test',
  lastName: 'Operator',
  role: 'USER',
  status: 'ACTIVE',
  branchId: 'branch-1',
  distributionId: 'dist-1',
};

describe('Mobile offline ICCID normalization, cache & outbox', () => {
  beforeEach(() => {
    memStore.clear();
    jest.clearAllMocks();
    useAuthStore.setState({ user: testUser, isAuthenticated: true, isHydrated: true });
  });

  it('normalizes and validates ICCID values using @sim-tracker/shared', () => {
    expect(normalizeIccid(' 8938 7000 0000 0001 2345 ')).toBe('89387000000000012345');
    expect(isValidIccid('8938 7000 0000 0001 2345')).toBe(true);
    expect(isValidIccid('12345')).toBe(false);
    expect(isValidIccid('89387000ABC')).toBe(false);
  });

  it('upserts, finds, and removes offline SIM inventory by normalized ICCID', async () => {
    await offlineCache.offlineSimInventory.upsert(testUser, {
      id: 'sim-1',
      iccid: '8938 7000 0000 0001 2345',
      ipAddress: '10.10.0.1',
      status: 'AVAILABLE',
    });

    const found = await offlineCache.offlineSimInventory.findByIccid(
      testUser,
      '89387000000000012345',
    );
    expect(found).not.toBeNull();
    expect(found?.iccid).toBe('89387000000000012345');
    expect(found?.fromOfflineCache).toBe(true);

    await offlineCache.offlineSimInventory.removeByIccid(
      testUser,
      '8938 7000 0000 0001 2345',
    );
    const afterRemove = await offlineCache.offlineSimInventory.findByIccid(
      testUser,
      '89387000000000012345',
    );
    expect(afterRemove).toBeNull();
  });

  it('reconciles offline SIM inventory and removes installed or reassigned cards', async () => {
    await offlineCache.offlineSimInventory.upsert(testUser, {
      id: 'sim-keep',
      iccid: '89387000000000000001',
      ipAddress: '10.10.0.1',
      status: 'AVAILABLE',
    });
    await offlineCache.offlineSimInventory.upsert(testUser, {
      id: 'sim-drop',
      iccid: '89387000000000000002',
      ipAddress: '10.10.0.2',
      status: 'AVAILABLE',
    });

    const scanBatchSpy = jest
      .spyOn(simCardsApi, 'scanBatch')
      .mockResolvedValue({
        items: [
          {
            id: 'sim-drop',
            iccid: '89387000000000000002',
            ipAddress: '10.10.0.2',
            status: 'INSTALLED',
          },
          {
            id: 'sim-keep',
            iccid: '89387000000000000001',
            ipAddress: '10.10.0.1',
            status: 'ASSIGNED',
            assignedTo: {
              id: testUser.id,
              firstName: 'Test',
              lastName: 'Operator',
              email: testUser.email,
            },
          },
        ],
        notFoundIccids: [],
      });

    const result = await reconcileOfflineSimInventory(testUser);
    expect(scanBatchSpy).toHaveBeenCalledTimes(1);
    expect(scanBatchSpy).toHaveBeenCalledWith([
      '89387000000000000002',
      '89387000000000000001',
    ]);
    expect(result.removedIccids).toEqual(['89387000000000000002']);
    expect(result.kept).toBe(1);
    expect(result.updated).toBe(1);
  });

  it('extracts items from paginated /sim-cards/my-assigned response and caches them', async () => {
    const paginatedItems = [
      {
        id: 'sim-a1',
        iccid: '89387000000000000099',
        ipAddress: '10.10.0.99',
        status: 'ASSIGNED',
      },
    ];
    (axiosInstance.get as jest.Mock).mockResolvedValueOnce({
      data: {
        data: {
          items: paginatedItems,
          page: 1,
          limit: 100,
          total: 1,
          totalPages: 1,
        },
      },
    });

    const list = await simCardsApi.myAssigned();
    expect(axiosInstance.get).toHaveBeenCalledWith('/sim-cards/my-assigned', {
      params: { limit: 100 },
    });
    expect(list).toEqual(paginatedItems);

    const cached = await offlineCache.myAssignedSimCards.get(testUser);
    expect(cached?.data).toEqual(paginatedItems);
  });

  it('strips localPhotoUris from request body into outbox meta when queueing installation record', async () => {
    await queueInstallationRecord({
      simCardId: 'sim-1',
      meterId: 'meter-1',
      installedById: testUser.id,
      notes: 'Offline note',
      localPhotoUris: ['file:///tmp/photo1.jpg'],
    });

    const items = await listOutbox(testUser);
    expect(items).toHaveLength(1);
    expect(items[0].meta?.localPhotoUris).toEqual(['file:///tmp/photo1.jpg']);
    expect(items[0].request.body).not.toHaveProperty('localPhotoUris');
    expect(items[0].request.body).toMatchObject({
      simCardId: 'sim-1',
      meterId: 'meter-1',
      installedById: testUser.id,
    });
  });
});
