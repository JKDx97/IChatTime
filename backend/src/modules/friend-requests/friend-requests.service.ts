import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FriendRequest } from './entities/friend-request.entity';
import { User } from '../users/entities/user.entity';
import {
  NOTIF_EVENT,
  NotifEventPayload,
} from '../notifications/notifications.events';

@Injectable()
export class FriendRequestsService {
  constructor(
    @InjectRepository(FriendRequest)
    private readonly repo: Repository<FriendRequest>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly events: EventEmitter2,
  ) {}

  /** Send a friend request */
  async send(senderId: string, receiverId: string) {
    if (senderId === receiverId) {
      throw new BadRequestException('No puedes enviarte solicitud a ti mismo');
    }

    const receiver = await this.users.findOne({ where: { id: receiverId } });
    if (!receiver) throw new NotFoundException('Usuario no encontrado');

    // Check if there's already a request between these two users (either direction)
    const existing = await this.repo
      .createQueryBuilder('fr')
      .where(
        '(fr.sender_id = :a AND fr.receiver_id = :b) OR (fr.sender_id = :b AND fr.receiver_id = :a)',
        { a: senderId, b: receiverId },
      )
      .getOne();

    if (existing) {
      if (existing.status === 'accepted') {
        throw new ConflictException('Ya son amigos');
      }
      if (existing.status === 'pending') {
        // If the other person already sent me a request, auto-accept
        if (existing.senderId === receiverId) {
          return this.accept(existing.id, senderId);
        }
        throw new ConflictException('Solicitud ya enviada');
      }
      if (existing.status === 'rejected') {
        // Allow re-sending: update existing record
        existing.senderId = senderId;
        existing.receiverId = receiverId;
        existing.status = 'pending';
        const saved = await this.repo.save(existing);
        this.emitFriendRequestNotif(senderId, receiverId, saved.id);
        return saved;
      }
    }

    const fr = this.repo.create({ senderId, receiverId, status: 'pending' });
    const saved = await this.repo.save(fr);
    this.emitFriendRequestNotif(senderId, receiverId, saved.id);
    return saved;
  }

  /** Emit a friend_request notification to the receiver */
  private async emitFriendRequestNotif(senderId: string, receiverId: string, requestId: string) {
    const sender = await this.users.findOne({ where: { id: senderId } });
    this.events.emit(NOTIF_EVENT, <NotifEventPayload>{
      userId: receiverId,
      actorId: senderId,
      type: 'friend_request',
      entityId: requestId,
      entityType: null,
      entityMediaUrl: sender?.avatarUrl ?? null,
    });
  }

  /** Accept a friend request */
  async accept(requestId: string, userId: string) {
    const fr = await this.repo.findOne({
      where: { id: requestId },
      relations: ['sender', 'receiver'],
    });
    if (!fr) throw new NotFoundException('Solicitud no encontrada');
    if (fr.receiverId !== userId) {
      throw new ForbiddenException('No puedes aceptar esta solicitud');
    }
    if (fr.status !== 'pending') {
      throw new BadRequestException('Solicitud ya procesada');
    }

    fr.status = 'accepted';
    const saved = await this.repo.save(fr);

    // Notify the sender that their request was accepted
    const receiver = await this.users.findOne({ where: { id: userId } });
    this.events.emit(NOTIF_EVENT, <NotifEventPayload>{
      userId: fr.senderId,
      actorId: userId,
      type: 'friend_accept',
      entityId: fr.id,
      entityType: null,
      entityMediaUrl: receiver?.avatarUrl ?? null,
    });

    return saved;
  }

  /** Reject a friend request */
  async reject(requestId: string, userId: string) {
    const fr = await this.repo.findOne({ where: { id: requestId } });
    if (!fr) throw new NotFoundException('Solicitud no encontrada');
    if (fr.receiverId !== userId) {
      throw new ForbiddenException('No puedes rechazar esta solicitud');
    }
    if (fr.status !== 'pending') {
      throw new BadRequestException('Solicitud ya procesada');
    }

    fr.status = 'rejected';
    return this.repo.save(fr);
  }

  /** Cancel a sent friend request */
  async cancel(requestId: string, userId: string) {
    const fr = await this.repo.findOne({ where: { id: requestId } });
    if (!fr) throw new NotFoundException('Solicitud no encontrada');
    if (fr.senderId !== userId) {
      throw new ForbiddenException('No puedes cancelar esta solicitud');
    }
    if (fr.status !== 'pending') {
      throw new BadRequestException('Solicitud ya procesada');
    }
    await this.repo.delete(requestId);
    return { ok: true };
  }

  /** Remove friendship (unfriend) */
  async unfriend(requestId: string, userId: string) {
    const fr = await this.repo.findOne({ where: { id: requestId } });
    if (!fr) throw new NotFoundException();
    if (fr.senderId !== userId && fr.receiverId !== userId) {
      throw new ForbiddenException();
    }
    if (fr.status !== 'accepted') {
      throw new BadRequestException('No son amigos');
    }
    await this.repo.delete(requestId);
    return { ok: true };
  }

  /** List pending incoming requests for a user */
  async listPending(userId: string) {
    return this.repo.find({
      where: { receiverId: userId, status: 'pending' },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
    });
  }

  /** Get friendship status between two users */
  async getStatus(userId: string, otherUserId: string) {
    if (userId === otherUserId) return { status: 'self' as const, requestId: null };

    const fr = await this.repo
      .createQueryBuilder('fr')
      .where(
        '(fr.sender_id = :a AND fr.receiver_id = :b) OR (fr.sender_id = :b AND fr.receiver_id = :a)',
        { a: userId, b: otherUserId },
      )
      .getOne();

    if (!fr) return { status: 'none' as const, requestId: null };

    if (fr.status === 'accepted') {
      return { status: 'friends' as const, requestId: fr.id };
    }

    if (fr.status === 'pending') {
      if (fr.senderId === userId) {
        return { status: 'sent' as const, requestId: fr.id };
      }
      return { status: 'received' as const, requestId: fr.id };
    }

    // rejected — treat as none so they can re-send
    return { status: 'none' as const, requestId: null };
  }

  /** Count pending incoming requests */
  async countPending(userId: string) {
    return this.repo.count({
      where: { receiverId: userId, status: 'pending' },
    });
  }

  /** List all accepted friends for a user */
  async listFriends(userId: string) {
    const rows: {
      id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
      since: string;
      last_seen: string | null;
    }[] = await this.repo.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.last_seen, fr.updated_at AS since
       FROM friend_requests fr
       JOIN users u ON u.id = CASE WHEN fr.sender_id = $1 THEN fr.receiver_id ELSE fr.sender_id END
       WHERE fr.status = 'accepted'
         AND (fr.sender_id = $1 OR fr.receiver_id = $1)
       ORDER BY u.display_name ASC`,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      since: r.since,
      lastSeen: r.last_seen,
    }));
  }
}
