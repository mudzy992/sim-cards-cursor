import { ApiProperty } from '@nestjs/swagger'
import { IsUUID } from 'class-validator'

export class AssignBranchModeratorDto {
  @ApiProperty({ description: 'User ID to assign as branch moderator' })
  @IsUUID()
  userId!: string

  @ApiProperty({ description: 'Branch ID to assign the user as moderator for' })
  @IsUUID()
  branchId!: string
}
