import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { databaseConfig, jwtConfig, googleOAuthConfig, appConfig, supabaseConfig, redisConfig, securityConfig } from './configuration.js';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV ?? 'development'}.local`,
        `.env.${process.env.NODE_ENV ?? 'development'}`,
        '.env.local',
        '.env',
      ],
      load: [databaseConfig, jwtConfig, googleOAuthConfig, appConfig, supabaseConfig, redisConfig, securityConfig],
    }),
  ],
})
export class ConfigModule {}