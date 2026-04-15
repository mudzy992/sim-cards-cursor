import { UserRole } from '@prisma/client';

export type ScopeContext = {
  role: UserRole;
  distributionId: string | null;
  branchId: string | null;
  branchModeratorBranchIds?: string[];
};

export type ScopeWhereOptions = {
  branchIdField?: string;
  distributionIdField?: string;
  viaMeter?: boolean;
  userScope?: boolean;
  viaShipment?: boolean;
};

/**
 * Returns Prisma where clause for scope filtering.
 * SYSTEM_ADMIN: no filter (sees all)
 * DIST_ADMIN: filter by distributionId (distribution + its branches)
 * USER (operator): filter by branchId; branch moderators see their assigned branches too
 */
export function scopeWhere<T extends Record<string, unknown>>(
  ctx: ScopeContext | null | undefined,
  options: ScopeWhereOptions,
): T | undefined {
  if (!ctx || ctx.role === 'SYSTEM_ADMIN') {
    return undefined;
  }

  if (ctx.role === 'DIST_ADMIN' && ctx.distributionId) {
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
    const modBranches = ctx.branchModeratorBranchIds ?? [];
    const allBranchIds = ctx.branchId
      ? [ctx.branchId, ...modBranches.filter((id) => id !== ctx.branchId)]
      : modBranches;

    if (allBranchIds.length > 1) {
      return buildMultiBranchWhere<T>(allBranchIds, options);
    }
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

function buildMultiBranchWhere<T>(branchIds: string[], options: ScopeWhereOptions): T {
  if (options.branchIdField) {
    return { [options.branchIdField]: { in: branchIds } } as unknown as T;
  }
  if (options.viaMeter) {
    return { meter: { branchId: { in: branchIds } } } as unknown as T;
  }
  if (options.userScope) {
    return { branchId: { in: branchIds } } as unknown as T;
  }
  return { branchId: { in: branchIds } } as unknown as T;
}

export function toScopeContext(user: {
  role: UserRole;
  distributionId?: string | null;
  branchId?: string | null;
  branchModeratorBranchIds?: string[];
} | null): ScopeContext | null {
  if (!user) return null;
  return {
    role: user.role,
    distributionId: user.distributionId ?? null,
    branchId: user.branchId ?? null,
    branchModeratorBranchIds: user.branchModeratorBranchIds ?? [],
  };
}
