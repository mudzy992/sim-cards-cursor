import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { I18nProvider } from '@/i18n';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { LabelSheetPreview } from '@/pages/shipments/print/LabelSheetPreview';
import { LABEL_FORMAT_PRESETS } from '@/pages/shipments/print/label-formats';

vi.mock('@/api/notifications.api', () => ({
  notificationsApi: {
    getUnreadCount: vi.fn().mockResolvedValue(2),
    list: vi.fn().mockResolvedValue([]),
    markAsRead: vi.fn().mockResolvedValue(undefined),
    markAllAsRead: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Accessibility checks (axe-core)', () => {
  it('NotificationBell has accessible button label and zero axe violations', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { container } = render(
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <NotificationBell />
          </MemoryRouter>
        </QueryClientProvider>
      </I18nProvider>,
    );

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it('LabelSheetPreview interactive cells use accessible button elements with zero axe violations', async () => {
    const preset = LABEL_FORMAT_PRESETS[0];
    const { container } = render(
      <I18nProvider>
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
        />
      </I18nProvider>,
    );

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(2);

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
