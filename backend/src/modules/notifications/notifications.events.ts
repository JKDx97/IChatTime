export const NOTIF_EVENT = 'notification.create';

export interface NotifEventPayload {
  userId: string;
  actorId: string;
  type: 'like' | 'comment' | 'comment_reply' | 'follow' | 'story_like' | 'friend_request' | 'friend_accept';
  entityId?: string | null;
  entityType?: 'post' | 'story' | null;
  entityMediaUrl?: string | null;
}
