import { Module, Global, DynamicModule } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from './redis.module.js';

import { TokenBlacklistService } from './services/token-blacklist.service.js';
import { SecurityAuditService } from './services/security-audit.service.js';
import { DeviceFingerprintService } from './services/device-fingerprint.service.js';
import { JwtRsaService } from './services/jwt-rsa.service.js';

@Global()
@Module({})
export class SecurityModule {
  static forRoot(): DynamicModule {
    return {
      module: SecurityModule,
      imports: [
        ConfigModule,
        RedisModule,
        ThrottlerModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            throttlers: [
              {
                ttl: configService.get<number>('security.rateLimit.ttl') ?? 60000,
                limit: configService.get<number>('security.rateLimit.limit') ?? 100,
              },
            ],
            skipIf: (req) => configService.get<string>('app.nodeEnv') === 'test',
          }),
          inject: [ConfigService],
        }),
      ],
      providers: [
        TokenBlacklistService,
        SecurityAuditService,
        DeviceFingerprintService,
        JwtRsaService,
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
      exports: [
        TokenBlacklistService,
        SecurityAuditService,
        DeviceFingerprintService,
        JwtRsaService,
        ThrottlerModule,
      ],
    };
  }
}