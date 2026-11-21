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
  },
}));

jest.mock('@/utils/storage', () => ({
  loadSession: jest.fn().mockResolvedValue(null),
  saveSession: jest.fn().mockResolvedValue(undefined),
  clearSession: jest.fn().mockResolvedValue(undefined),
}));

import { meterTypeDefinitionsApi } from '@/api/meter-type-definitions.api';
import { syncMeterTypesOfflineCache } from '@/offline/meter-types-sync';
import { offlineCache } from '@/offline/offline-cache';

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

describe('syncMeterTypesOfflineCache', () => {
  beforeEach(() => {
    memStore.clear();
    jest.clearAllMocks();
  });

  it('caches types and embedded fields in a single list() call without N+1 listFields requests', async () => {
    const listSpy = jest.spyOn(meterTypeDefinitionsApi, 'list').mockResolvedValueOnce([
      {
        id: 'type-1',
        name: 'AMM 3.0',
        type: 'THREE_PHASE',
        fields: [
          {
            id: 'f-1',
            meterTypeDefinitionId: 'type-1',
            name: 'ct_ratio',
            label: 'CT Ratio',
            fieldType: 'STRING',
            isRequired: false,
            isOperatorFillable: true,
            sortOrder: 0,
          },
        ],
      },
    ]);
    const listFieldsSpy = jest.spyOn(meterTypeDefinitionsApi, 'listFields');

    const res = await syncMeterTypesOfflineCache(testUser);

    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(listFieldsSpy).not.toHaveBeenCalled();
    expect(res).toEqual({ typesCount: 1, fieldsCount: 1 });

    const cachedTypes = await offlineCache.meterTypeDefinitions.get(testUser);
    const cachedFields = await offlineCache.meterTypeFields.get(testUser, 'type-1');
    expect(cachedTypes?.data).toHaveLength(1);
    expect(cachedFields?.data).toHaveLength(1);
    expect(cachedFields?.data[0].name).toBe('ct_ratio');
  });
});
