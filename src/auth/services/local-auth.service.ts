import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { Request } from 'express';

import { Usuario as User, UserProvider, UserRole } from '../entities/user.entity.js';
import { RegisterDto, LoginDto, ChangePasswordDto, RefreshTokenDto } from '../dto/auth.dto.js';
import { TokenPayload } from '../dto/response.dto.js';
import { JwtConfig } from '../../config/configuration.js';

import { TokenBlacklistService } from '../../security/services/token-blacklist.service.js';
import { SecurityAuditService, SecurityEventType } from '../../security/services/security-audit.service.js';
import { DeviceFingerprintService, DeviceInfo } from '../../security/services/device-fingerprint.service.js';
import { JwtRsaService } from '../../security/services/jwt-rsa.service.js';

@Injectable()
export class LocalAuthService {
  private readonly logger = new Logger(LocalAuthService.name);
  private readonly jwtConfig: JwtConfig;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenBlacklist: TokenBlacklistService,
    private readonly securityAudit: SecurityAuditService,
    private readonly deviceFingerprint: DeviceFingerprintService,
    private readonly jwtRsa: JwtRsaService,
  ) {
    this.jwtConfig = {
      secret: process.env.JWT_SECRET ?? 'default-secret',
      expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'default-refresh-secret',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    };
  }

  // ==================== REGISTRO ====================

  async register(registerDto: RegisterDto, req: Request): Promise<{ user: User; tokens: TokenPayload }> {
    const { email, password, fullName } = registerDto;
    const deviceInfo = this.deviceFingerprint.generateFingerprint(req);

    // Verificar si el usuario ya existe
    const existingUser = await this.userRepository.findOne({ where: { correo: email } });
    if (existingUser) {
      await this.securityAudit.logEvent({
        eventType: 'register',
        email,
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        deviceFingerprint: deviceInfo.fingerprint,
        success: false,
        severity: 'medium',
        details: { reason: 'email_already_exists' },
      });
      throw new ConflictException('El email ya está registrado');
    }

    // Verificar IP bloqueada
    if (await this.securityAudit.isIpBlocked(deviceInfo.ip)) {
      await this.securityAudit.logEvent({
        eventType: 'register',
        email,
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        deviceFingerprint: deviceInfo.fingerprint,
        success: false,
        severity: 'high',
        details: { reason: 'ip_blocked' },
      });
      throw new UnauthorizedException('Demasiados intentos. Intente más tarde.');
    }

    // Hashear contraseña
    const passwordHash = await this.hashPassword(password);

    // Crear usuario
    const user = this.userRepository.create({
      correo: email,
      hashContrasena: passwordHash,
      nombreCompleto: fullName ?? null,
      proveedor: UserProvider.LOCAL,
      proveedorId: null,
      roles: [UserRole.USUARIO],
      activo: true,
      correoVerificado: false,
    });

    const savedUser = await this.userRepository.save(user);
    this.logger.log(`Usuario registrado: ${savedUser.correo}`);

    const tokens = await this.generateTokens(savedUser, deviceInfo);
    await this.updateRefreshToken(savedUser.id, tokens.refreshToken);

    // Registrar dispositivo
    await this.deviceFingerprint.registerDevice(savedUser.id, deviceInfo.fingerprint, this.tokenBlacklist['redis']);

    // Auditoría
    await this.securityAudit.logEvent({
      eventType: 'register',
      userId: savedUser.id,
      email: savedUser.correo,
      ip: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
      deviceFingerprint: deviceInfo.fingerprint,
      success: true,
      severity: 'low',
      details: { provider: UserProvider.LOCAL },
    });

    return { user: savedUser, tokens };
  }

  // ==================== LOGIN ====================

  async login(loginDto: LoginDto, req: Request): Promise<{ user: User; tokens: TokenPayload }> {
    const { email, password } = loginDto;
    const deviceInfo = this.deviceFingerprint.generateFingerprint(req);

    // Verificar IP bloqueada
    if (await this.securityAudit.isIpBlocked(deviceInfo.ip)) {
      await this.securityAudit.logEvent({
        eventType: 'login_failed',
        email,
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        deviceFingerprint: deviceInfo.fingerprint,
        success: false,
        severity: 'high',
        details: { reason: 'ip_blocked' },
      });
      throw new UnauthorizedException('Demasiados intentos. Intente más tarde.');
    }

    const user = await this.userRepository.findOne({
      where: { correo: email, proveedor: UserProvider.LOCAL },
      select: {
        id: true,
        correo: true,
        nombreCompleto: true,
        urlAvatar: true,
        proveedor: true,
        proveedorId: true,
        hashContrasena: true,
        hashRefreshToken: true,
        roles: true,
        activo: true,
        correoVerificado: true,
        ultimoLogin: true,
        creadoEn: true,
        actualizadoEn: true,
        eliminadoEn: true,
      },
    });

    if (!user || !user.hashContrasena) {
      await this.securityAudit.logEvent({
        eventType: 'login_failed',
        email,
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        deviceFingerprint: deviceInfo.fingerprint,
        success: false,
        severity: 'medium',
        details: { reason: 'user_not_found_or_oauth' },
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.activo) {
      await this.securityAudit.logEvent({
        eventType: 'login_failed',
        userId: user.id,
        email,
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        deviceFingerprint: deviceInfo.fingerprint,
        success: false,
        severity: 'medium',
        details: { reason: 'account_disabled' },
      });
      throw new UnauthorizedException('La cuenta está desactivada');
    }

    const isPasswordValid = await this.verifyPassword(password, user.hashContrasena);
    if (!isPasswordValid) {
      await this.securityAudit.logEvent({
        eventType: 'login_failed',
        userId: user.id,
        email,
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        deviceFingerprint: deviceInfo.fingerprint,
        success: false,
        severity: 'medium',
        details: { reason: 'invalid_password' },
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar anomalías de dispositivo
    const knownDevices = await this.deviceFingerprint.getUserDevices(user.id, this.tokenBlacklist['redis']);
    const anomaly = this.deviceFingerprint.detectAnomaly(deviceInfo, knownDevices);
    
    if (anomaly.isAnomaly) {
      await this.securityAudit.logEvent({
        eventType: 'suspicious_activity',
        userId: user.id,
        email,
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        deviceFingerprint: deviceInfo.fingerprint,
        success: true,
        severity: 'high',
        details: { anomalyReasons: anomaly.reasons, knownDevicesCount: knownDevices.length },
      });
    }

    // Actualizar último login
    user.ultimoLogin = new Date();
    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user, deviceInfo);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    // Actualizar dispositivo
    await this.deviceFingerprint.updateDeviceLastSeen(user.id, deviceInfo.fingerprint, this.tokenBlacklist['redis']);

    // Auditoría
    await this.securityAudit.logEvent({
      eventType: 'login_success',
      userId: user.id,
      email: user.correo,
      ip: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
      deviceFingerprint: deviceInfo.fingerprint,
      success: true,
      severity: 'low',
      details: { provider: UserProvider.LOCAL, anomaly: anomaly.isAnomaly },
    });

    this.logger.log(`Login exitoso: ${user.correo}`);
    return { user, tokens };
  }

  // ==================== GOOGLE OAUTH (Local) ====================

  async findOrCreateGoogleUser(googleProfile: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  }, req?: Request): Promise<{ user: User; tokens: TokenPayload }> {
    const deviceInfo = req ? this.deviceFingerprint.generateFingerprint(req) : {
      fingerprint: 'oauth-callback',
      ip: 'unknown',
      userAgent: 'Google OAuth',
      language: 'unknown',
      timezone: 'unknown',
      platform: 'unknown',
      isMobile: false,
      isBot: false,
      trustScore: 50,
    };

    // Buscar por providerId
    let user = await this.userRepository.findOne({
      where: { proveedor: UserProvider.GOOGLE, proveedorId: googleProfile.id },
    });

    if (!user) {
      // Buscar por email (posible cuenta local existente)
      user = await this.userRepository.findOne({ where: { correo: googleProfile.email } });

      if (user) {
        // Vincular cuenta Google a cuenta existente
        user.proveedor = UserProvider.GOOGLE;
        user.proveedorId = googleProfile.id;
        user.urlAvatar = googleProfile.picture ?? user.urlAvatar;
        user.nombreCompleto = user.nombreCompleto ?? googleProfile.name;
        user.correoVerificado = true;
        await this.userRepository.save(user);
        this.logger.log(`Cuenta Google vinculada a usuario existente: ${user.correo}`);
      } else {
        // Crear nuevo usuario
        user = this.userRepository.create({
          correo: googleProfile.email,
          nombreCompleto: googleProfile.name,
          urlAvatar: googleProfile.picture ?? null,
          proveedor: UserProvider.GOOGLE,
          proveedorId: googleProfile.id,
          hashContrasena: null,
          roles: [UserRole.USUARIO],
          activo: true,
          correoVerificado: true,
        });
        user = await this.userRepository.save(user);
        this.logger.log(`Nuevo usuario Google creado: ${user.correo}`);
      }
    } else {
      // Actualizar info del perfil
      user.urlAvatar = googleProfile.picture ?? user.urlAvatar;
      user.nombreCompleto = user.nombreCompleto ?? googleProfile.name;
      user.ultimoLogin = new Date();
      await this.userRepository.save(user);
    }

    const tokens = await this.generateTokens(user, deviceInfo);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    // Registrar dispositivo
    await this.deviceFingerprint.registerDevice(user.id, deviceInfo.fingerprint, this.tokenBlacklist['redis']);

    // Auditoría
    await this.securityAudit.logEvent({
      eventType: 'oauth_login',
      userId: user.id,
      email: user.correo,
      ip: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
      deviceFingerprint: deviceInfo.fingerprint,
      success: true,
      severity: 'low',
      details: { provider: 'google', providerId: googleProfile.id },
    });

    return { user, tokens };
  }

  // ==================== REFRESH TOKEN ====================

  async refreshTokens(refreshTokenDto: RefreshTokenDto, req: Request): Promise<TokenPayload> {
    const deviceInfo = this.deviceFingerprint.generateFingerprint(req);
    const refreshToken = refreshTokenDto.refreshToken;

    // Decodificar para obtener userId
    let payload: { sub: string; type: string } | null = null;
    try {
      payload = this.jwtRsa.decode(refreshToken) as any;
    } catch {
      // Fallback a HS256 si RS256 falla
      payload = this.jwtService.decode(refreshToken) as any;
    }

    if (!payload || payload.type !== 'refresh' || !payload.sub) {
      await this.securityAudit.logEvent({
        eventType: 'token_refresh',
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        deviceFingerprint: deviceInfo.fingerprint,
        success: false,
        severity: 'medium',
        details: { reason: 'invalid_token_format' },
      });
      throw new UnauthorizedException('Refresh token inválido');
    }

    // Verificar blacklist
    const tokenId = this.extractTokenId(refreshToken);
    if (await this.tokenBlacklist.isBlacklisted(tokenId)) {
      await this.securityAudit.logEvent({
        eventType: 'token_refresh',
        userId: payload.sub,
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        deviceFingerprint: deviceInfo.fingerprint,
        success: false,
        severity: 'high',
        details: { reason: 'token_blacklisted', tokenId },
      });
      throw new UnauthorizedException('Token revocado');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub, activo: true },
      select: {
        id: true,
        correo: true,
        roles: true,
        hashRefreshToken: true,
        activo: true,
      },
    });

    if (!user) {
      await this.securityAudit.logEvent({
        eventType: 'token_refresh',
        userId: payload.sub,
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        deviceFingerprint: deviceInfo.fingerprint,
        success: false,
        severity: 'medium',
        details: { reason: 'user_not_found' },
      });
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!user.activo) {
      throw new UnauthorizedException('La cuenta está desactivada');
    }

    // Verificar que el refresh token coincida
    const isValidRefresh = user.hashRefreshToken && await this.verifyPassword(refreshToken, user.hashRefreshToken);
    if (!isValidRefresh) {
      await this.securityAudit.logEvent({
        eventType: 'token_refresh',
        userId: user.id,
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        deviceFingerprint: deviceInfo.fingerprint,
        success: false,
        severity: 'high',
        details: { reason: 'refresh_token_mismatch' },
      });
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // Rotar refresh token (invalidar el anterior)
    await this.tokenBlacklist.addToBlacklist(tokenId, user.id, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'logout');

    const tokens = await this.generateTokens(user, deviceInfo);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    // Auditoría
    await this.securityAudit.logEvent({
      eventType: 'token_refresh',
      userId: user.id,
      email: user.correo,
      ip: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
      deviceFingerprint: deviceInfo.fingerprint,
      success: true,
      severity: 'low',
    });

    return tokens;
  }

  // ==================== LOGOUT ====================

  async logout(userId: string, req: Request, accessToken?: string): Promise<void> {
    const deviceInfo = this.deviceFingerprint.generateFingerprint(req);

    // Blacklist access token si se proporciona
    if (accessToken) {
      const tokenId = this.extractTokenId(accessToken);
      const decoded = this.jwtRsa.decode(accessToken) as any ?? this.jwtService.decode(accessToken) as any;
      if (decoded?.exp) {
        const expiresAt = new Date(decoded.exp * 1000);
        await this.tokenBlacklist.addToBlacklist(tokenId, userId, expiresAt, 'logout');
      }
    }

    // Invalidar refresh token
    await this.userRepository.update(userId, { hashRefreshToken: null });

    // Auditoría
    await this.securityAudit.logEvent({
      eventType: 'logout',
      userId,
      ip: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
      deviceFingerprint: deviceInfo.fingerprint,
      success: true,
      severity: 'low',
    });

    this.logger.log(`Logout: ${userId}`);
  }

  async logoutAllDevices(userId: string, req: Request): Promise<void> {
    const deviceInfo = this.deviceFingerprint.generateFingerprint(req);

    // Revocar todos los tokens del usuario
    const revokedCount = await this.tokenBlacklist.revokeAllUserTokens(userId, 'security');

    // Invalidar refresh token
    await this.userRepository.update(userId, { hashRefreshToken: null });

    // Auditoría
    await this.securityAudit.logEvent({
      eventType: 'all_tokens_revoked',
      userId,
      ip: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
      deviceFingerprint: deviceInfo.fingerprint,
      success: true,
      severity: 'medium',
      details: { revokedTokensCount: revokedCount },
    });

    this.logger.log(`Logout all devices: ${userId} (${revokedCount} tokens revocados)`);
  }

  // ==================== CAMBIO DE CONTRASEÑA ====================

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto, req: Request): Promise<void> {
    const deviceInfo = this.deviceFingerprint.generateFingerprint(req);
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.proveedor !== UserProvider.LOCAL || !user.hashContrasena) {
      await this.securityAudit.logEvent({
        eventType: 'password_change',
        userId,
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        deviceFingerprint: deviceInfo.fingerprint,
        success: false,
        severity: 'medium',
        details: { reason: 'oauth_account' },
      });
      throw new UnauthorizedException('No se puede cambiar contraseña en cuentas OAuth');
    }

    const isCurrentPasswordValid = await this.verifyPassword(
      changePasswordDto.currentPassword,
      user.hashContrasena,
    );

    if (!isCurrentPasswordValid) {
      await this.securityAudit.logEvent({
        eventType: 'password_change',
        userId,
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        deviceFingerprint: deviceInfo.fingerprint,
        success: false,
        severity: 'medium',
        details: { reason: 'invalid_current_password' },
      });
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    const newPasswordHash = await this.hashPassword(changePasswordDto.newPassword);
    await this.userRepository.update(userId, { hashContrasena: newPasswordHash });

    // Invalidar todos los refresh tokens (forzar re-login)
    await this.tokenBlacklist.revokeAllUserTokens(userId, 'security');
    await this.userRepository.update(userId, { hashRefreshToken: null });

    // Auditoría
    await this.securityAudit.logEvent({
      eventType: 'password_change',
      userId,
      ip: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
      deviceFingerprint: deviceInfo.fingerprint,
      success: true,
      severity: 'medium',
    });

    this.logger.log(`Contraseña cambiada: ${userId}`);
  }

  // ==================== BÚSQUEDA ====================

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { correo: email } });
  }

  async findByProviderId(provider: UserProvider, providerId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { proveedor: provider, proveedorId: providerId } });
  }

  // ==================== PRIVADOS ====================

  private async generateTokens(user: User, deviceInfo: DeviceInfo): Promise<TokenPayload> {
    const payload = {
      sub: user.id,
      email: user.correo,
      roles: user.roles,
      deviceId: deviceInfo.fingerprint,
    };

    // Usar RS256 si las claves están disponibles, sino HS256
    let accessToken: string;
    let refreshToken: string;

    if (this.jwtRsa.hasKeys()) {
      accessToken = this.jwtRsa.sign(payload, { expiresIn: this.jwtConfig.expiresIn });
      refreshToken = this.jwtRsa.sign(
        { sub: user.id, type: 'refresh' },
        { expiresIn: this.jwtConfig.refreshExpiresIn },
      );
    } else {
      accessToken = this.jwtService.sign(payload, {
        secret: this.jwtConfig.secret,
        expiresIn: this.jwtConfig.expiresIn as any,
      });
      refreshToken = this.jwtService.sign(
        { sub: user.id, type: 'refresh' },
        {
          secret: this.jwtConfig.refreshSecret,
          expiresIn: this.jwtConfig.refreshExpiresIn as any,
        },
      );
    }

    const expiresIn = this.parseExpiration(this.jwtConfig.expiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
    };
  }

  private async updateRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const refreshTokenHash = await this.hashPassword(refreshToken);
    await this.userRepository.update(userId, { hashRefreshToken: refreshTokenHash });
  }

  private extractTokenId(token: string): string {
    // Usar hash del token como ID único para blacklist
    return createHash('sha256').update(token).digest('hex').substring(0, 32);
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private parseExpiration(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 86400;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return value * (multipliers[unit] ?? 86400);
  }

  // ==================== UTILIDADES PARA TESTING ====================

  async createTestUser(overrides: Partial<User> = {}): Promise<User> {
    const user = this.userRepository.create({
      correo: `test-${randomBytes(4).toString('hex')}@example.com`,
      nombreCompleto: 'Test User',
      proveedor: UserProvider.LOCAL,
      hashContrasena: await this.hashPassword('Test1234!'),
      roles: [UserRole.USUARIO],
      activo: true,
      correoVerificado: true,
      ...overrides,
    });
    return this.userRepository.save(user);
  }

  async cleanTestUsers(): Promise<number> {
    const result = await this.userRepository
      .createQueryBuilder()
      .delete()
      .where('correo LIKE :pattern', { pattern: 'test-%@example.com' })
      .execute();
    return result.affected ?? 0;
  }
}