import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { AntdLocaleBridge } from '@/components/layout/AntdLocaleBridge';
import LoginPage from '@/pages/auth/LoginPage';

vi.mock('@/api/app-releases.api', () => ({
  appReleasesApi: {
    latestAndroid: vi.fn().mockResolvedValue(null),
  },
}));

function renderLogin() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <I18nProvider>
      <AntdLocaleBridge>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </QueryClientProvider>
      </AntdLocaleBridge>
    </I18nProvider>,
  );
}

describe('LoginPage ThemeSwitcher & LanguageSwitcher interactions', () => {
  it('opens theme dropdown and switches data-theme', async () => {
    renderLogin();
    const themeBtn = screen.getByRole('button', { name: /tem|theme/i });
    fireEvent.click(themeBtn);
    const darkItem = await screen.findByRole('menuitem', { name: /tamn|dark/i });
    fireEvent.click(darkItem);
    expect(document.documentElement.dataset.theme).toBe('dark');
  }, 15_000);

  it('opens language dropdown and switches between bs and en', async () => {
    renderLogin();
    const langBtn = screen.getByRole('button', { name: /jezik|language/i });
    fireEvent.click(langBtn);
    const enItem = await screen.findByRole('menuitem', { name: /englesk|english/i });
    fireEvent.click(enItem);
    expect(await screen.findByRole('button', { name: /sign in|login/i })).toBeTruthy();
  }, 15_000);
});
