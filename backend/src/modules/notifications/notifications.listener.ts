import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NOTIF_EVENT, NotifEventPayload } from './notifications.events';

@Injectable()
export class NotificationsListener {
  constructor(
    private readonly service: NotificationsService,
    private readonly gateway: NotificationsGateway,
  ) {}

  private static MESSAGES: Record<string, string> = {
    like: 'le dio me gusta a tu publicación',
    comment: 'comentó en tu publicación',
    comment_reply: 'respondió a tu comentario',
    follow: 'comenzó a seguirte',
    story_like: 'le dio me encanta a tu historia',
    friend_request: 'te envió una solicitud de amistad',
    friend_accept: 'aceptó tu solicitud de amistad',
  };

  @OnEvent(NOTIF_EVENT, { async: true })
  async handle(p: NotifEventPayload) {
    if (p.userId === p.actorId) return;
    const n = await this.service.create({
      userId: p.userId,
      actorId: p.actorId,
      type: p.type,
      message: NotificationsListener.MESSAGES[p.type] ?? '',
      entityId: p.entityId ?? null,
      entityType: p.entityType ?? null,
      entityMediaUrl: p.entityMediaUrl ?? null,
    });
    this.gateway.emitToUser(p.userId, 'notification', n);
  }
}
