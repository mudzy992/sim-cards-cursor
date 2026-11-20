import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PageErrorBoundary } from './PageErrorBoundary';

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test crash');
  }
  return <div>Healthy content</div>;
}

describe('PageErrorBoundary', () => {
  it('renders fallback UI on child error and recovers on resetKey change or home click', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onGoHome = vi.fn();

    const { rerender } = render(
      <PageErrorBoundary resetKey="/test" onGoHome={onGoHome}>
        <Boom shouldThrow />
      </PageErrorBoundary>,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(buttons[1]);
    expect(onGoHome).toHaveBeenCalledTimes(1);

    rerender(
      <PageErrorBoundary resetKey="/test-recovered" onGoHome={onGoHome}>
        <Boom shouldThrow={false} />
      </PageErrorBoundary>,
    );
    expect(screen.getByText('Healthy content')).toBeTruthy();

    consoleSpy.mockRestore();
  });
});
