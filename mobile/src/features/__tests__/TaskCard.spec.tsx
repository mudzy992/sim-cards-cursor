import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TaskCard } from '../tasks/TaskCard';
import { useI18nStore } from '@/i18n/i18n.store';

describe('TaskCard', () => {
  beforeEach(async () => {
    await useI18nStore.getState().setLanguage('bs');
  });

  it('displays SLA badge, distance chip, offline banner, and triggers actions', async () => {
    const onNavigate = jest.fn();
    const onPrimary = jest.fn();
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 3_600_000).toISOString();

    await render(
      <TaskCard
        testID="task-card-1"
        title="MET-2026-001"
        status="IN_PROGRESS"
        createdAt={sixDaysAgo}
        createdBy="Admin User"
        note="Provjeriti antenu"
        pendingOffline={true}
        distanceMeters={450}
        onNavigate={onNavigate}
        primaryLabel="Završi ugradnju"
        onPrimary={onPrimary}
        metadata={[{ label: 'Tip brojila', value: 'AMM-GPRS' }]}
      />,
    );

    expect(screen.getByText('MET-2026-001')).toBeTruthy();
    expect(screen.getByText('U toku')).toBeTruthy();
    expect(screen.getByText('Hitno · 6d')).toBeTruthy();
    expect(screen.getByText('450 m')).toBeTruthy();
    expect(screen.getByText('Navigacija')).toBeTruthy();
    expect(screen.getByText('Promjena čeka slanje')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('task-navigate-btn'));
    expect(onNavigate).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId('task-primary-btn'));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it('translates status and navigation labels in English mode', async () => {
    await useI18nStore.getState().setLanguage('en');
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3_600_000).toISOString();

    await render(
      <TaskCard
        title="MET-EN-002"
        status="PENDING"
        createdAt={threeDaysAgo}
        pendingOffline={true}
        onNavigate={jest.fn()}
      />,
    );

    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('SLA · 3d')).toBeTruthy();
    expect(screen.getByText('Navigate')).toBeTruthy();
    expect(screen.getByText('Change pending sync')).toBeTruthy();
  });
});
