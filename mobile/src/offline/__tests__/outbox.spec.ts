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

import {
  clearOutbox,
  enqueueOutboxItem,
  listOutbox,
  removeOutboxItem,
  retryOutboxItem,
  syncOutbox,
} from '@/offline/outbox';
import { axiosInstance } from '@/api/axios.instance';

const testUser: AuthUser = {
  id: 'user-outbox-1',
  email: 'op@example.com',
  username: 'op',
  firstName: 'Op',
  lastName: 'User',
  role: 'USER',
  status: 'ACTIVE',
  branchId: 'branch-1',
  distributionId: 'dist-1',
};

describe('Mobile outbox reliability (coalescing, retry, remove)', () => {
  beforeEach(() => {
    memStore.clear();
    jest.clearAllMocks();
  });

  it('coalesces duplicate pending status updates for the same taskId', async () => {
    await enqueueOutboxItem(testUser, {
      kind: 'INSTALL_TASK_UPDATE_STATUS',
      request: {
        method: 'PATCH',
        url: '/install-tasks/task-1/status',
        body: { status: 'IN_PROGRESS' },
      },
      meta: { taskId: 'task-1' },
    });

    await enqueueOutboxItem(testUser, {
      kind: 'INSTALL_TASK_UPDATE_STATUS',
      request: {
        method: 'PATCH',
        url: '/install-tasks/task-1/status',
        body: { status: 'PENDING' },
      },
      meta: { taskId: 'task-1' },
    });

    const items = await listOutbox(testUser);
    expect(items).toHaveLength(1);
    expect(items[0].request.body).toEqual({ status: 'PENDING' });
  });

  it('removes a single item without affecting other queued items', async () => {
    const first = await enqueueOutboxItem(testUser, {
      kind: 'SIM_CARD_CLAIM',
      request: { method: 'POST', url: '/sim-cards/1/claim', body: {} },
    });
    const second = await enqueueOutboxItem(testUser, {
      kind: 'SIM_CARD_CLAIM',
      request: { method: 'POST', url: '/sim-cards/2/claim', body: {} },
    });

    await removeOutboxItem(testUser, first.id);
    const items = await listOutbox(testUser);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(second.id);

    await clearOutbox(testUser);
    expect(await listOutbox(testUser)).toHaveLength(0);
  });

  it('retries a single failed item and removes it upon success', async () => {
    const item = await enqueueOutboxItem(testUser, {
      kind: 'DEMOUNT_TASK_UPDATE_STATUS',
      request: {
        method: 'PATCH',
        url: '/demount-tasks/task-99/status',
        body: { status: 'IN_PROGRESS' },
      },
      meta: { taskId: 'task-99' },
    });

    // First sync fails with server error
    (axiosInstance.patch as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 500, data: { message: 'Temporary outage' } },
      message: 'Temporary outage',
    });

    const pass1 = await syncOutbox(testUser);
    expect(pass1.failed).toBe(1);
    const afterFail = await listOutbox(testUser);
    expect(afterFail[0].status).toBe('FAILED');
    expect(afterFail[0].attemptCount).toBe(1);

    // Retry succeeds
    (axiosInstance.patch as jest.Mock).mockResolvedValueOnce({ data: { data: { ok: true } } });
    const outcome = await retryOutboxItem(testUser, item.id);
    expect(outcome).toBe('sent');
    expect(await listOutbox(testUser)).toHaveLength(0);
  });
});
