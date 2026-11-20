import { UserRole } from '@prisma/client';
import { scopeWhere } from './scope-filter.util';

describe('scopeWhere (tenant & RBAC fail-closed)', () => {
  it('returns undefined (unfiltered) for SYSTEM_ADMIN', () => {
    expect(
      scopeWhere(
        { role: UserRole.SYSTEM_ADMIN, distributionId: null, branchId: null },
        { branchIdField: 'branchId' },
      ),
    ).toBeUndefined();
  });

  it('fails closed when ctx is null or undefined', () => {
    expect(scopeWhere(null, { branchIdField: 'branchId' })).toEqual({
      branchId: { in: [] },
    });
    expect(scopeWhere(undefined, { distributionIdField: 'distributionId' })).toEqual({
      distributionId: { in: [] },
    });
  });

  it('fails closed when DIST_ADMIN lacks distributionId', () => {
    expect(
      scopeWhere(
        { role: UserRole.DIST_ADMIN, distributionId: null, branchId: null },
        { distributionIdField: 'distributionId' },
      ),
    ).toEqual({ distributionId: { in: [] } });

    expect(
      scopeWhere(
        { role: UserRole.DIST_ADMIN, distributionId: null, branchId: null },
        { userScope: true },
      ),
    ).toEqual({ id: { in: [] } });
  });

  it('scopes DIST_ADMIN with distributionId', () => {
    expect(
      scopeWhere(
        { role: UserRole.DIST_ADMIN, distributionId: 'dist-1', branchId: null },
        { distributionIdField: 'distributionId' },
      ),
    ).toEqual({ distributionId: 'dist-1' });
  });

  it('uses single branchModeratorBranchIds when USER has null branchId', () => {
    expect(
      scopeWhere(
        {
          role: UserRole.USER,
          distributionId: null,
          branchId: null,
          branchModeratorBranchIds: ['branch-mod-1'],
        },
        { branchIdField: 'branchId' },
      ),
    ).toEqual({ branchId: 'branch-mod-1' });
  });

  it('fails closed when USER has no branchId, no moderator branches, and no distributionId', () => {
    expect(
      scopeWhere(
        {
          role: UserRole.USER,
          distributionId: null,
          branchId: null,
          branchModeratorBranchIds: [],
        },
        { viaMeter: true },
      ),
    ).toEqual({ meter: { branchId: { in: [] } } });
  });

  it('scopes USER with distributionIdField instead of leaking undefined', () => {
    expect(
      scopeWhere(
        {
          role: UserRole.USER,
          distributionId: 'dist-1',
          branchId: 'branch-1',
        },
        { distributionIdField: 'distributionId' },
      ),
    ).toEqual({ distributionId: 'dist-1' });

    expect(
      scopeWhere(
        {
          role: UserRole.USER,
          distributionId: null,
          branchId: 'branch-1',
        },
        { distributionIdField: 'distributionId' },
      ),
    ).toEqual({ distributionId: { in: [] } });
  });
});
