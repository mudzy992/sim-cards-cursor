import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PhotoCapture } from '../records/PhotoCapture';
import { useI18nStore } from '@/i18n/i18n.store';

describe('PhotoCapture', () => {
  beforeEach(async () => {
    await useI18nStore.getState().setLanguage('bs');
  });

  it('renders thumbnails for local photos and removes local and uploaded items', async () => {
    const onLocal = jest.fn();
    const onUploaded = jest.fn();

    await render(
      <PhotoCapture
        isOnline={true}
        serialNumber="SN-100"
        year="2026"
        uploadedPaths={['/uploads/photo-1.jpg', '/uploads/photo-2.jpg']}
        localUris={['file:///tmp/local-a.jpg']}
        onUploaded={onUploaded}
        onLocal={onLocal}
        loading={false}
        onLoading={jest.fn()}
      />,
    );

    expect(screen.getByTestId('photo-preview-strip')).toBeTruthy();
    expect(screen.getByTestId('photo-local-item-0')).toBeTruthy();
    expect(screen.getByTestId('photo-uploaded-item-0')).toBeTruthy();
    expect(screen.getByText('Poslano 2')).toBeTruthy();
    expect(screen.getByText('Čeka 1')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('photo-remove-local-0'));
    expect(onLocal).toHaveBeenCalledWith([]);

    await fireEvent.press(screen.getByTestId('photo-remove-uploaded-0'));
    expect(onUploaded).toHaveBeenCalledWith(['/uploads/photo-2.jpg']);
  });

  it('switches labels to English when language is set to en', async () => {
    await useI18nStore.getState().setLanguage('en');

    await render(
      <PhotoCapture
        isOnline={false}
        serialNumber="SN-200"
        year="2026"
        uploadedPaths={[]}
        localUris={['file:///tmp/local-b.jpg']}
        onUploaded={jest.fn()}
        onLocal={jest.fn()}
        loading={false}
        onLoading={jest.fn()}
      />,
    );

    expect(screen.getByText('Photos')).toBeTruthy();
    expect(screen.getByText('Uploaded 0')).toBeTruthy();
    expect(screen.getByText('Queued 1')).toBeTruthy();
    expect(screen.getByText('Take photo')).toBeTruthy();
    expect(screen.getByText('Pick from gallery')).toBeTruthy();
  });
});
