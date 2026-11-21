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

  it('chunks large 8,500+ row imports for both lookup and createMany to stay below PostgreSQL 32,767 bind-parameter limit', async () => {
    const { service, prisma, tx } = createMocks();
    const rowCount = 8_500;
    const lines = ['ICCID,IP,PublicIP,Phone,APN'];
    for (let i = 0; i < rowCount; i += 1) {
      const iccid = `893870000000000${String(10000 + i)}`;
      const third = Math.floor(i / 250);
      const fourth = (i % 250) + 1;
      const ip = `10.${10 + Math.floor(third / 250)}.${third % 250}.${fourth}`;
      const pubIp = `31.${47 + Math.floor(third / 250)}.${third % 250}.${fourth}`;
      const phone = `061${String(100000 + i)}`;
      lines.push(`${iccid},${ip},${pubIp},${phone},iot.apn`);
    }
    const largeCsv = lines.join('\n');

    tx.simCard.createMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({
      count: data.length,
    }));
    tx.simCard.count.mockResolvedValueOnce(rowCount);

    const result = await service.importExcel(
      'ship-1',
      { applyImport: 'true' },
      makeCsvBuffer(largeCsv),
      'admin-1',
      '127.0.0.1',
      scope,
    );

    expect(result.mode).toBe('import');
    if (result.mode === 'import') {
      expect(result.insertedRows).toBe(rowCount);
    }

    // 4 fields × 2 chunks (5,000 + 3,500) = 8 findMany calls on outer pre-check and 8 inside tx
    expect(prisma.simCard.findMany).toHaveBeenCalledTimes(8);
    expect(tx.simCard.findMany).toHaveBeenCalledTimes(8);
    for (const call of prisma.simCard.findMany.mock.calls) {
      const where = call[0]?.where as Record<string, { in?: string[] }>;
      const values = Object.values(where)[0]?.in ?? [];
      expect(values.length).toBeLessThanOrEqual(5_000);
    }

    // 8,500 rows / 2,000 chunk size = 5 createMany calls (2000, 2000, 2000, 2000, 500)
    expect(tx.simCard.createMany).toHaveBeenCalledTimes(5);
    const batchSizes = tx.simCard.createMany.mock.calls.map(
      (call) => (call[0]?.data as unknown[]).length,
    );
    expect(batchSizes).toEqual([2000, 2000, 2000, 2000, 500]);
  });
});
