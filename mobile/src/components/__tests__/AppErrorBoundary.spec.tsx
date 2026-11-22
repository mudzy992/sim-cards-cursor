import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppErrorBoundary } from '../common/AppErrorBoundary';
import { useI18nStore } from '@/i18n/i18n.store';

function ThrowingChild({ shouldThrow }: { shouldThrow: { current: boolean } }) {
  if (shouldThrow.current) {
    throw new Error('Test render failure');
  }
  return <Text testID="recovered-child">Recovered OK</Text>;
}

describe('AppErrorBoundary', () => {
  beforeEach(async () => {
    await useI18nStore.getState().setLanguage('bs');
  });

  it('catches render errors, shows translated fallback, and recovers on retry', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const shouldThrow = { current: true };

    function Wrapper() {
      return (
        <AppErrorBoundary
          onReset={() => {
            shouldThrow.current = false;
          }}
        >
          <ThrowingChild shouldThrow={shouldThrow} />
        </AppErrorBoundary>
      );
    }

    await render(<Wrapper />);

    expect(screen.getByTestId('error-boundary-screen')).toBeTruthy();
    expect(screen.getByText('Neočekivana greška')).toBeTruthy();
    expect(screen.getByText('Test render failure')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('error-boundary-retry'));

    expect(screen.getByTestId('recovered-child')).toBeTruthy();
    expect(screen.getByText('Recovered OK')).toBeTruthy();
    consoleSpy.mockRestore();
  });

  it('renders English fallback text when language is switched to en', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await useI18nStore.getState().setLanguage('en');

    await render(
      <AppErrorBoundary>
        <ThrowingChild shouldThrow={{ current: true }} />
      </AppErrorBoundary>,
    );

    expect(screen.getByText('Unexpected error')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
    consoleSpy.mockRestore();
  });
});
