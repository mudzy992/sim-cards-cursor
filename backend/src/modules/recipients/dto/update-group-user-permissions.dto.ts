import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateGroupUserPermissionsDto {
  @IsOptional()
  @IsBoolean()
  canApproveFromPending?: boolean;

  @IsOptional()
  @IsBoolean()
  canRejectFromPending?: boolean;

  @IsOptional()
  @IsBoolean()
  canActivateSep?: boolean;

  @IsOptional()
  @IsBoolean()
  canSendPdf?: boolean;
}

