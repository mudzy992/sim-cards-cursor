import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { MeterTypeField, MeterFieldType } from '@prisma/client'
import { CreateMeterTypeFieldDto } from './dto/create-meter-type-field.dto'
import { UpdateMeterTypeFieldDto } from './dto/update-meter-type-field.dto'

@Injectable()
export class MeterTypeFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByDefinition(meterTypeDefinitionId: string): Promise<MeterTypeField[]> {
    await this.ensureDefinitionExists(meterTypeDefinitionId)
    return this.prisma.meterTypeField.findMany({
      where: { meterTypeDefinitionId },
      orderBy: { sortOrder: 'asc' },
    })
  }

  async create(
    meterTypeDefinitionId: string,
    dto: CreateMeterTypeFieldDto,
  ): Promise<MeterTypeField> {
    await this.ensureDefinitionExists(meterTypeDefinitionId)
    return this.prisma.meterTypeField.create({
      data: {
        meterTypeDefinitionId,
        name: dto.name,
        label: dto.label,
        fieldType: dto.fieldType,
        isRequired: dto.isRequired ?? false,
        isOperatorFillable: dto.isOperatorFillable ?? false,
        defaultValue: dto.defaultValue,
        sortOrder: dto.sortOrder ?? 0,
      },
    })
  }

  async update(id: string, dto: UpdateMeterTypeFieldDto): Promise<MeterTypeField> {
    await this.ensureFieldExists(id)
    return this.prisma.meterTypeField.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.fieldType !== undefined && { fieldType: dto.fieldType }),
        ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
        ...(dto.isOperatorFillable !== undefined && { isOperatorFillable: dto.isOperatorFillable }),
        ...(dto.defaultValue !== undefined && { defaultValue: dto.defaultValue }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    })
  }

  async remove(id: string): Promise<MeterTypeField> {
    await this.ensureFieldExists(id)
    return this.prisma.meterTypeField.delete({ where: { id } })
  }

  async reorder(
    meterTypeDefinitionId: string,
    fieldIds: string[],
  ): Promise<MeterTypeField[]> {
    await this.ensureDefinitionExists(meterTypeDefinitionId)
    const existing = await this.prisma.meterTypeField.findMany({
      where: { meterTypeDefinitionId },
      select: { id: true },
    })
    const existingIds = new Set(existing.map((f) => f.id))
    for (const fid of fieldIds) {
      if (!existingIds.has(fid)) {
        throw new BadRequestException(`Polje s ID ${fid} ne pripada ovom tipu brojila.`)
      }
    }
    await this.prisma.$transaction(
      fieldIds.map((fid, index) =>
        this.prisma.meterTypeField.update({
          where: { id: fid },
          data: { sortOrder: index },
        }),
      ),
    )
    return this.findAllByDefinition(meterTypeDefinitionId)
  }

  async validateDynamicValues(
    meterTypeDefinitionId: string,
    values: Record<string, unknown> | null | undefined,
  ): Promise<Record<string, unknown>> {
    const fields = await this.prisma.meterTypeField.findMany({
      where: { meterTypeDefinitionId },
      orderBy: { sortOrder: 'asc' },
    })
    if (fields.length === 0) return {}

    const safeValues = values ?? {}
    const errors: string[] = []
    const validated: Record<string, unknown> = {}

    for (const field of fields) {
      const raw = safeValues[field.name]
      const hasValue = raw !== undefined && raw !== null && raw !== ''

      if (field.isRequired && !hasValue) {
        errors.push(`Polje "${field.label}" je obavezno.`)
        continue
      }

      if (!hasValue) {
        if (field.defaultValue !== null) {
          validated[field.name] = this.castValue(field.defaultValue, field.fieldType, field.label, errors)
        }
        continue
      }

      validated[field.name] = this.castValue(raw, field.fieldType, field.label, errors)
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors)
    }
    return validated
  }

  private castValue(
    raw: unknown,
    fieldType: MeterFieldType,
    label: string,
    errors: string[],
  ): unknown {
    switch (fieldType) {
      case MeterFieldType.STRING:
        return String(raw)
      case MeterFieldType.NUMBER: {
        const num = Number(raw)
        if (isNaN(num)) {
          errors.push(`Polje "${label}" mora biti broj.`)
          return raw
        }
        return num
      }
      case MeterFieldType.BOOLEAN: {
        if (typeof raw === 'boolean') return raw
        if (raw === 'true' || raw === '1') return true
        if (raw === 'false' || raw === '0') return false
        errors.push(`Polje "${label}" mora biti true/false.`)
        return raw
      }
      case MeterFieldType.DATE: {
        const date = new Date(raw as string)
        if (isNaN(date.getTime())) {
          errors.push(`Polje "${label}" mora biti validan datum.`)
          return raw
        }
        return date.toISOString()
      }
      default:
        return raw
    }
  }

  private async ensureDefinitionExists(id: string): Promise<void> {
    const def = await this.prisma.meterTypeDefinition.findUnique({ where: { id } })
    if (!def) {
      throw new NotFoundException(`Tip brojila s ID ${id} nije pronađen.`)
    }
  }

  private async ensureFieldExists(id: string): Promise<void> {
    const field = await this.prisma.meterTypeField.findUnique({ where: { id } })
    if (!field) {
      throw new NotFoundException(`Polje s ID ${id} nije pronađeno.`)
    }
  }
}
