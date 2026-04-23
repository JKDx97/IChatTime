import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.users.findByUsernameOrEmail(
      dto.username,
      dto.email,
    );
    if (exists) throw new ConflictException('username or email already in use');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.users.create({
      username: dto.username,
      email: dto.email,
      displayName: dto.displayName,
      passwordHash,
    });
    return this.issueTokens(user.id, user.username);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmailWithPassword(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.issueTokens(user.id, user.username);
  }

  async refresh(oldToken: string) {
    const hash = this.sha256(oldToken);
    const record = await this.refreshRepo.findOne({
      where: { tokenHash: hash },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    record.revokedAt = new Date();
    await this.refreshRepo.save(record);

    const user = await this.users.findById(record.userId);
    if (!user) throw new UnauthorizedException();
    return this.issueTokens(user.id, user.username);
  }

  async logout(refreshToken: string) {
    const hash = this.sha256(refreshToken);
    await this.refreshRepo.update(
      { tokenHash: hash },
      { revokedAt: new Date() },
    );
    return { ok: true };
  }

  private async issueTokens(userId: string, username: string) {
    const payload = { sub: userId, username };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES'),
    });
    const refreshToken = randomBytes(48).toString('hex');
    const expiresAt = new Date(
      Date.now() +
        this.parseDurationMs(
          this.config.get<string>('JWT_REFRESH_EXPIRES') ?? '7d',
        ),
    );
    await this.refreshRepo.save(
      this.refreshRepo.create({
        userId,
        tokenHash: this.sha256(refreshToken),
        expiresAt,
      }),
    );
    return { accessToken, refreshToken };
  }

  private sha256(v: string) {
    return createHash('sha256').update(v).digest('hex');
  }

  private parseDurationMs(s: string): number {
    const m = /^(\d+)([smhd])$/.exec(s);
    if (!m) return 7 * 24 * 3600 * 1000;
    const n = parseInt(m[1], 10);
    const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]]!;
    return n * mult;
  }

  async forgotPassword(email: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user) return { ok: true };

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.sha256(token);
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.userRepo.update(user.id, {
      resetToken: tokenHash,
      resetTokenExpiry: expiry,
    });

    await this.mail.sendPasswordReset(user.email, user.displayName, token);
    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.sha256(token);
    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.resetToken')
      .addSelect('u.resetTokenExpiry')
      .where('u.resetToken = :tokenHash', { tokenHash })
      .andWhere('u.resetTokenExpiry > :now', { now: new Date() })
      .getOne();

    if (!user) throw new BadRequestException('Token inválido o expirado');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.update(user.id, {
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
    });

    return { ok: true };
  }
}
