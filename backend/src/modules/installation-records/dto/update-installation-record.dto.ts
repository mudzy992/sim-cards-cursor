
import { PartialType } from '@nestjs/swagger';
import { CreateInstallationRecordDto } from './create-installation-record.dto';

export class UpdateInstallationRecordDto extends PartialType(
  CreateInstallationRecordDto,
) {}
