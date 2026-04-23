import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  create(data: Partial<User>) {
    return this.repo.save(this.repo.create(data));
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findByIdWithPassword(id: string) {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id', { id })
      .getOne();
  }

  findByEmailWithPassword(email: string) {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email })
      .getOne();
  }

  findByUsernameOrEmail(username: string, email: string) {
    return this.repo.findOne({ where: [{ username }, { email }] });
  }

  getByUsername(username: string) {
    return this.repo.findOne({ where: { username } });
  }

  search(q: string) {
    if (!q) return Promise.resolve([]);
    return this.repo
      .createQueryBuilder('u')
      .where('u.username ILIKE :q OR u.display_name ILIKE :q', { q: `%${q}%` })
      .limit(20)
      .getMany();
  }

  async getProfile(id: string) {
    const u = await this.findById(id);
    if (!u) throw new NotFoundException('User not found');
    return u;
  }

  async updateAvatar(id: string, avatarUrl: string) {
    await this.repo.update(id, { avatarUrl });
    return this.findById(id);
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    if (dto.username) {
      const taken = await this.repo.findOne({
        where: { username: dto.username, id: Not(id) },
      });
      if (taken) throw new ConflictException('Ese nombre de usuario ya está en uso');
    }

    const updates: Partial<User> = {};
    if (dto.displayName !== undefined) updates.displayName = dto.displayName;
    if (dto.username !== undefined) updates.username = dto.username;
    if (dto.bio !== undefined) updates.bio = dto.bio || null;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No hay campos para actualizar');
    }

    await this.repo.update(id, updates);
    return this.findById(id);
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    const user = await this.findByIdWithPassword(id);
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('La contraseña actual es incorrecta');

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.repo.update(id, { passwordHash: newHash });
    return { ok: true };
  }
}
