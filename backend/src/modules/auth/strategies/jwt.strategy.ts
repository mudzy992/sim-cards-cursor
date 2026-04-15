import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserRole, UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        status: true,
        distributionId: true,
        branchId: true,
        branch: { select: { distributionId: true } },
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is not active');
    }

    let branchModeratorBranchIds: string[] = [];
    if (user.role === UserRole.USER) {
      const moderatorEntries = await this.prisma.branchModerator.findMany({
        where: { userId: user.id },
        select: { branchId: true },
      });
      branchModeratorBranchIds = moderatorEntries.map((e) => e.branchId);
    }

    const { branch, ...rest } = user;
    return {
      ...rest,
      distributionId: rest.distributionId ?? branch?.distributionId ?? null,
      branchId: rest.branchId ?? null,
      branchModeratorBranchIds,
    };
  }
}
