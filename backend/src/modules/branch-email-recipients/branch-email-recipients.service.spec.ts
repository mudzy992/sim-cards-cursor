import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchEmailRecipientsService } from './branch-email-recipients.service';

describe('BranchEmailRecipientsService — Run 6 hardening', () => {
  function createMocks() {
    const prisma = {
      branch: {
        findUnique: jest.fn().mockResolvedValue({ id: 'b-1', distributionId: 'dist-1' }),
      },
      branchEmailRecipient: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'r-1', email: 'sep@example.com' }),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new BranchEmailRecipientsService(prisma as unknown as PrismaService);
    return { service, prisma };
  }

  it('rejects duplicate email within the same branch with ConflictException', async () => {
    const { service, prisma } = createMocks();
    prisma.branchEmailRecipient.findFirst.mockResolvedValueOnce({ id: 'existing-1' });

    await expect(
      service.create(
        { branchId: 'b-1', email: 'SEP@Example.com' },
        { role: UserRole.SYSTEM_ADMIN, distributionId: null },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks DIST_ADMIN from creating recipient for another distribution branch', async () => {
    const { service } = createMocks();

    await expect(
      service.create(
        { branchId: 'b-1', email: 'sep@example.com' },
        { role: UserRole.DIST_ADMIN, distributionId: 'dist-other' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
