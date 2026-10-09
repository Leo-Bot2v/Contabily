import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller.js';
import { AuthService } from './services/auth.service.js';
import { LocalAuthService } from './services/local-auth.service.js';
import { SupabaseService } from './services/supabase.service.js';
import { User } from './entities/user.entity.js';
import { JwtStrategy, JwtRefreshStrategy, GoogleStrategy } from './strategies/jwt.strategy.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard.js';
import { GoogleAuthGuard } from './guards/google-auth.guard.js';

import { SecurityModule } from '../security/security.module.js';
import { RedisModule } from '../security/redis.module.js';

@Global()
@Module({
  imports: [
    // ConfigModule ya es global, pero lo importamos para types
    ConfigModule,

    // TypeORM para la entidad User
    TypeOrmModule.forFeature([User]),

    // Passport para estrategias de autenticación
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JWT Module con configuración asíncrona
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') ?? 'default-secret-change-in-production',
        signOptions: {
          expiresIn: (configService.get<string>('jwt.expiresIn') ?? '1d') as any,
        },
      }),
      inject: [ConfigService],
    }),

    // Security Module (Rate limiting, Token blacklist, Audit, Device fingerprint, RSA JWT)
    SecurityModule.forRoot(),

    // Redis Module for token blacklist, rate limiting, audit
    RedisModule.forRoot(),
  ],
  controllers: [AuthController],
  providers: [
    // Servicios
    AuthService,
    LocalAuthService,
    SupabaseService,

    // Estrategias Passport
    JwtStrategy,
    JwtRefreshStrategy,
    GoogleStrategy,

    // Guards
    JwtAuthGuard,
    JwtRefreshGuard,
    GoogleAuthGuard,
  ],
  exports: [
    // Exportar servicios para uso en otros módulos
    AuthService,
    LocalAuthService,
    SupabaseService,
    JwtModule,
    JwtAuthGuard,
    JwtRefreshGuard,
    SecurityModule,
  ],
})
export class AuthModule {}