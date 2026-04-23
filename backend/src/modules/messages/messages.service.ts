import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Message } from './entities/message.entity';

export interface ConversationPreview {
  partnerId: string;
  partnerUsername: string;
  partnerDisplayName: string;
  partnerAvatarUrl: string | null;
  lastMessage: Message;
  unreadCount: number;
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly repo: Repository<Message>,
  ) {}

  async create(
    senderId: string,
    receiverId: string,
    content: string | null,
    mediaUrls: string[],
    storyId?: string | null,
    storyMediaUrl?: string | null,
  ): Promise<Message> {
    const msg = this.repo.create({
      senderId,
      receiverId,
      content: content || null,
      mediaUrls: mediaUrls ?? [],
      storyId: storyId ?? null,
      storyMediaUrl: storyMediaUrl ?? null,
    });
    const saved = await this.repo.save(msg);
    return this.repo.findOneOrFail({
      where: { id: saved.id },
      relations: ['sender', 'receiver'],
    });
  }

  async getConversations(userId: string): Promise<ConversationPreview[]> {
    // Get distinct partner IDs from messages where user is sender or receiver
    const raw: {
      partner_id: string;
      partner_username: string;
      partner_display_name: string;
      partner_avatar_url: string | null;
      last_message_id: string;
      unread_count: string;
    }[] = await this.repo.query(
      `
      WITH partners AS (
        SELECT DISTINCT
          CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS partner_id
        FROM messages
        WHERE sender_id = $1 OR receiver_id = $1
      ),
      last_msgs AS (
        SELECT DISTINCT ON (
          CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
        )
          m.id AS last_message_id,
          CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS partner_id,
          m.created_at
        FROM messages m
        WHERE m.sender_id = $1 OR m.receiver_id = $1
        ORDER BY
          CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END,
          m.created_at DESC
      ),
      unreads AS (
        SELECT
          sender_id AS partner_id,
          COUNT(*) AS unread_count
        FROM messages
        WHERE receiver_id = $1 AND read_at IS NULL
        GROUP BY sender_id
      )
      SELECT
        lm.partner_id,
        u.username AS partner_username,
        u.display_name AS partner_display_name,
        u.avatar_url AS partner_avatar_url,
        lm.last_message_id,
        COALESCE(ur.unread_count, 0)::text AS unread_count
      FROM last_msgs lm
      JOIN users u ON u.id = lm.partner_id
      LEFT JOIN unreads ur ON ur.partner_id = lm.partner_id
      ORDER BY lm.created_at DESC
      `,
      [userId],
    );

    if (raw.length === 0) return [];

    const messageIds = raw.map((r) => r.last_message_id);
    const messages = await this.repo.find({
      where: messageIds.map((id) => ({ id })),
      relations: ['sender', 'receiver'],
    });

    const msgMap = new Map<string, Message>();
    messages.forEach((m) => msgMap.set(m.id, m));

    return raw.map((r) => ({
      partnerId: r.partner_id,
      partnerUsername: r.partner_username,
      partnerDisplayName: r.partner_display_name,
      partnerAvatarUrl: r.partner_avatar_url,
      lastMessage: msgMap.get(r.last_message_id)!,
      unreadCount: parseInt(r.unread_count, 10),
    }));
  }

  async getMessages(
    userId: string,
    partnerId: string,
    limit = 40,
    cursor?: string,
  ) {
    const qb = this.repo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('m.receiver', 'receiver')
      .where(
        '((m.senderId = :userId AND m.receiverId = :partnerId) OR (m.senderId = :partnerId AND m.receiverId = :userId))',
        { userId, partnerId },
      )
      .orderBy('m.createdAt', 'DESC')
      .take(limit + 1);

    if (cursor) {
      const cursorMsg = await this.repo.findOne({ where: { id: cursor } });
      if (cursorMsg) {
        qb.andWhere('m.createdAt < :cursorDate', {
          cursorDate: cursorMsg.createdAt,
        });
      }
    }

    const rawItems = await qb.getMany();

    // Filter out messages deleted for this user
    const items = rawItems.filter(
      (m) => !(m.deletedFor ?? []).includes(userId),
    );

    let nextCursor: string | null = null;
    if (rawItems.length > limit) {
      if (items.length > 0) {
        nextCursor = items[0].id; // items are DESC, first is oldest
      } else {
        nextCursor = rawItems[rawItems.length - 1].id;
      }
    }

    return { items: items.slice(0, limit).reverse(), nextCursor };
  }

  async markAsRead(userId: string, partnerId: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .update(Message)
      .set({ readAt: () => 'NOW()' })
      .where(
        'sender_id = :partnerId AND receiver_id = :userId AND read_at IS NULL',
        { partnerId, userId },
      )
      .execute();
    return result.affected ?? 0;
  }

  async unreadCount(userId: string): Promise<number> {
    return this.repo.count({
      where: { receiverId: userId, readAt: IsNull() },
    });
  }

  async deleteForMe(messageId: string, userId: string): Promise<boolean> {
    const msg = await this.repo.findOne({ where: { id: messageId } });
    if (!msg) return false;
    if (msg.senderId !== userId && msg.receiverId !== userId) return false;
    const set = new Set(msg.deletedFor ?? []);
    set.add(userId);
    msg.deletedFor = Array.from(set);
    await this.repo.save(msg);
    return true;
  }

  async deleteForAll(messageId: string, userId: string): Promise<Message | null> {
    const msg = await this.repo.findOne({
      where: { id: messageId },
      relations: ['sender', 'receiver'],
    });
    if (!msg) return null;
    // Only sender can delete for all
    if (msg.senderId !== userId) return null;
    msg.deletedForAll = true;
    msg.content = null;
    msg.mediaUrls = [];
    await this.repo.save(msg);
    return msg;
  }
}
