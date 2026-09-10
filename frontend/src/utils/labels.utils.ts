import type { TranslateOptions } from '@/i18n/core'
import type { UserRole } from '@/types/auth.types'
import type { UserStatus } from '@/types/user.types'
import type { SimCardStatus } from '@/types/sim-card.types'
import type { MeterStatus } from '@/types/meter.types'

/**
 * All functions below return a display label for a status/role/action enum
 * value. They require a `t` translate function (from `useTranslation()`) so
 * the label is rendered in the currently active language. Each function
 * resolves to a stable i18n key under `labels.*` in
 * `frontend/src/i18n/locales/{bs,en}.ts`.
 */
type TFn = (key: string, options?: TranslateOptions) => string

export const getUserRoleLabel = (role: UserRole, t: TFn): string => {
  if (role === 'SYSTEM_ADMIN') return t('labels.userRole.systemAdmin')
  if (role === 'DIST_ADMIN') return t('labels.userRole.distAdmin')
  return t('labels.userRole.operator')
}

export const getUserStatusLabel = (status: UserStatus, t: TFn): string => {
  if (status === 'ACTIVE') return t('labels.userStatus.active')
  if (status === 'INACTIVE') return t('labels.userStatus.inactive')
  return t('labels.userStatus.suspended')
}

export const getSimCardStatusLabel = (status: SimCardStatus, t: TFn): string => {
  if (status === 'AVAILABLE') return t('labels.simCardStatus.available')
  if (status === 'ASSIGNED') return t('labels.simCardStatus.assigned')
  if (status === 'INSTALLED') return t('labels.simCardStatus.installed')
  if (status === 'DEFECTIVE') return t('labels.simCardStatus.defective')
  if (status === 'DEMOUNTED') return t('labels.simCardStatus.demounted')
  if (status === 'RETURNED') return t('labels.simCardStatus.returned')
  return t('labels.simCardStatus.deactivated')
}

export const getSimEventTypeLabel = (type: string, t: TFn): string => {
  const map: Record<string, string> = {
    CREATED: 'labels.simEventType.created',
    CLAIMED: 'labels.simEventType.claimed',
    ASSIGNED: 'labels.simEventType.assigned',
    UNASSIGNED: 'labels.simEventType.unassigned',
    INSTALLED: 'labels.simEventType.installed',
    DEMOUNTED: 'labels.simEventType.demounted',
    SENT: 'labels.simEventType.sent',
  }
  if (map[type]) return t(map[type])
  if (type.startsWith('STATUS_')) {
    return t('labels.simEventType.statusChange', { status: type.replace('STATUS_', '') })
  }
  return type
}

export const getDemountResolutionLabel = (resolution: string, t: TFn): string => {
  const map: Record<string, string> = {
    FULL_DEMOUNT: 'labels.demountResolution.fullDemount',
    REPLACE_SIM: 'labels.demountResolution.replaceSim',
    REMOVE_SIM_ONLY: 'labels.demountResolution.removeSimOnly',
  }
  return map[resolution] ? t(map[resolution]) : resolution
}

export const getMeterDemountCategoryLabel = (cat: string, t: TFn): string => {
  const map: Record<string, string> = {
    METER_FAULTY: 'labels.meterDemountCategory.meterFaulty',
    TEMPORARY_REMOVAL: 'labels.meterDemountCategory.temporaryRemoval',
    MAINTENANCE: 'labels.meterDemountCategory.maintenance',
    OTHER: 'labels.meterDemountCategory.other',
  }
  return map[cat] ? t(map[cat]) : cat
}

export const getRemovedSimDispositionLabel = (d: string, t: TFn): string => {
  const map: Record<string, string> = {
    MARK_DEFECTIVE: 'labels.removedSimDisposition.markDefective',
    RETURN_TO_STOCK: 'labels.removedSimDisposition.returnToStock',
  }
  return map[d] ? t(map[d]) : d
}

export const getMeterStatusLabel = (status: MeterStatus, t: TFn): string => {
  if (status === 'ACTIVE') return t('labels.meterStatus.active')
  if (status === 'DEFECTIVE') return t('labels.meterStatus.defective')
  if (status === 'IN_CALIBRATION') return t('labels.meterStatus.inCalibration')
  return t('labels.meterStatus.inactive')
}

export const getActivityLogActionLabel = (action: string, t: TFn): string => {
  const map: Record<string, string> = {
    CREATE: 'labels.activityLogAction.create',
    UPDATE: 'labels.activityLogAction.update',
    DELETE: 'labels.activityLogAction.delete',
    SEND: 'labels.activityLogAction.send',
    SEND_FAILED: 'labels.activityLogAction.sendFailed',
    MARK_SEP_ACTIVATED: 'labels.activityLogAction.markSepActivated',
    STATUS_CHANGE: 'labels.activityLogAction.statusChange',
    CLAIM: 'labels.activityLogAction.claim',
    ASSIGN: 'labels.activityLogAction.assign',
    UNASSIGN: 'labels.activityLogAction.unassign',
  }
  return map[action] ? t(map[action]) : action
}
