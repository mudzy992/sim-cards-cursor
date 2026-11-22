jest.mock('react-native', () => ({
  Appearance: { getColorScheme: jest.fn(() => 'light') },
  Platform: {
    OS: 'android',
    select: (obj: Record<string, unknown>) => obj.android ?? obj.default,
  },
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

import { buildThemeColors, colorThemes } from '@/theme/colors';
import { palettes, typographyThemes } from '@/theme/tokens';
import { useThemeStore } from '@/store/theme.store';

describe('Dual light/dark daylight theme tokens & store', () => {
  it('defines matching color & palette keys for light and dark schemes', () => {
    expect(Object.keys(colorThemes.light).sort()).toEqual(
      Object.keys(colorThemes.dark).sort(),
    );
    expect(Object.keys(palettes.light).sort()).toEqual(
      Object.keys(palettes.dark).sort(),
    );
    expect(buildThemeColors('light').background).not.toBe(
      buildThemeColors('dark').background,
    );
    expect(typographyThemes.light.body.color).toBe(palettes.light.textPrimary);
    expect(typographyThemes.dark.body.color).toBe(palettes.dark.textPrimary);
  });

  it('resolves explicit preference over system scheme in theme store', async () => {
    await useThemeStore.getState().setMode('light');
    useThemeStore.getState().syncSystemScheme('dark');
    expect(useThemeStore.getState().resolvedScheme).toBe('light');

    await useThemeStore.getState().setMode('system');
    expect(useThemeStore.getState().resolvedScheme).toBe('dark');

    useThemeStore.getState().syncSystemScheme('light');
    expect(useThemeStore.getState().resolvedScheme).toBe('light');
  });
});
