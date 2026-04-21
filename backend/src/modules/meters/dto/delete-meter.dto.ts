import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MinLength } from 'class-validator';

export enum MeterDeleteSimAction {
  DELETE_SIM = 'DELETE_SIM',
  RETURN_SIM_TO_AVAILABLE = 'RETURN_SIM_TO_AVAILABLE',
  LEAVE_AS_IS = 'LEAVE_AS_IS',
}

export enum MeterDeleteRecordsAction {
  DELETE_ALL = 'DELETE_ALL',
  ABORT_IF_EXISTS = 'ABORT_IF_EXISTS',
}

export class DeleteMeterDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: MeterDeleteSimAction })
  @IsEnum(MeterDeleteSimAction)
  simAction!: MeterDeleteSimAction;

  @ApiProperty({ enum: MeterDeleteRecordsAction })
  @IsEnum(MeterDeleteRecordsAction)
  recordsAction!: MeterDeleteRecordsAction;
}

