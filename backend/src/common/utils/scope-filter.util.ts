import { UserRole } from '@prisma/client';

export type ScopeContext = {
  userId?: string;
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
 * Returns a fail-closed empty result filter (`WHERE 1=0` in Prisma SQL)
 * when a scoped role lacks the required tenant/branch context.
 */
function failClosedWhere<T>(options: ScopeWhereOptions): T {
  if (options.distributionIdField) {
    return { [options.distributionIdField]: { in: [] } } as unknown as T;
  }
  if (options.branchIdField) {
    return { [options.branchIdField]: { in: [] } } as unknown as T;
  }
  if (options.viaMeter) {
    return { meter: { branchId: { in: [] } } } as unknown as T;
  }
  if (options.viaShipment) {
    return { shipment: { distributionId: { in: [] } } } as unknown as T;
  }
  return { id: { in: [] } } as unknown as T;
}

/**
 * Returns Prisma where clause for scope filtering.
 * SYSTEM_ADMIN: no filter (sees all)
 * DIST_ADMIN: filter by distributionId (distribution + its branches) — fail-closed if missing
 * USER (operator): filter by branchId + branchModeratorBranchIds — fail-closed if missing
 */
export function scopeWhere<T extends Record<string, unknown>>(
  ctx: ScopeContext | null | undefined,
  options: ScopeWhereOptions,
): T | undefined {
  if (!ctx) {
    return failClosedWhere<T>(options);
  }

  if (ctx.role === UserRole.SYSTEM_ADMIN) {
    return undefined;
  }

  if (ctx.role === UserRole.DIST_ADMIN) {
    if (!ctx.distributionId) {
      return failClosedWhere<T>(options);
    }
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
    return failClosedWhere<T>(options);
  }

  if (ctx.role === UserRole.USER) {
    const modBranches = ctx.branchModeratorBranchIds ?? [];
    const allBranchIds = Array.from(
      new Set([...(ctx.branchId ? [ctx.branchId] : []), ...modBranches]),
    );

    if (options.distributionIdField) {
      if (ctx.distributionId) {
        return { [options.distributionIdField]: ctx.distributionId } as unknown as T;
      }
      return failClosedWhere<T>(options);
    }

    if (options.viaShipment) {
      if (ctx.distributionId) {
        return { shipment: { distributionId: ctx.distributionId } } as unknown as T;
      }
      if (allBranchIds.length > 0) {
        return {
          meter: {
            branchId: allBranchIds.length === 1 ? allBranchIds[0] : { in: allBranchIds },
          },
        } as unknown as T;
      }
      return failClosedWhere<T>(options);
    }

    if (allBranchIds.length === 0) {
      return failClosedWhere<T>(options);
    }

    const branchMatch = allBranchIds.length === 1 ? allBranchIds[0] : { in: allBranchIds };

    if (options.branchIdField) {
      return { [options.branchIdField]: branchMatch } as unknown as T;
    }
    if (options.viaMeter) {
      return { meter: { branchId: branchMatch } } as unknown as T;
    }
    if (options.userScope) {
      return { branchId: branchMatch } as unknown as T;
    }

    return failClosedWhere<T>(options);
  }

  return failClosedWhere<T>(options);
}

export function simCardScopeWhere<T extends Record<string, unknown>>(
  ctx: ScopeContext | null | undefined,
): T | undefined {
  if (!ctx) {
    return { id: { in: [] } } as unknown as T;
  }

  if (ctx.role === UserRole.SYSTEM_ADMIN) {
    return undefined;
  }

  if (ctx.role === UserRole.DIST_ADMIN) {
    if (!ctx.distributionId) {
      return { id: { in: [] } } as unknown as T;
    }
    return { shipment: { distributionId: ctx.distributionId } } as unknown as T;
  }

  if (ctx.role === UserRole.USER) {
    const modBranches = ctx.branchModeratorBranchIds ?? [];
    const allBranchIds = Array.from(
      new Set([...(ctx.branchId ? [ctx.branchId] : []), ...modBranches]),
    );

    if (modBranches.length > 0 && allBranchIds.length > 0) {
      const branchMatch =
        allBranchIds.length === 1 ? allBranchIds[0] : { in: allBranchIds };
      return {
        OR: [
          { meter: { branchId: branchMatch } },
          { assignedTo: { branchId: branchMatch } },
        ],
      } as unknown as T;
    }

    if (ctx.userId) {
      return { assignedToId: ctx.userId } as unknown as T;
    }

    if (allBranchIds.length > 0) {
      return {
        meter: {
          branchId: allBranchIds.length === 1 ? allBranchIds[0] : { in: allBranchIds },
        },
      } as unknown as T;
    }

    return { id: { in: [] } } as unknown as T;
  }

  return { id: { in: [] } } as unknown as T;
}

export function isScopedAdminOrModerator(
  ctx: ScopeContext | null | undefined,
): boolean {
  if (!ctx) return false;
  if (ctx.role === UserRole.SYSTEM_ADMIN || ctx.role === UserRole.DIST_ADMIN) {
    return true;
  }
  if (ctx.role === UserRole.USER) {
    return (ctx.branchModeratorBranchIds?.length ?? 0) > 0;
  }
  return false;
}

export function toScopeContext(
  user: {
    id?: string;
    role: UserRole;
    distributionId?: string | null;
    branchId?: string | null;
    branchModeratorBranchIds?: string[];
  } | null,
): ScopeContext | null {
  if (!user) return null;
  return {
    userId: user.id,
    role: user.role,
    distributionId: user.distributionId ?? null,
    branchId: user.branchId ?? null,
    branchModeratorBranchIds: user.branchModeratorBranchIds ?? [],
  };
}
