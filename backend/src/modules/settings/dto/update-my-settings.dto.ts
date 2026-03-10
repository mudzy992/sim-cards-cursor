import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class WebRoleTourStateDto {
  @ApiPropertyOptional({
    description:
      'Datum/vrijeme kada je tour kompletiran (ISO string); null ako nikad nije završen',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  completedAt?: string | null;
}

export class WebTourStateDto {
  @ApiPropertyOptional({ type: () => WebRoleTourStateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WebRoleTourStateDto)
  systemAdmin?: WebRoleTourStateDto;

  @ApiPropertyOptional({ type: () => WebRoleTourStateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WebRoleTourStateDto)
  moderator?: WebRoleTourStateDto;

  @ApiPropertyOptional({
    description: 'Zadnja verzija tour-a koju je korisnik vidio (npr. v1, v2)',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  lastVersionSeen?: string | null;
}

export class MobileTourStateDto {
  @ApiPropertyOptional({
    description:
      'Datum/vrijeme kada je mobile mini-tour kompletiran (ISO string); null ako nikad nije završen',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  completedAt?: string | null;
}

export class UserTourStateDto {
  @ApiPropertyOptional({ type: () => WebTourStateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WebTourStateDto)
  web?: WebTourStateDto;

  @ApiPropertyOptional({ type: () => MobileTourStateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MobileTourStateDto)
  mobile?: MobileTourStateDto;
}

export class UpdateMySettingsDto {
  @ApiPropertyOptional({ type: () => UserTourStateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UserTourStateDto)
  tour?: UserTourStateDto;

  // Rezervirano za buduća proširenja (npr. frontend preference)
  @ApiPropertyOptional({
    description:
      'Dodatne user-specifične postavke (trenutno se ne koristi eksplicitno)',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;
}

