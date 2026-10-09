import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';

export interface DeviceInfo {
  fingerprint: string;
  ip: string;
  userAgent: string;
  language: string;
  timezone: string;
  screenResolution?: string;
  platform: string;
  isMobile: boolean;
  isBot: boolean;
  trustScore: number; // 0-100
}

@Injectable()
export class DeviceFingerprintService {
  private readonly TRUSTED_FINGERPRINTS_TTL = 30 * 24 * 60 * 60; // 30 días

  // ==================== GENERAR FINGERPRINT ====================

  generateFingerprint(req: Request): DeviceInfo {
    const ip = this.getClientIp(req);
    const userAgent = req.headers['user-agent'] ?? '';
    const language = req.headers['accept-language'] ?? '';
    const acceptEncoding = req.headers['accept-encoding'] ?? '';
    const accept = req.headers['accept'] ?? '';

    // Componentes del fingerprint
    const components = [
      userAgent,
      language,
      acceptEncoding,
      accept,
      // Podríamos agregar más: cookies, headers específicos, etc.
    ];

    const fingerprint = crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex')
      .substring(0, 32);

    const parsedUA = this.parseUserAgent(userAgent);

    const timezoneHeader = req.headers['x-timezone'];
      const timezone = Array.isArray(timezoneHeader) ? timezoneHeader[0] : timezoneHeader ?? 'unknown';

    return {
      fingerprint,
      ip,
      userAgent,
      language,
      timezone,
      platform: parsedUA.platform,
      isMobile: parsedUA.isMobile,
      isBot: parsedUA.isBot,
      trustScore: this.calculateTrustScore(parsedUA, ip),
    };
  }

  // ==================== VERIFICAR DISPOSITIVO CONOCIDO ====================

  async isKnownDevice(userId: string, fingerprint: string, redis: any): Promise<boolean> {
    const key = `device:${userId}:${fingerprint}`;
    return (await redis.exists(key)) === 1;
  }

  async registerDevice(userId: string, fingerprint: string, redis: any): Promise<void> {
    const key = `device:${userId}:${fingerprint}`;
    await redis.setEx(key, this.TRUSTED_FINGERPRINTS_TTL, JSON.stringify({
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    }));
  }

  async updateDeviceLastSeen(userId: string, fingerprint: string, redis: any): Promise<void> {
    const key = `device:${userId}:${fingerprint}`;
    const data = await redis.get(key);
    if (data) {
      const device = JSON.parse(data);
      device.lastSeen = new Date().toISOString();
      await redis.setEx(key, this.TRUSTED_FINGERPRINTS_TTL, JSON.stringify(device));
    }
  }

  async getUserDevices(userId: string, redis: any): Promise<Array<{ fingerprint: string; registeredAt: string; lastSeen: string }>> {
    const keys = await redis.keys(`device:${userId}:*`);
    const devices = [];

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const fp = key.split(':').pop();
        devices.push({ fingerprint: fp ?? '', ...JSON.parse(data) });
      }
    }

    return devices.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
  }

  async revokeDevice(userId: string, fingerprint: string, redis: any): Promise<void> {
    const key = `device:${userId}:${fingerprint}`;
    await redis.del(key);
  }

  // ==================== HELPERS ====================

  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.headers['x-real-ip'] as string ??
      req.socket?.remoteAddress ??
      'unknown'
    );
  }

  private parseUserAgent(ua: string): { platform: string; isMobile: boolean; isBot: boolean } {
    const lowerUA = ua.toLowerCase();

    // Bot detection
    const botPatterns = ['bot', 'crawler', 'spider', 'scraper', 'googlebot', 'bingbot'];
    const isBot = botPatterns.some(pattern => lowerUA.includes(pattern));

    // Mobile detection
    const mobilePatterns = ['mobile', 'android', 'iphone', 'ipad', 'ipod'];
    const isMobile = mobilePatterns.some(pattern => lowerUA.includes(pattern));

    // Platform
    let platform = 'unknown';
    if (lowerUA.includes('windows')) platform = 'Windows';
    else if (lowerUA.includes('macintosh') || lowerUA.includes('mac os')) platform = 'macOS';
    else if (lowerUA.includes('linux')) platform = 'Linux';
    else if (lowerUA.includes('android')) platform = 'Android';
    else if (lowerUA.includes('iphone') || lowerUA.includes('ipad') || lowerUA.includes('ipod')) platform = 'iOS';

    return { platform, isMobile, isBot };
  }

  private calculateTrustScore(parsedUA: { platform: string; isMobile: boolean; isBot: boolean }, ip: string): number {
    let score = 50; // Base

    if (parsedUA.isBot) score -= 30;
    if (parsedUA.platform === 'unknown') score -= 10;
    if (ip === 'unknown') score -= 10;
    if (parsedUA.isMobile) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  // ==================== DETECCIÓN DE ANOMALÍAS ====================

  detectAnomaly(
    currentDevice: DeviceInfo,
    knownDevices: Array<{ fingerprint: string; lastSeen: string }>,
  ): { isAnomaly: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // Dispositivo completamente nuevo
    const isKnown = knownDevices.some(d => d.fingerprint === currentDevice.fingerprint);
    if (!isKnown && knownDevices.length > 0) {
      reasons.push('Dispositivo no reconocido');
    }

    // Cambio de IP geográfica significativa (simplificado)
    // En producción, usar GeoIP

    // User Agent inconsistente
    if (currentDevice.isBot) {
      reasons.push('User Agent de bot detectado');
    }

    return {
      isAnomaly: reasons.length > 0,
      reasons,
    };
  }
}