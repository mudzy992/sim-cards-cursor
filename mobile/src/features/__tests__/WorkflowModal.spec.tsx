import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { WorkflowModal } from '../tasks/WorkflowModal';
import { useI18nStore } from '@/i18n/i18n.store';

describe('WorkflowModal', () => {
  beforeEach(async () => {
    await useI18nStore.getState().setLanguage('bs');
  });

  it('renders title, subtitle, children, footer, and calls onClose when closed', async () => {
    const onClose = jest.fn();

    await render(
      <WorkflowModal
        visible={true}
        title="Završi ugradnju"
        subtitle="MET-2026-009"
        onClose={onClose}
        footer={<Text testID="modal-footer-text">Potvrdi</Text>}
      >
        <Text testID="modal-body-text">Unesite podatke brojila</Text>
      </WorkflowModal>,
    );

    expect(screen.getByText('Završi ugradnju')).toBeTruthy();
    expect(screen.getByText('MET-2026-009')).toBeTruthy();
    expect(screen.getByTestId('modal-body-text')).toBeTruthy();
    expect(screen.getByTestId('modal-footer-text')).toBeTruthy();
    expect(screen.getByLabelText('Zatvori')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('workflow-modal-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses English close accessibility label when language is set to en', async () => {
    await useI18nStore.getState().setLanguage('en');

    await render(
      <WorkflowModal visible={true} title="Complete install" onClose={jest.fn()}>
        <Text>Body</Text>
      </WorkflowModal>,
    );

    expect(screen.getByLabelText('Close')).toBeTruthy();
  });
});
