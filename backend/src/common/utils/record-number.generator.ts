import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RecordNumberGenerator {
  constructor(private readonly prisma: PrismaService) {}

  async generate(tx: Prisma.TransactionClient = this.prisma): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `ZAP-${year}-`;

    const rows = await tx.$queryRaw<Array<{ max_seq: number | null }>>`
      SELECT MAX(
        NULLIF(regexp_replace(split_part(record_number, '-', 3), '[^0-9]', '', 'g'), '')::int
      ) AS max_seq
      FROM installation_records
      WHERE record_number LIKE ${`${prefix}%`}
    `;

    const sequence = (rows[0]?.max_seq ?? 0) + 1;
    const paddedSequence = String(sequence).padStart(5, '0');
    return `${prefix}${paddedSequence}`;
  }
}
