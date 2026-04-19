import type { UserRole } from '@/types/auth.types'
import type { UserStatus } from '@/types/user.types'
import type { SimCardStatus } from '@/types/sim-card.types'

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

