export type StatusTone = 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger';

export function getSimCardStatusTone(status: string): StatusTone {
  switch (status) {
    case 'AVAILABLE':
      return 'success';
    case 'ASSIGNED':
      return 'info';
    case 'INSTALLED':
      return 'accent';
    case 'DEFECTIVE':
      return 'danger';
    case 'DEMOUNTED':
    case 'RETURNED':
      return 'warning';
    case 'DEACTIVATED':
    default:
      return 'neutral';
  }
}

export function getMeterStatusTone(status: string): StatusTone {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'IN_CALIBRATION':
      return 'warning';
    case 'DEFECTIVE':
      return 'danger';
    case 'INACTIVE':
    default:
      return 'neutral';
  }
}

export function getTaskStatusTone(status: string): StatusTone {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'IN_PROGRESS':
      return 'info';
    case 'PENDING':
      return 'warning';
    case 'CANCELLED':
    default:
      return 'neutral';
  }
}

export function getShipmentStatusTone(status: string): StatusTone {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'PROCESSING':
      return 'info';
    case 'RECEIVED':
    default:
      return 'warning';
  }
}

export function getRecordStatusTone(status: string): StatusTone {
  switch (status) {
    case 'SEP_ACTIVATED':
      return 'success';
    case 'SENT':
      return 'info';
    case 'SEND_FAILED':
      return 'danger';
    case 'DRAFT':
      return 'warning';
    case 'LEGACY_COMPLETED':
    default:
      return 'neutral';
  }
}

export function getUserRoleTone(role: string): StatusTone {
  switch (role) {
    case 'SYSTEM_ADMIN':
      return 'danger';
    case 'DIST_ADMIN':
      return 'accent';
    case 'USER':
    default:
      return 'info';
  }
}

export function getUserStatusTone(status: string): StatusTone {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'SUSPENDED':
      return 'danger';
    case 'INACTIVE':
    default:
      return 'neutral';
  }
}

export function getActivityActionTone(action: string): StatusTone {
  switch (action) {
    case 'CREATE':
    case 'MARK_SEP_ACTIVATED':
    case 'CLAIM':
      return 'success';
    case 'SEND':
    case 'ASSIGN':
    case 'UPDATE':
      return 'info';
    case 'STATUS_CHANGE':
    case 'UNASSIGN':
      return 'warning';
    case 'DELETE':
    case 'SEND_FAILED':
      return 'danger';
    default:
      return 'neutral';
  }
}
