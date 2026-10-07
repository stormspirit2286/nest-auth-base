import {
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { QueryFailedError } from 'typeorm';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface AccessTokenResponse {
  accessToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash!: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash('timing-safe-dummy-password', {
      type: argon2.argon2id,
    });
  }

  async register(dto: RegisterDto): Promise<User> {
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    try {
      const user = await this.usersService.createUser(dto.email, passwordHash);
      delete (user as Partial<User>).passwordHash;
      return user;
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }
  }

  async login(dto: LoginDto): Promise<AccessTokenResponse> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    const hashToVerify = user?.passwordHash ?? this.dummyHash;
    const isValid = await argon2.verify(hashToVerify, dto.password);

    if (!user || !isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken };
  }
}
