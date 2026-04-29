import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { UserRole } from '@prisma/client'

type RequestUser = {
  role?: UserRole
  branchModeratorBranchIds?: string[]
}

@Injectable()
export class BranchModeratorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const user = request.user as RequestUser | undefined
    const role = user?.role
    if (!role) {
      throw new ForbiddenException('Insufficient permissions')
    }
    if (role === UserRole.SYSTEM_ADMIN || role === UserRole.DIST_ADMIN) {
      return true
    }
    if (role !== UserRole.USER) {
      throw new ForbiddenException('Insufficient permissions')
    }
    const moderated = user?.branchModeratorBranchIds ?? []
    if (moderated.length === 0) {
      throw new ForbiddenException('Insufficient permissions')
    }
    return true
  }
}

