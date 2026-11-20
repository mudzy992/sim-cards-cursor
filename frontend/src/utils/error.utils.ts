import type { AxiosError } from 'axios';
import type { ApiEnvelope } from '@/types/common.types';
import { translateCurrent } from '@/i18n/standalone';

type ApiErrorEnvelope<T = unknown> = ApiEnvelope<T> & {
  message?: string | string[];
  errorCode?: string;
  details?: unknown;
};

const KNOWN_ERROR_CODE_KEYS: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: 'errors.codes.AUTH_INVALID_CREDENTIALS',
  AUTH_INVALID_REFRESH_TOKEN: 'errors.codes.AUTH_INVALID_REFRESH_TOKEN',
  AUTH_EMAIL_IN_USE: 'errors.codes.AUTH_EMAIL_IN_USE',
  PRISMA_UNIQUE_CONFLICT: 'errors.codes.PRISMA_UNIQUE_CONFLICT',
  PRISMA_RECORD_NOT_FOUND: 'errors.codes.PRISMA_RECORD_NOT_FOUND',
  PRISMA_FOREIGN_KEY_VIOLATION: 'errors.codes.PRISMA_FOREIGN_KEY_VIOLATION',
  PRISMA_RELATION_VIOLATION: 'errors.codes.PRISMA_RELATION_VIOLATION',

  USER_NOT_FOUND: 'errors.codes.USER_NOT_FOUND',
  USER_EMAIL_EXISTS: 'errors.codes.USER_EMAIL_EXISTS',
  USER_CANNOT_MODIFY_SYSTEM_ADMIN: 'errors.codes.USER_CANNOT_MODIFY_SYSTEM_ADMIN',
  USER_CANNOT_ASSIGN_SYSTEM_ADMIN: 'errors.codes.USER_CANNOT_ASSIGN_SYSTEM_ADMIN',
  USER_CANNOT_REASSIGN_DISTRIBUTION: 'errors.codes.USER_CANNOT_REASSIGN_DISTRIBUTION',
  USER_BRANCH_OUTSIDE_DISTRIBUTION: 'errors.codes.USER_BRANCH_OUTSIDE_DISTRIBUTION',

  SHIPMENT_NOT_FOUND: 'errors.codes.SHIPMENT_NOT_FOUND',
  SHIPMENT_DISTRIBUTION_MISSING: 'errors.codes.SHIPMENT_DISTRIBUTION_MISSING',
  SHIPMENT_REASSIGN_FORBIDDEN: 'errors.codes.SHIPMENT_REASSIGN_FORBIDDEN',
  SHIPMENT_FILE_REQUIRED: 'errors.codes.SHIPMENT_FILE_REQUIRED',

  SIM_NOT_FOUND: 'errors.codes.SIM_NOT_FOUND',
  SIM_DUPLICATE_ICCID: 'errors.codes.SIM_DUPLICATE_ICCID',
  SIM_DUPLICATE_IP: 'errors.codes.SIM_DUPLICATE_IP',
  SIM_DUPLICATE_PUBLIC_IP: 'errors.codes.SIM_DUPLICATE_PUBLIC_IP',
  SIM_DUPLICATE_PHONE: 'errors.codes.SIM_DUPLICATE_PHONE',
  SIM_DELETE_INSTALLED_FORBIDDEN: 'errors.codes.SIM_DELETE_INSTALLED_FORBIDDEN',
  SIM_ALREADY_CLAIMED_OR_UNAVAILABLE: 'errors.codes.SIM_ALREADY_CLAIMED_OR_UNAVAILABLE',
  SIM_NOT_ASSIGNED: 'errors.codes.SIM_NOT_ASSIGNED',
  SIM_USER_OUTSIDE_SCOPE: 'errors.codes.SIM_USER_OUTSIDE_SCOPE',

  METER_NOT_FOUND: 'errors.codes.METER_NOT_FOUND',
  METER_BRANCH_NOT_FOUND: 'errors.codes.METER_BRANCH_NOT_FOUND',
  METER_BRANCH_OUTSIDE_DISTRIBUTION: 'errors.codes.METER_BRANCH_OUTSIDE_DISTRIBUTION',
  METER_INSTALLED_WITHOUT_PROCESS: 'errors.codes.METER_INSTALLED_WITHOUT_PROCESS',
  METER_INACTIVE_FOR_SIM: 'errors.codes.METER_INACTIVE_FOR_SIM',
  METER_HAS_RECORDS_CANNOT_DELETE: 'errors.codes.METER_HAS_RECORDS_CANNOT_DELETE',

  INSTALL_TASK_NOT_FOUND: 'errors.codes.INSTALL_TASK_NOT_FOUND',
  INSTALL_TASK_ALREADY_ACTIVE: 'errors.codes.INSTALL_TASK_ALREADY_ACTIVE',
  INSTALL_TASK_METER_HAS_SIM: 'errors.codes.INSTALL_TASK_METER_HAS_SIM',
  INSTALL_TASK_METER_INACTIVE: 'errors.codes.INSTALL_TASK_METER_INACTIVE',
  INSTALL_TASK_ALREADY_COMPLETED: 'errors.codes.INSTALL_TASK_ALREADY_COMPLETED',
  INSTALL_TASK_ALREADY_CANCELLED: 'errors.codes.INSTALL_TASK_ALREADY_CANCELLED',
  INSTALL_TASK_MUST_BE_IN_PROGRESS: 'errors.codes.INSTALL_TASK_MUST_BE_IN_PROGRESS',
  INSTALL_TASK_CONCURRENT_CONFLICT: 'errors.codes.INSTALL_TASK_CONCURRENT_CONFLICT',

  DEMOUNT_TASK_NOT_FOUND: 'errors.codes.DEMOUNT_TASK_NOT_FOUND',
  DEMOUNT_TASK_ALREADY_ACTIVE: 'errors.codes.DEMOUNT_TASK_ALREADY_ACTIVE',
  DEMOUNT_TASK_NO_SIM: 'errors.codes.DEMOUNT_TASK_NO_SIM',
  DEMOUNT_TASK_METER_INACTIVE: 'errors.codes.DEMOUNT_TASK_METER_INACTIVE',
  DEMOUNT_TASK_MUST_BE_IN_PROGRESS: 'errors.codes.DEMOUNT_TASK_MUST_BE_IN_PROGRESS',
  DEMOUNT_TASK_NEW_SIM_REQUIRED: 'errors.codes.DEMOUNT_TASK_NEW_SIM_REQUIRED',
  DEMOUNT_TASK_NEW_SIM_SAME_AS_OLD: 'errors.codes.DEMOUNT_TASK_NEW_SIM_SAME_AS_OLD',
  DEMOUNT_TASK_NEW_SIM_UNAVAILABLE: 'errors.codes.DEMOUNT_TASK_NEW_SIM_UNAVAILABLE',
  DEMOUNT_TASK_FIELD_LOCKED: 'errors.codes.DEMOUNT_TASK_FIELD_LOCKED',
  DEMOUNT_TASK_CONCURRENT_CONFLICT: 'errors.codes.DEMOUNT_TASK_CONCURRENT_CONFLICT',

  TASK_OPERATOR_NOT_FOUND: 'errors.codes.TASK_OPERATOR_NOT_FOUND',
  TASK_ASSIGNEE_NOT_OPERATOR: 'errors.codes.TASK_ASSIGNEE_NOT_OPERATOR',
  TASK_ASSIGNEE_OUTSIDE_DISTRIBUTION: 'errors.codes.TASK_ASSIGNEE_OUTSIDE_DISTRIBUTION',
  TASK_ONLY_INITIATOR_CAN_CANCEL: 'errors.codes.TASK_ONLY_INITIATOR_CAN_CANCEL',
  TASK_ONLY_INITIATOR_CAN_REASSIGN: 'errors.codes.TASK_ONLY_INITIATOR_CAN_REASSIGN',
  TASK_ONLY_ASSIGNEE_CAN_UPDATE: 'errors.codes.TASK_ONLY_ASSIGNEE_CAN_UPDATE',
};

export function getApiErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  const maybeAxiosError = error as AxiosError<ApiErrorEnvelope>;

  if (maybeAxiosError?.isAxiosError) {
    const response = maybeAxiosError.response;
    const data = response?.data;

    if (data?.errorCode && data.errorCode in KNOWN_ERROR_CODE_KEYS) {
      return translateCurrent(KNOWN_ERROR_CODE_KEYS[data.errorCode]);
    }

    if (data) {
      if (typeof data.message === 'string' && data.message.trim().length > 0) {
        return data.message;
      }
      if (Array.isArray(data.message) && data.message.length > 0) {
        const firstMsg = data.message.find((m) => typeof m === 'string' && m.trim().length > 0);
        if (firstMsg) return firstMsg;
      }
    }

    if (!response) {
      return translateCurrent('common.messages.networkError');
    }

    if (response.status === 401) {
      return translateCurrent('common.messages.sessionExpired');
    }

    if (response.status >= 500) {
      return translateCurrent('common.messages.genericError');
    }
  }

  return fallbackMessage;
}
