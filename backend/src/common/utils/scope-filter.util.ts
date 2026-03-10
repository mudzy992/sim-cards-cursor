import { UserRole } from '@prisma/client';

export type ScopeContext = {
  role: UserRole;
  distributionId: string | null;
  branchId: string | null;
};

/**
 * Returns Prisma where clause for scope filtering.
 * SYSTEM_ADMIN: no filter (sees all)
 * MODERATOR: filter by distributionId (distribution + its branches)
 * USER (operator): filter by branchId
 */
export function scopeWhere<T extends Record<string, unknown>>(
  ctx: ScopeContext | null | undefined,
  options: {
    /** For entities with direct branchId (Meter) */
    branchIdField?: string;
    /** For entities with direct distributionId (Shipment, User) */
    distributionIdField?: string;
    /** For entities linked via meter (InstallationRecord, DemountTask) - use meter.branchId */
    viaMeter?: boolean;
    /** For User entity - moderator sees users in their distribution; operator sees users in their branch */
    userScope?: boolean;
    /** For SimCard - scope via shipment.distributionId */
    viaShipment?: boolean;
  },
): T | undefined {
  if (!ctx || ctx.role === 'SYSTEM_ADMIN') {
    return undefined;
  }

  if (ctx.role === 'MODERATOR' && ctx.distributionId) {
    if (options.distributionIdField) {
      return { [options.distributionIdField]: ctx.distributionId } as unknown as T;
    }
    if (options.branchIdField) {
      return { branch: { distributionId: ctx.distributionId } } as unknown as T;
    }
    if (options.viaMeter) {
      return { meter: { branch: { distributionId: ctx.distributionId } } } as unknown as T;
    }
    if (options.userScope) {
      return {
        OR: [
          { distributionId: ctx.distributionId },
          { branch: { distributionId: ctx.distributionId } },
        ],
      } as unknown as T;
    }
    if (options.viaShipment) {
      return { shipment: { distributionId: ctx.distributionId } } as unknown as T;
    }
  }

  if (ctx.role === 'USER' && (ctx.branchId || ctx.distributionId)) {
    if (options.branchIdField) {
      return { [options.branchIdField]: ctx.branchId } as unknown as T;
    }
    if (options.distributionIdField) {
      return undefined;
    }
    if (options.viaMeter) {
      return { meter: { branchId: ctx.branchId } } as unknown as T;
    }
    if (options.userScope) {
      return { branchId: ctx.branchId } as unknown as T;
    }
    if (options.viaShipment && ctx.distributionId) {
      return { shipment: { distributionId: ctx.distributionId } } as unknown as T;
    }
  }

  return undefined;
}

export function toScopeContext(user: {
  role: UserRole;
  distributionId?: string | null;
  branchId?: string | null;
} | null): ScopeContext | null {
  if (!user) return null;
  return {
    role: user.role,
    distributionId: user.distributionId ?? null,
    branchId: user.branchId ?? null,
  };
}
