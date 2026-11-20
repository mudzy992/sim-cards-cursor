import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axe from 'axe-core';
import { I18nProvider } from '@/i18n';
import { AntdLocaleBridge } from '@/components/layout/AntdLocaleBridge';
import { AppLayout } from '@/components/layout/AppLayout';
import { NotificationBell } from '@/components/layout/NotificationBell';
import {
  DensityToggle,
  EmptyNotice,
  ErrorNotice,
  FilterBar,
  PageHeader,
  PageShell,
  SectionCard,
  StatCard,
  StatusBadge,
  ThemeSwitcher,
} from '@/components/ui';
import { LabelSheetPreview } from '@/pages/shipments/print/LabelSheetPreview';
import { LABEL_FORMAT_PRESETS } from '@/pages/shipments/print/label-formats';
import LoginPage from '@/pages/auth/LoginPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import { useThemeStore } from '@/store/theme.store';

vi.mock('@/api/notifications.api', () => ({
  notificationsApi: {
    getUnreadCount: vi.fn().mockResolvedValue(2),
    list: vi.fn().mockResolvedValue([]),
    markAsRead: vi.fn().mockResolvedValue(undefined),
    markAllAsRead: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/api/app-releases.api', () => ({
  appReleasesApi: {
    latestAndroid: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/api/dashboard.api', () => ({
  dashboardApi: {
    getStats: vi.fn().mockResolvedValue({
      installationRecords: { total: 12, byStatus: { DRAFT: 3, SENT: 9 } },
      simCards: { total: 40, available: 25, installed: 15 },
      meters: 18,
    }),
    getRecentRecords: vi.fn().mockResolvedValue([]),
    getRecordsChart: vi.fn().mockResolvedValue([{ date: '2026-11-20', count: 4 }]),
  },
}));

vi.mock('@/hooks/useNotificationSocket', () => ({
  useNotificationSocket: vi.fn(),
}));

vi.mock('@/hooks/useAppFeatures', () => ({
  useAppFeatures: () => ({
    data: { pushCampaignsEnabled: true, missingKeys: [] },
    isLoading: false,
  }),
}));

vi.mock('@/api/branch-moderators.api', () => ({
  branchModeratorsApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

function renderWithProviders(ui: ReactNode, mode: 'light' | 'dark' = 'light') {
  useThemeStore.getState().setPreference(mode);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <I18nProvider>
      <AntdLocaleBridge>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>{ui}</MemoryRouter>
        </QueryClientProvider>
      </AntdLocaleBridge>
    </I18nProvider>,
  );
}

describe('Accessibility checks (axe-core, dual light/dark)', () => {
  it('NotificationBell has accessible button label and zero axe violations', async () => {
    const { container } = renderWithProviders(<NotificationBell />, 'light');
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it('LabelSheetPreview interactive cells use accessible button elements with zero axe violations', async () => {
    const preset = LABEL_FORMAT_PRESETS[0];
    const { container } = renderWithProviders(
      <LabelSheetPreview
        cells={[
          {
            used: false,
            sim: {
              id: 'sim-1',
              iccid: '8938700000000000001',
              ipAddress: '10.10.0.1',
              publicIpAddress: null,
            },
          },
          { used: true, sim: null },
        ]}
        layout={preset}
        scale={1}
        sheetNumber={1}
        totalSheets={1}
        interactive
        showGuides
        makeLines={(sim) => [{ text: sim.iccid, fontMm: 2.2, weight: 700 }]}
        lineGapMm={0.5}
        onPickStart={vi.fn()}
      />,
      'dark',
    );

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(2);

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it.each(['light', 'dark'] as const)(
    'UI primitives suite has zero axe violations in %s mode',
    async (mode) => {
      const { container } = renderWithProviders(
        <PageShell>
          <PageHeader
            title="Test page"
            subtitle="Test subtitle"
            badge={<StatusBadge tone="success" label="Active" />}
            actions={
              <>
                <DensityToggle />
                <ThemeSwitcher />
              </>
            }
          />
          <StatCard label="Total cards" value="42" tone="accent" />
          <FilterBar hasActiveFilters onReset={vi.fn()}>
            <span>Filters</span>
          </FilterBar>
          <SectionCard title="Section">
            <EmptyNotice />
          </SectionCard>
          <ErrorNotice message="Sample error" onRetry={vi.fn()} />
        </PageShell>,
        mode,
      );

      const results = await axe.run(container);
      expect(results.violations).toEqual([]);
    },
    15_000,
  );

  it.each(['light', 'dark'] as const)(
    'LoginPage has <main>, single <h1>, and zero axe violations in %s mode',
    async (mode) => {
      const { container } = renderWithProviders(<LoginPage />, mode);
      expect(container.querySelectorAll('h1').length).toBe(1);
      expect(container.querySelector('main')).not.toBeNull();

      const results = await axe.run(container);
      expect(results.violations).toEqual([]);
    },
    15_000,
  );

  it.each(['light', 'dark'] as const)(
    'DashboardPage has single <h1> and zero axe violations in %s mode',
    async (mode) => {
      const { container } = renderWithProviders(<DashboardPage />, mode);
      expect(container.querySelectorAll('h1').length).toBe(1);

      const results = await axe.run(container);
      expect(results.violations).toEqual([]);
    },
    15_000,
  );

  it('AppLayout provides skip-to-content link, navigation landmark, and <main id="main-content">', async () => {
    useThemeStore.getState().setPreference('dark');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { container } = render(
      <I18nProvider>
        <AntdLocaleBridge>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/dashboard']}>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<h1>Dashboard</h1>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </AntdLocaleBridge>
      </I18nProvider>,
    );

    const skipLink = container.querySelector('a[href="#main-content"]');
    expect(skipLink).not.toBeNull();
    expect(container.querySelector('main#main-content')).not.toBeNull();
    expect(container.querySelectorAll('nav').length).toBeGreaterThanOrEqual(2);

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  }, 15_000);
});
