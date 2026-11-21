import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { MeterFieldType, MeterTypeField, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateMeterTypeFieldDto } from './dto/create-meter-type-field.dto';
import { UpdateMeterTypeFieldDto } from './dto/update-meter-type-field.dto';

@Injectable()
export class MeterTypeFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly activityLogService?: ActivityLogService,
  ) {}

  async findAllByDefinition(meterTypeDefinitionId: string): Promise<MeterTypeField[]> {
    await this.ensureDefinitionExists(meterTypeDefinitionId);
    return this.prisma.meterTypeField.findMany({
      where: { meterTypeDefinitionId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(
    meterTypeDefinitionId: string,
    dto: CreateMeterTypeFieldDto,
    actorId?: string,
    ipAddress?: string,
  ): Promise<MeterTypeField> {
    await this.ensureDefinitionExists(meterTypeDefinitionId);
    const trimmedName = dto.name.trim();
    const trimmedLabel = dto.label.trim();

    if (!trimmedName || !trimmedLabel) {
      throw new BadRequestException('Naziv i ključ polja ne smiju biti prazni.');
    }

    const dup = await this.prisma.meterTypeField.findFirst({
      where: { meterTypeDefinitionId, name: trimmedName },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException(
        `Polje sa ključem "${trimmedName}" već postoji za ovaj tip brojila.`,
      );
    }

    try {
      const created = await this.prisma.meterTypeField.create({
        data: {
          meterTypeDefinitionId,
          name: trimmedName,
          label: trimmedLabel,
          fieldType: dto.fieldType,
          isRequired: dto.isRequired ?? false,
          isOperatorFillable: dto.isOperatorFillable ?? false,
          defaultValue: dto.defaultValue,
          sortOrder: dto.sortOrder ?? 0,
        },
      });

      if (this.activityLogService) {
        await this.activityLogService.log({
          userId: actorId,
          action: 'CREATE',
          entity: 'meter_type_field',
          entityId: created.id,
          details: { meterTypeDefinitionId, name: created.name },
          ipAddress,
        });
      }

      return created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Polje sa ključem "${trimmedName}" već postoji za ovaj tip brojila.`,
        );
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateMeterTypeFieldDto,
    actorId?: string,
    ipAddress?: string,
  ): Promise<MeterTypeField> {
    const existing = await this.ensureFieldExists(id);
    const nextName = dto.name !== undefined ? dto.name.trim() : undefined;
    const nextLabel = dto.label !== undefined ? dto.label.trim() : undefined;

    if (nextName !== undefined && !nextName) {
      throw new BadRequestException('Ključ polja ne smije biti prazan.');
    }
    if (nextLabel !== undefined && !nextLabel) {
      throw new BadRequestException('Naziv polja ne smije biti prazan.');
    }

    if (nextName && nextName !== existing.name) {
      const dup = await this.prisma.meterTypeField.findFirst({
        where: {
          meterTypeDefinitionId: existing.meterTypeDefinitionId,
          name: nextName,
          id: { not: id },
        },
        select: { id: true },
      });
      if (dup) {
        throw new ConflictException(
          `Polje sa ključem "${nextName}" već postoji za ovaj tip brojila.`,
        );
      }
    }

    try {
      const updated = await this.prisma.meterTypeField.update({
        where: { id },
        data: {
          ...(nextName !== undefined && { name: nextName }),
          ...(nextLabel !== undefined && { label: nextLabel }),
          ...(dto.fieldType !== undefined && { fieldType: dto.fieldType }),
          ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
          ...(dto.isOperatorFillable !== undefined && {
            isOperatorFillable: dto.isOperatorFillable,
          }),
          ...(dto.defaultValue !== undefined && { defaultValue: dto.defaultValue }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        },
      });

      if (this.activityLogService) {
        await this.activityLogService.log({
          userId: actorId,
          action: 'UPDATE',
          entity: 'meter_type_field',
          entityId: id,
          details: { fields: Object.keys(dto) },
          ipAddress,
        });
      }

      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Polje sa ključem "${nextName}" već postoji za ovaj tip brojila.`,
        );
      }
      throw error;
    }
  }

  async remove(
    id: string,
    actorId?: string,
    ipAddress?: string,
  ): Promise<MeterTypeField> {
    const existing = await this.ensureFieldExists(id);
    const deleted = await this.prisma.meterTypeField.delete({ where: { id } });

    if (this.activityLogService) {
      await this.activityLogService.log({
        userId: actorId,
        action: 'DELETE',
        entity: 'meter_type_field',
        entityId: id,
        details: {
          meterTypeDefinitionId: existing.meterTypeDefinitionId,
          name: existing.name,
        },
        ipAddress,
      });
    }

    return deleted;
  }

  async reorder(
    meterTypeDefinitionId: string,
    fieldIds: string[],
    actorId?: string,
    ipAddress?: string,
  ): Promise<MeterTypeField[]> {
    await this.ensureDefinitionExists(meterTypeDefinitionId);

    const uniqueIds = new Set(fieldIds);
    if (uniqueIds.size !== fieldIds.length) {
      throw new BadRequestException('Lista polja za promjenu redoslijeda sadrži duplikate.');
    }

    const existing = await this.prisma.meterTypeField.findMany({
      where: { meterTypeDefinitionId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((f) => f.id));
    for (const fid of fieldIds) {
      if (!existingIds.has(fid)) {
        throw new BadRequestException(`Polje s ID ${fid} ne pripada ovom tipu brojila.`);
      }
    }

    await this.prisma.$transaction(
      fieldIds.map((fid, index) =>
        this.prisma.meterTypeField.update({
          where: { id: fid },
          data: { sortOrder: index },
        }),
      ),
    );

    if (this.activityLogService) {
      await this.activityLogService.log({
        userId: actorId,
        action: 'REORDER',
        entity: 'meter_type_field',
        entityId: meterTypeDefinitionId,
        details: { fieldIds },
        ipAddress,
      });
    }

    return this.findAllByDefinition(meterTypeDefinitionId);
  }

  async validateDynamicValues(
    meterTypeDefinitionId: string,
    values: Record<string, unknown> | null | undefined,
  ): Promise<Record<string, unknown>> {
    const fields = await this.prisma.meterTypeField.findMany({
      where: { meterTypeDefinitionId },
      orderBy: { sortOrder: 'asc' },
    });
    if (fields.length === 0) return {};

    const safeValues = values ?? {};
    const errors: string[] = [];
    const validated: Record<string, unknown> = {};

    for (const field of fields) {
      const raw = safeValues[field.name];
      const hasValue = raw !== undefined && raw !== null && raw !== '';

      if (field.isRequired && !hasValue) {
        errors.push(`Polje "${field.label}" je obavezno.`);
        continue;
      }

      if (!hasValue) {
        if (field.defaultValue !== null) {
          validated[field.name] = this.castValue(
            field.defaultValue,
            field.fieldType,
            field.label,
            errors,
          );
        }
        continue;
      }

      validated[field.name] = this.castValue(raw, field.fieldType, field.label, errors);
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }
    return validated;
  }

  private castValue(
    raw: unknown,
    fieldType: MeterFieldType,
    label: string,
    errors: string[],
  ): unknown {
    switch (fieldType) {
      case MeterFieldType.STRING:
        return String(raw);
      case MeterFieldType.NUMBER: {
        const num = Number(raw);
        if (isNaN(num)) {
          errors.push(`Polje "${label}" mora biti broj.`);
          return raw;
        }
        return num;
      }
      case MeterFieldType.BOOLEAN: {
        if (typeof raw === 'boolean') return raw;
        if (raw === 'true' || raw === '1') return true;
        if (raw === 'false' || raw === '0') return false;
        errors.push(`Polje "${label}" mora biti true/false.`);
        return raw;
      }
      case MeterFieldType.DATE: {
        const date = new Date(raw as string);
        if (isNaN(date.getTime())) {
          errors.push(`Polje "${label}" mora biti validan datum.`);
          return raw;
        }
        return date.toISOString();
      }
      default:
        return raw;
    }
  }

  private async ensureDefinitionExists(id: string): Promise<void> {
    const def = await this.prisma.meterTypeDefinition.findUnique({ where: { id } });
    if (!def) {
      throw new NotFoundException(`Tip brojila s ID ${id} nije pronađen.`);
    }
  }

  private async ensureFieldExists(id: string): Promise<MeterTypeField> {
    const field = await this.prisma.meterTypeField.findUnique({ where: { id } });
    if (!field) {
      throw new NotFoundException(`Polje s ID ${id} nije pronađeno.`);
    }
    return field;
  }
}
