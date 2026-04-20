import type { UserRole } from '@/types/auth.types'
import type { UserStatus } from '@/types/user.types'
import type { SimCardStatus } from '@/types/sim-card.types'
import type { MeterStatus } from '@/types/meter.types'

export const getUserRoleLabel = (role: UserRole): string => {
  if (role === 'SYSTEM_ADMIN') return 'Sistemski administrator'
  if (role === 'DIST_ADMIN') return 'Distribucijski admin'
  return 'Operator'
}

export const getUserStatusLabel = (status: UserStatus): string => {
  if (status === 'ACTIVE') return 'Aktivan'
  if (status === 'INACTIVE') return 'Neaktivan'
  return 'Suspendovan'
}

export const getSimCardStatusLabel = (status: SimCardStatus): string => {
  if (status === 'AVAILABLE') return 'Dostupna'
  if (status === 'ASSIGNED') return 'Dodijeljena'
  if (status === 'INSTALLED') return 'Instalirana'
  if (status === 'DEFECTIVE') return 'Neispravna'
  if (status === 'DEMOUNTED') return 'Demontirana'
  if (status === 'RETURNED') return 'Vraćena'
  return 'Deaktivirana'
}

export const getSimEventTypeLabel = (type: string): string => {
  const map: Record<string, string> = {
    CREATED: 'Kreirano u sistemu',
    CLAIMED: 'Zadužena od strane operatera',
    ASSIGNED: 'Dodijeljena korisniku',
    UNASSIGNED: 'Uklonjena dodjela',
    INSTALLED: 'Ugrađena u brojilo',
    DEMOUNTED: 'Demontirana / uklonjena sa brojila',
    SENT: 'Zapisnik poslan (e-pošta)',
  }
  if (map[type]) return map[type]
  if (type.startsWith('STATUS_')) {
    return `Promjena statusa (${type.replace('STATUS_', '')})`
  }
  return type
}

export const getDemountResolutionLabel = (resolution: string): string => {
  const map: Record<string, string> = {
    FULL_DEMOUNT: 'Potpuna demontaža',
    REPLACE_SIM: 'Zamjena SIM-a',
    REMOVE_SIM_ONLY: 'Demontaža SIM-a (bez zamjene)',
  }
  return map[resolution] ?? resolution
}

export const getMeterDemountCategoryLabel = (cat: string): string => {
  const map: Record<string, string> = {
    METER_FAULTY: 'Brojilo neispravno',
    TEMPORARY_REMOVAL: 'Privremeno demontirano',
    MAINTENANCE: 'Servis / održavanje',
    OTHER: 'Ostalo',
  }
  return map[cat] ?? cat
}

export const getRemovedSimDispositionLabel = (d: string): string => {
  const map: Record<string, string> = {
    MARK_DEFECTIVE: 'Uklonjena SIM neispravna',
    RETURN_TO_STOCK: 'Uklonjena SIM vraćena u zalihe',
  }
  return map[d] ?? d
}

export const getMeterStatusLabel = (status: MeterStatus): string => {
  if (status === 'ACTIVE') return 'Aktivno'
  if (status === 'DEFECTIVE') return 'Neispravno'
  if (status === 'IN_CALIBRATION') return 'Na baždarenju / servis'
  return 'Neaktivno'
}

export const getActivityLogActionLabel = (action: string): string => {
  const map: Record<string, string> = {
    CREATE: 'Kreirano',
    UPDATE: 'Ažurirano',
    DELETE: 'Obrisano',
    SEND: 'Poslano',
    SEND_FAILED: 'Neuspješno slanje',
    MARK_SEP_ACTIVATED: 'SEP aktiviran',
    STATUS_CHANGE: 'Promjena statusa',
    CLAIM: 'Zaduživanje',
    ASSIGN: 'Dodjela',
    UNASSIGN: 'Oduzimanje dodjele',
  }
  return map[action] ?? action
}

