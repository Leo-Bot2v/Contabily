import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { RedisClientType } from 'redis';
import { REDIS_CLIENT } from '../redis.module.js';

export interface SecurityEvent {
  eventId: string;
  eventType: SecurityEventType;
  userId?: string;
  email?: string;
  ip: string;
  userAgent?: string;
  deviceFingerprint?: string;
  success: boolean;
  details?: Record<string, any>;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export type SecurityEventType = 
  | 'login_success'
  | 'login_failed'
  | 'register'
  | 'logout'
  | 'password_change'
  | 'password_reset_request'
  | 'password_reset'
  | 'token_refresh'
  | 'token_revoked'
  | 'all_tokens_revoked'
  | 'suspicious_activity'
  | 'brute_force_detected'
  | 'oauth_login'
  | 'oauth_callback'
  | 'account_locked'
  | 'account_unlocked';

@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);
  private readonly RETENTION_DAYS = 90;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClientType) {}

  // ==================== REGISTRO DE EVENTOS ====================

  async logEvent(event: Omit<SecurityEvent, 'eventId' | 'timestamp'>): Promise<void> {
    const fullEvent: SecurityEvent = {
      ...event,
      eventId: crypto.randomUUID(),
      timestamp: new Date(),
    };

    // Guardar en Redis con TTL
    const key = `audit:${fullEvent.timestamp.toISOString().split('T')[0]}:${fullEvent.eventId}`;
    const ttl = this.RETENTION_DAYS * 24 * 60 * 60;

    await this.redis.setEx(key, ttl, JSON.stringify(fullEvent));

    // Índices para consultas rápidas
    await this.redis.sAdd(`audit:user:${event.userId ?? 'anonymous'}`, fullEvent.eventId);
    await this.redis.sAdd(`audit:ip:${event.ip}`, fullEvent.eventId);
    await this.redis.sAdd(`audit:type:${event.eventType}`, fullEvent.eventId);

    // Log local según severidad
    const logMessage = `[SECURITY] ${event.eventType} | ${event.success ? 'SUCCESS' : 'FAILED'} | User: ${event.userId ?? 'anonymous'} | IP: ${event.ip}`;
    
    switch (event.severity) {
      case 'critical':
        this.logger.error(logMessage, event.details);
        break;
      case 'high':
        this.logger.warn(logMessage, event.details);
        break;
      case 'medium':
        this.logger.log(logMessage, event.details);
        break;
      case 'low':
      default:
        this.logger.debug(logMessage, event.details);
    }

    // Detección de fuerza bruta
    if (event.eventType === 'login_failed') {
      await this.checkBruteForce(event.ip, event.email);
    }
  }

  // ==================== CONSULTAS ====================

  async getUserEvents(userId: string, limit = 50): Promise<SecurityEvent[]> {
    const eventIds = await this.redis.sMembers(`audit:user:${userId}`);
    return this.fetchEvents(eventIds.slice(-limit));
  }

  async getIpEvents(ip: string, limit = 50): Promise<SecurityEvent[]> {
    const eventIds = await this.redis.sMembers(`audit:ip:${ip}`);
    return this.fetchEvents(eventIds.slice(-limit));
  }

  async getEventsByType(eventType: SecurityEventType, limit = 50): Promise<SecurityEvent[]> {
    const eventIds = await this.redis.sMembers(`audit:type:${eventType}`);
    return this.fetchEvents(eventIds.slice(-limit));
  }

  private async fetchEvents(eventIds: string[]): Promise<SecurityEvent[]> {
    const events: SecurityEvent[] = [];
    
    for (const eventId of eventIds) {
      // Buscar en las keys del día actual y días anteriores
      const keys = await this.redis.keys(`audit:*:${eventId}`);
      if (keys.length > 0) {
        const data = await this.redis.get(keys[0]);
        if (data) {
          events.push(JSON.parse(data));
        }
      }
    }
    
    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // ==================== DETECCIÓN DE AMENAZAS ====================

  private async checkBruteForce(ip: string, email?: string): Promise<void> {
    const windowMs = 15 * 60 * 1000; // 15 minutos
    const maxAttempts = 5;

    const key = `brute_force:${ip}`;
    const count = await this.redis.incr(key);
    
    if (count === 1) {
      await this.redis.pExpire(key, windowMs);
    }

    if (count >= maxAttempts) {
      await this.logEvent({
        eventType: 'brute_force_detected',
        ip,
        email,
        success: false,
        severity: 'high',
        details: { attempts: count, windowMs },
        userAgent: '',
      });

      // Opcional: bloquear IP temporalmente
      await this.redis.setEx(`blocked_ip:${ip}`, 3600, 'brute_force');
    }
  }

  async isIpBlocked(ip: string): Promise<boolean> {
    return (await this.redis.exists(`blocked_ip:${ip}`)) === 1;
  }

  async getFailedLoginCount(ip: string): Promise<number> {
    const count = await this.redis.get(`brute_force:${ip}`);
    return count ? parseInt(count, 10) : 0;
  }

  // ==================== MÉTRICAS ====================

  async getMetrics(): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    blockedIps: number;
  }> {
    const allKeys = await this.redis.keys('audit:*:*');
    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};

    for (const key of allKeys.slice(0, 1000)) { // Limitar para performance
      const data = await this.redis.get(key);
      if (data) {
        const event = JSON.parse(data);
        eventsByType[event.eventType] = (eventsByType[event.eventType] ?? 0) + 1;
        eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] ?? 0) + 1;
      }
    }

    const blockedIpsKeys = await this.redis.keys('blocked_ip:*');

    return {
      totalEvents: allKeys.length,
      eventsByType,
      eventsBySeverity,
      blockedIps: blockedIpsKeys.length,
    };
  }
}