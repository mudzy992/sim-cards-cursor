import { IsUUID } from 'class-validator';

export class AddUserToGroupDto {
  @IsUUID()
  userId!: string;
}
