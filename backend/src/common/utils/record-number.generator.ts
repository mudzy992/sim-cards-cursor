
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RecordNumberGenerator {
  constructor(private readonly prisma: PrismaService) {}

  async generate(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `ZAP-${year}-`;

    const lastRecord = await this.prisma.installationRecord.findFirst({
      where: {
        recordNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        recordNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastRecord) {
      const lastSequence = parseInt(lastRecord.recordNumber.split('-')[2], 10);
      sequence = lastSequence + 1;
    }

    const paddedSequence = String(sequence).padStart(5, '0');
    return `${prefix}${paddedSequence}`;
  }
}
