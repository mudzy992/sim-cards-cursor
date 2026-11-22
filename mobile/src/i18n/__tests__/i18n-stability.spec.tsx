import React, { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { useI18nStore, useTranslation } from '@/i18n/i18n.store';

function ScreenLikeConsumer({ onLoad }: { onLoad: () => void }) {
  const { t } = useTranslation();
  const [label, setLabel] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const load = useCallback(() => {
    setLoading(true);
    onLoad();
    setLabel(t('mobile.common.retry'));
    setLoading(false);
  }, [onLoad, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Text testID="consumer-text">
      {loading ? 'loading' : label}
    </Text>
  );
}

describe('useTranslation reference stability', () => {
  beforeEach(async () => {
    await useI18nStore.getState().setLanguage('bs');
  });

  it('keeps t stable across re-renders so useCallback/useEffect do not loop', async () => {
    const onLoad = jest.fn();

    await render(<ScreenLikeConsumer onLoad={onLoad} />);

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('consumer-text').props.children).toBe(
      'Pokušaj ponovo',
    );

    await act(async () => {
      await useI18nStore.getState().setLanguage('en');
    });

    expect(onLoad).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('consumer-text').props.children).toBe(
      'Try again',
    );
  });
});
