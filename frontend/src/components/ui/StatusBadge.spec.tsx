import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge';
import {
  getActivityActionTone,
  getMeterStatusTone,
  getRecordStatusTone,
  getShipmentStatusTone,
  getSimCardStatusTone,
  getTaskStatusTone,
  getUserRoleTone,
  getUserStatusTone,
} from './status-tone';

describe('StatusBadge', () => {
  it('renders label with semantic tone classes and optional mono font', () => {
    render(<StatusBadge tone="success" label="Aktivno" mono />);
    const text = screen.getByText('Aktivno');
    const badge = text.closest('span.inline-flex');
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain('bg-status-success-bg');
    expect(badge?.className).toContain('text-status-success-fg');
    expect(badge?.className).toContain('font-mono');
  });

  it('maps domain enums to consistent semantic tones', () => {
    expect(getSimCardStatusTone('AVAILABLE')).toBe('success');
    expect(getSimCardStatusTone('DEFECTIVE')).toBe('danger');
    expect(getMeterStatusTone('IN_CALIBRATION')).toBe('warning');
    expect(getTaskStatusTone('IN_PROGRESS')).toBe('info');
    expect(getShipmentStatusTone('COMPLETED')).toBe('success');
    expect(getRecordStatusTone('SEND_FAILED')).toBe('danger');
    expect(getUserRoleTone('SYSTEM_ADMIN')).toBe('danger');
    expect(getUserStatusTone('ACTIVE')).toBe('success');
    expect(getActivityActionTone('DELETE')).toBe('danger');
  });
});
