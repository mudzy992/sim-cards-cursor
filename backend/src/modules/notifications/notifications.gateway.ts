import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

const USER_SOCKET_MAP = new Map<string, Set<string>>();

interface AuthenticatedSocket {
  id: string;
  disconnect: () => void;
  handshake?: { auth?: { token?: string } };
  data?: { userId?: string };
}

function resolveSocketCorsOrigins(): string[] | boolean {
  const raw = process.env.FRONTEND_URLS || process.env.FRONTEND_URL;
  if (!raw) {
    return process.env.NODE_ENV === 'production' ? false : true;
  }
  const list = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return list.length > 0 ? list : false;
}

@WebSocketGateway({
  cors: {
    origin: resolveSocketCorsOrigins(),
    credentials: true,
  },
  path: '/api/socket.io',
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token = client.handshake?.auth?.token;
    if (!token) {
      if (typeof client.disconnect === 'function') client.disconnect();
      return;
    }
    try {
      const payload = this.jwtService.verify<{ sub?: string; type?: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      if (!payload?.sub || (payload.type && payload.type !== 'access')) {
        if (typeof client.disconnect === 'function') client.disconnect();
        return;
      }
      const userId = payload.sub;
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { status: true },
      });
      if (!user || user.status !== UserStatus.ACTIVE) {
        if (typeof client.disconnect === 'function') client.disconnect();
        return;
      }
      if (!USER_SOCKET_MAP.has(userId)) {
        USER_SOCKET_MAP.set(userId, new Set());
      }
      USER_SOCKET_MAP.get(userId)!.add(client.id);
      client.data = { userId };
    } catch {
      if (typeof client.disconnect === 'function') client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    const userId = client.data?.userId;
    if (userId) {
      const set = USER_SOCKET_MAP.get(userId);
      if (set) {
        set.delete(client.id);
        if (set.size === 0) USER_SOCKET_MAP.delete(userId);
      }
    }
  }

  sendToUser(userId: string, event: string, payload: unknown): void {
    if (!this.server) return;
    const socketIds = USER_SOCKET_MAP.get(userId);
    if (socketIds?.size) {
      socketIds.forEach((socketId) => {
        this.server.to(socketId).emit(event, payload);
      });
    }
  }
}
