import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

const USER_SOCKET_MAP = new Map<string, Set<string>>();

interface AuthenticatedSocket {
  id: string;
  disconnect: () => void;
  handshake?: { auth?: { token?: string }; query?: { token?: string } };
  data?: { userId?: string };
}

@WebSocketGateway({
  cors: { origin: '*' },
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
  ) {}

  handleConnection(client: AuthenticatedSocket): void {
    const token =
      client.handshake?.auth?.token ?? client.handshake?.query?.token;
    if (!token) {
      if (typeof client.disconnect === 'function') client.disconnect();
      return;
    }
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      const userId = payload.sub as string;
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
    const socketIds = USER_SOCKET_MAP.get(userId);
    if (socketIds?.size) {
      socketIds.forEach((socketId) => {
        this.server.to(socketId).emit(event, payload);
      });
    }
  }
}
