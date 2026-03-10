import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateBranchApprovalGroupDto {
  @ApiProperty({ description: 'Branch ID' })
  @IsUUID()
  branchId!: string;

  @ApiProperty({ description: 'Recipient group ID (type APPROVAL)' })
  @IsUUID()
  recipientGroupId!: string;
}
