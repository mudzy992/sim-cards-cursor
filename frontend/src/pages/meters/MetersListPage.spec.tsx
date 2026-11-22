import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { I18nProvider } from '@/i18n';
import { AntdLocaleBridge } from '@/components/layout/AntdLocaleBridge';
import MetersListPage from '@/pages/meters/MetersListPage';

const { mockMeters } = vi.hoisted(() => ({
  mockMeters: [
    {
      id: 'm-1',
      serialNumber: 'MET-INSTALL-001',
      meterTypeDefinitionId: 'mtd-1',
      meterTypeDefinition: { id: 'mtd-1', name: 'AMM-GPRS' },
      meterType: 'THREE_PHASE',
      status: 'ACTIVE',
      simCardState: 'NO_SIM',
      simCard: null,
      simCardId: null,
      branchId: 'b-1',
      branch: { id: 'b-1', name: 'Zenica' },
      createdAt: '2026-11-18T10:00:00.000Z',
      updatedAt: '2026-11-18T10:00:00.000Z',
    },
    {
      id: 'm-2',
      serialNumber: 'MET-DEMOUNT-002',
      meterTypeDefinitionId: 'mtd-1',
      meterTypeDefinition: { id: 'mtd-1', name: 'AMM-GPRS' },
      meterType: 'THREE_PHASE',
      status: 'ACTIVE',
      simCardState: 'INSTALLED',
      simCardId: 'sim-2',
      simCard: { id: 'sim-2', iccid: '8938700000000000002', status: 'ACTIVE' },
      branchId: 'b-1',
      branch: { id: 'b-1', name: 'Zenica' },
      createdAt: '2026-11-18T10:00:00.000Z',
      updatedAt: '2026-11-18T10:00:00.000Z',
    },
  ],
}));

vi.mock('@/store/auth.store', () => ({
  useAuthStore: (selector: (s: { user: { id: string; role: string } }) => unknown) =>
    selector({ user: { id: 'admin-1', role: 'SYSTEM_ADMIN' } }),
}));

vi.mock('@/api/meters.api', () => ({
  metersApi: {
    list: vi.fn().mockResolvedValue({
      items: mockMeters,
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    }),
  },
}));

vi.mock('@/api/branches.api', () => ({
  branchesApi: {
    list: vi.fn().mockResolvedValue([{ id: 'b-1', name: 'Zenica', code: 'ZEN' }]),
  },
}));

vi.mock('@/api/meter-type-definitions.api', () => ({
  meterTypeDefinitionsApi: {
    listAll: vi.fn().mockResolvedValue([{ id: 'mtd-1', name: 'AMM-GPRS' }]),
    list: vi.fn().mockResolvedValue({ items: [{ id: 'mtd-1', name: 'AMM-GPRS' }], total: 1 }),
    listFields: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/api/users.api', () => ({
  usersApi: {
    list: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'op-1',
          firstName: 'Terenski',
          lastName: 'Monter',
          email: 'monter@simtracker.local',
          role: 'USER',
        },
      ],
      total: 1,
    }),
  },
}));

vi.mock('@/api/install-tasks.api', () => ({
  installTasksApi: {
    create: vi.fn(),
    createBulk: vi.fn().mockResolvedValue({ createdCount: 1, failedCount: 0, created: [], failed: [] }),
  },
}));

vi.mock('@/api/demount-tasks.api', () => ({
  demountTasksApi: {
    create: vi.fn(),
    createBulk: vi.fn().mockResolvedValue({ createdCount: 1, failedCount: 0, created: [], failed: [] }),
  },
}));

function renderMetersPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <I18nProvider>
      <AntdLocaleBridge>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <MetersListPage />
          </MemoryRouter>
        </QueryClientProvider>
      </AntdLocaleBridge>
    </I18nProvider>,
  );
}

describe('MetersListPage bulk task dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders rows, shows bulk selection bar with eligible counts, and opens bulk install drawer', async () => {
    renderMetersPage();

    expect(await screen.findByText('MET-INSTALL-001')).toBeTruthy();
    expect(screen.getByText('MET-DEMOUNT-002')).toBeTruthy();

    const checkboxes = screen.getAllByRole('checkbox');
    // checkboxes[0] is Select All in AntD Table header
    fireEvent.click(checkboxes[0]);

    await waitFor(() => {
      expect(screen.getByText(/Selected meters:\s*2/i)).toBeTruthy();
    });

    const bulkInstallBtn = await screen.findByRole('button', {
      name: /ugradnj.*\(1\)|install.*\(1\)/i,
    });
    expect(bulkInstallBtn).toBeTruthy();

    const bulkDemountBtn = screen.getByRole('button', {
      name: /demont.*\(1\)|demount.*\(1\)/i,
    });
    expect(bulkDemountBtn).toBeTruthy();

    fireEvent.click(bulkInstallBtn);

    expect(
      await screen.findByText(
        /Bulk assign install task \(1\)|Masovno dodijeli zadatak ugradnje \(1\)/i,
      ),
    ).toBeTruthy();
  }, 30_000);
});
