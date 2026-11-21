import { BadRequestException, ConflictException } from '@nestjs/common';
import { MeterFieldType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { MeterTypeDefinitionsService } from './meter-type-definitions.service';
import { MeterTypeFieldsService } from './meter-type-fields.service';

describe('MeterTypeDefinitionsService & MeterTypeFieldsService', () => {
  function createMocks() {
    const prisma = {
      meterTypeDefinition: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 'def-1', name: 'AMM 3.0' }),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue({ id: 'def-1', name: 'AMM 3.0' }),
      },
      meterTypeField: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'field-1',
          meterTypeDefinitionId: 'def-1',
          name: 'ct_ratio',
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      meter: {
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const defsService = new MeterTypeDefinitionsService(
      prisma as unknown as PrismaService,
      activityLogService as unknown as ActivityLogService,
    );
    const fieldsService = new MeterTypeFieldsService(
      prisma as unknown as PrismaService,
      activityLogService as unknown as ActivityLogService,
    );

    return { prisma, activityLogService, defsService, fieldsService };
  }

  it('prevents deleting a meter type definition that is used by meters', async () => {
    const { prisma, defsService } = createMocks();
    prisma.meter.count.mockResolvedValueOnce(5);

    await expect(defsService.remove('def-1', 'admin-1', '127.0.0.1')).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.meterTypeDefinition.delete).not.toHaveBeenCalled();
  });

  it('rejects duplicate field key names within the same meter type definition and logs CREATE', async () => {
    const { prisma, fieldsService, activityLogService } = createMocks();
    prisma.meterTypeField.findFirst.mockResolvedValueOnce({ id: 'existing-field' });

    await expect(
      fieldsService.create('def-1', {
        name: ' ct_ratio ',
        label: 'Omjer',
        fieldType: MeterFieldType.STRING,
      }),
    ).rejects.toThrow(ConflictException);

    prisma.meterTypeField.findFirst.mockResolvedValueOnce(null);
    prisma.meterTypeField.create.mockResolvedValueOnce({
      id: 'field-new',
      meterTypeDefinitionId: 'def-1',
      name: 'ct_ratio',
      label: 'Omjer',
    });

    const created = await fieldsService.create(
      'def-1',
      {
        name: ' ct_ratio ',
        label: ' Omjer ',
        fieldType: MeterFieldType.STRING,
      },
      'admin-1',
      '127.0.0.1',
    );
    expect(created.name).toBe('ct_ratio');
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', entity: 'meter_type_field' }),
    );
  });

  it('rejects duplicate fieldIds when reordering meter type fields', async () => {
    const { fieldsService } = createMocks();

    await expect(
      fieldsService.reorder('def-1', ['field-1', 'field-1']),
    ).rejects.toThrow(BadRequestException);
  });
});
