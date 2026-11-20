import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, ShipmentStatus, SimCardStatus, UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ColumnMapperService } from './import/column-mapper.service';
import { ExcelImportService } from './import/excel-import.service';
import { ShipmentsService } from './shipments.service';

describe('ShipmentsService — Excel import atomicity', () => {
  const columnMapperService = new ColumnMapperService();
  const excelImportService = new ExcelImportService();

  function makeCsvBuffer(csv: string): {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  } {
    const buffer = Buffer.from(csv, 'utf8');
    return {
      buffer,
      originalname: 'cards.csv',
      mimetype: 'text/csv',
      size: buffer.length,
    };
  }

  function createMocks() {
    const tx = {
      simCard: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        count: jest.fn().mockResolvedValue(2),
      },
      shipment: {
        update: jest.fn().mockResolvedValue({ id: 'ship-1' }),
      },
    };

    const prisma = {
      shipment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ship-1' }),
      },
      simCard: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
    };

    const activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ShipmentsService(
      prisma as unknown as PrismaService,
      activityLogService as unknown as ActivityLogService,
      columnMapperService,
      excelImportService,
    );

    return { service, prisma, tx, activityLogService };
  }

  const scope = { role: UserRole.SYSTEM_ADMIN, distributionId: null, branchId: null };
  const sampleCsv = [
    'ICCID,IP,PublicIP,Phone,APN',
    '89387000000000000001,10.10.0.1,31.47.10.1,061111222,iot.apn',
    '89387000000000000002,10.10.0.2,31.47.10.2,061111223,iot.apn',
  ].join('\n');

  it('returns preview without opening a database transaction when applyImport is false', async () => {
    const { service, prisma } = createMocks();

    const result = await service.importExcel(
      'ship-1',
      { applyImport: 'false' },
      makeCsvBuffer(sampleCsv),
      'admin-1',
      '127.0.0.1',
      scope,
    );

    expect(result.mode).toBe('preview');
    expect(result.summary.totalRows).toBe(2);
    expect(result.summary.validRows).toBe(2);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects invalid selectedRowNumbers JSON before opening a transaction', async () => {
    const { service, prisma } = createMocks();

    await expect(
      service.importExcel(
        'ship-1',
        { applyImport: 'true', selectedRowNumbers: '["not-a-number"]' },
        makeCsvBuffer(sampleCsv),
        'admin-1',
        '127.0.0.1',
        scope,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('aborts transaction with ConflictException if a concurrent insert introduces a duplicate inside tx', async () => {
    const { service, prisma, tx, activityLogService } = createMocks();

    // Outer pre-check finds no existing records, but inside $transaction another request inserted ICCID 1.
    prisma.simCard.findMany.mockResolvedValueOnce([]);
    tx.simCard.findMany.mockResolvedValueOnce([
      {
        iccid: '89387000000000000001',
        ipAddress: '10.10.0.1',
        publicIpAddress: null,
        phoneNumber: null,
        shipment: {
          id: 'ship-other',
          name: 'Concurrent Shipment',
          receivedDate: new Date('2026-10-01T00:00:00Z'),
        },
      },
    ]);

    await expect(
      service.importExcel(
        'ship-1',
        { applyImport: 'true' },
        makeCsvBuffer(sampleCsv),
        'admin-1',
        '127.0.0.1',
        scope,
      ),
    ).rejects.toThrow(ConflictException);

    expect(tx.simCard.createMany).not.toHaveBeenCalled();
    expect(tx.shipment.update).not.toHaveBeenCalled();
    expect(activityLogService.log).not.toHaveBeenCalled();
  });

  it('maps Prisma P2002 unique constraint error to ConflictException', async () => {
    const { service, tx } = createMocks();

    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.22.0',
    });
    tx.simCard.createMany.mockRejectedValueOnce(p2002);

    await expect(
      service.importExcel(
        'ship-1',
        { applyImport: 'true' },
        makeCsvBuffer(sampleCsv),
        'admin-1',
        '127.0.0.1',
        scope,
      ),
    ).rejects.toThrow(ConflictException);

    expect(tx.shipment.update).not.toHaveBeenCalled();
  });

  it('inserts valid selected rows atomically, updates shipment status, and logs IMPORT', async () => {
    const { service, tx, activityLogService } = createMocks();
    tx.simCard.createMany.mockResolvedValueOnce({ count: 1 });
    tx.simCard.count.mockResolvedValueOnce(1);

    const result = await service.importExcel(
      'ship-1',
      { applyImport: 'true', selectedRowNumbers: '[2]' },
      makeCsvBuffer(sampleCsv),
      'admin-1',
      '127.0.0.1',
      scope,
    );

    expect(result.mode).toBe('import');
    if (result.mode === 'import') {
      expect(result.insertedRows).toBe(1);
      expect(result.skippedRows).toBe(1);
    }

    expect(tx.simCard.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          iccid: '89387000000000000001',
          ipAddress: '10.10.0.1',
          shipmentId: 'ship-1',
          status: SimCardStatus.AVAILABLE,
        }),
      ],
    });
    expect(tx.shipment.update).toHaveBeenCalledWith({
      where: { id: 'ship-1' },
      data: {
        totalCards: 1,
        status: ShipmentStatus.COMPLETED,
        originalFileName: 'cards.csv',
      },
    });
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'IMPORT',
        entity: 'shipment',
        entityId: 'ship-1',
      }),
    );
  });
});
