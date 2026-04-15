import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RecordStatus } from '@prisma/client';

@Injectable()
export class StatusTransitionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { id } = request.params;
    const { status: newStatus } = request.body;

    if (!newStatus) {
      return true;
    }

    const record = await this.prisma.installationRecord.findUnique({
      where: { id },
    });

    if (!record) {
      return true;
    }

    const currentStatus = record.status;
    const allowedTransitions: Record<RecordStatus, RecordStatus[]> = {
      [RecordStatus.DRAFT]: [RecordStatus.SENT, RecordStatus.SEND_FAILED],
      [RecordStatus.SEND_FAILED]: [RecordStatus.SENT, RecordStatus.SEND_FAILED],
      [RecordStatus.SENT]: [RecordStatus.SEP_ACTIVATED],
      [RecordStatus.SEP_ACTIVATED]: [],
      [RecordStatus.LEGACY_COMPLETED]: [],
    };

    if (
      !allowedTransitions[currentStatus] ||
      !allowedTransitions[currentStatus].includes(newStatus)
    ) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }

    return true;
  }
}
