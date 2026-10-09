import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { RedisClientType } from 'redis';
import { REDIS_CLIENT } from '../redis.module.js';

export interface BlacklistedToken {
  tokenId: string;
  userId: string;
  reason: 'logout' | 'revoked' | 'expired' | 'security';
  blacklistedAt: Date;
  expiresAt: Date;
}

@Injectable()
export class TokenBlacklistService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private readonly TTL_BUFFER = 60; // 1 minuto de buffer

  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClientType) {}

  async onModuleInit() {
    // Verificar conexión
    try {
      await this.redis.ping();
      this.logger.log('TokenBlacklistService conectado a Redis');
    } catch (error) {
      this.logger.warn('Redis no disponible, blacklist deshabilitada');
    }
  }

  async onModuleDestroy() {
    // No cerrar Redis aquí, lo maneja RedisModule
  }

  // ==================== BLACKLIST ====================

  async addToBlacklist(
    tokenId: string,
    userId: string,
    expiresAt: Date,
    reason: BlacklistedToken['reason'] = 'logout',
  ): Promise<void> {
    const ttl = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000) + this.TTL_BUFFER);
    
    const data: BlacklistedToken = {
      tokenId,
      userId,
      reason,
      blacklistedAt: new Date(),
      expiresAt,
    };

    await this.redis.setEx(
      `blacklist:${tokenId}`,
      ttl,
      JSON.stringify(data),
    );

    // También indexar por usuario para revocación masiva
    await this.redis.sAdd(`user_tokens:${userId}`, tokenId);
    await this.redis.expire(`user_tokens:${userId}`, ttl);

    this.logger.debug(`Token añadido a blacklist: ${tokenId} (${reason})`);
  }

  async isBlacklisted(tokenId: string): Promise<boolean> {
    const exists = await this.redis.exists(`blacklist:${tokenId}`);
    return exists === 1;
  }

  async getBlacklistInfo(tokenId: string): Promise<BlacklistedToken | null> {
    const data = await this.redis.get(`blacklist:${tokenId}`);
    return data ? JSON.parse(data) : null;
  }

  // ==================== REVOCACIÓN MASIVA ====================

  async revokeAllUserTokens(userId: string, reason: BlacklistedToken['reason'] = 'security'): Promise<number> {
    const tokenIds = await this.redis.sMembers(`user_tokens:${userId}`);
    
    if (tokenIds.length === 0) {
      return 0;
    }

    const pipeline = this.redis.multi();
    
    for (const tokenId of tokenIds) {
      const ttl = await this.redis.ttl(`blacklist:${tokenId}`);
      if (ttl > 0) {
        const data: BlacklistedToken = {
          tokenId,
          userId,
          reason,
          blacklistedAt: new Date(),
          expiresAt: new Date(Date.now() + ttl * 1000),
        };
        pipeline.setEx(`blacklist:${tokenId}`, ttl, JSON.stringify(data));
      }
    }
    
    pipeline.del(`user_tokens:${userId}`);
    await pipeline.exec();

    this.logger.warn(`Revocados ${tokenIds.length} tokens del usuario ${userId} (${reason})`);
    return tokenIds.length;
  }

  // ==================== LIMPIEZA ====================

  async cleanExpiredBlacklist(): Promise<number> {
    // Redis maneja la expiración automáticamente con TTL
    // Esta función es para métricas/manual
    return 0;
  }
}