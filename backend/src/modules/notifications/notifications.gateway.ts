import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { User } from '../users/entities/user.entity';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/realtime',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  /** userId -> number of active sockets */
  private readonly onlineUsers = new Map<string, number>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers.authorization?.replace('Bearer ', '') ?? '');
      if (!token) throw new Error('no token');
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        username: string;
      }>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      client.data.userId = payload.sub;
      client.join(`user:${payload.sub}`);
      this.logger.log(`WS connected user=${payload.sub} sid=${client.id}`);

      // Track online status
      const count = this.onlineUsers.get(payload.sub) ?? 0;
      this.onlineUsers.set(payload.sub, count + 1);
      if (count === 0) {
        // User just came online — broadcast
        this.server.emit('user_online', { userId: payload.sub });
      }
    } catch (e) {
      this.logger.warn(
        `WS rejected sid=${client.id}: ${(e as Error).message}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId as string | undefined;
    this.logger.log(`WS disconnected sid=${client.id}`);

    if (userId) {
      const count = (this.onlineUsers.get(userId) ?? 1) - 1;
      if (count <= 0) {
        this.onlineUsers.delete(userId);
        const now = new Date();
        this.userRepo.update(userId, { lastSeen: now }).catch(() => {});
        this.server.emit('user_offline', { userId, lastSeen: now.toISOString() });
      } else {
        this.onlineUsers.set(userId, count);
      }
    }
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  isOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  getOnlineUserIds(): string[] {
    return Array.from(this.onlineUsers.keys());
  }
}
