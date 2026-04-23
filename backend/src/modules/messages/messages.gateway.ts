import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';

interface SendMessagePayload {
  receiverId: string;
  content?: string;
  mediaUrls?: string[];
  tempId?: string;
}

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/chat',
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly messagesService: MessagesService,
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
      this.logger.log(`Chat WS connected user=${payload.sub} sid=${client.id}`);
    } catch (e) {
      this.logger.warn(
        `Chat WS rejected sid=${client.id}: ${(e as Error).message}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Chat WS disconnected sid=${client.id}`);
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    const senderId = client.data.userId as string;
    if (!senderId) return;

    const { receiverId, content, mediaUrls, tempId } = payload;
    if (!receiverId) return;
    if (!content && (!mediaUrls || mediaUrls.length === 0)) return;

    try {
      const message = await this.messagesService.create(
        senderId,
        receiverId,
        content ?? null,
        mediaUrls ?? [],
      );

      const messageData = { ...message, tempId };

      // Emit to receiver
      this.server
        .to(`user:${receiverId}`)
        .emit('new_message', messageData);

      // Emit confirmation back to sender
      this.server
        .to(`user:${senderId}`)
        .emit('message_sent', messageData);

      // Check if receiver is connected and emit delivered
      const receiverSockets = await this.server.in(`user:${receiverId}`).fetchSockets();
      if (receiverSockets.length > 0) {
        this.server
          .to(`user:${senderId}`)
          .emit('message_delivered', { messageId: message.id, tempId });
      }
    } catch (e) {
      this.logger.error(`send_message error: ${(e as Error).message}`);
      client.emit('message_error', {
        tempId,
        error: 'No se pudo enviar el mensaje',
      });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { receiverId: string },
  ) {
    const senderId = client.data.userId as string;
    if (!senderId || !payload.receiverId) return;
    this.server
      .to(`user:${payload.receiverId}`)
      .emit('user_typing', { userId: senderId });
  }

  @SubscribeMessage('stop_typing')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { receiverId: string },
  ) {
    const senderId = client.data.userId as string;
    if (!senderId || !payload.receiverId) return;
    this.server
      .to(`user:${payload.receiverId}`)
      .emit('user_stop_typing', { userId: senderId });
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { partnerId: string },
  ) {
    const userId = client.data.userId as string;
    if (!userId || !payload.partnerId) return;
    const count = await this.messagesService.markAsRead(
      userId,
      payload.partnerId,
    );
    if (count > 0) {
      this.server
        .to(`user:${payload.partnerId}`)
        .emit('messages_read', { readBy: userId, readAt: new Date().toISOString() });
    }
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
