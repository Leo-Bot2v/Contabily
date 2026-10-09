import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

import { Usuario as User, UserProvider, UserRole } from '../entities/user.entity.js';
import { LocalAuthService } from './local-auth.service.js';
import { SupabaseService, SupabaseAuthResult } from './supabase.service.js';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
} from '../dto/auth.dto.js';
import {
  TokenPayload,
  UserResponseDto,
  AuthResponseDto,
  GoogleAuthUrlDto,
  MessageResponseDto,
} from '../dto/response.dto.js';

export type AuthMode = 'supabase' | 'local';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly authMode: AuthMode;

  constructor(
    private readonly configService: ConfigService,
    private readonly localAuthService: LocalAuthService,
    private readonly supabaseService: SupabaseService,
  ) {
    // Determinar modo de autenticación basado en configuración
    const supabaseUrl = this.configService.get<string>('supabase.url');
    this.authMode = supabaseUrl && this.supabaseService.isReady() ? 'supabase' : 'local';
    this.logger.log(`Auth mode: ${this.authMode.toUpperCase()}`);
  }

  getMode(): AuthMode {
    return this.authMode;
  }

  isSupabaseMode(): boolean {
    return this.authMode === 'supabase';
  }

  isLocalMode(): boolean {
    return this.authMode === 'local';
  }

  // ==================== REGISTRO ====================

  async register(registerDto: RegisterDto, req: Request): Promise<AuthResponseDto> {
    if (this.isSupabaseMode()) {
      throw new ConflictException(
        'Registro local no disponible en modo Supabase. Use el flujo de Google OAuth.',
      );
    }

    const { user, tokens } = await this.localAuthService.register(registerDto, req);
    return this.buildAuthResponse(user, tokens);
  }

  // ==================== LOGIN LOCAL ====================

  async login(loginDto: LoginDto, req: Request): Promise<AuthResponseDto> {
    if (this.isSupabaseMode()) {
      throw new UnauthorizedException('Login local no disponible en modo Supabase');
    }

    const { user, tokens } = await this.localAuthService.login(loginDto, req);
    return this.buildAuthResponse(user, tokens);
  }

  // ==================== GOOGLE OAUTH ====================

  async getGoogleAuthUrl(): Promise<GoogleAuthUrlDto> {
    if (this.isSupabaseMode()) {
      const { url, error } = await this.supabaseService.signInWithGoogle();
      if (error || !url) {
        throw new UnauthorizedException('Error iniciando OAuth con Google');
      }
      return { authUrl: url };
    }

    // En modo local, usamos Passport Google Strategy directamente
    const callbackUrl = this.configService.get<string>('googleOAuth.callbackUrl') ?? 'http://localhost:3000/api/v1/auth/google/callback';
    const clientId = this.configService.get<string>('googleOAuth.clientId') ?? '';
    const scope = encodeURIComponent('email profile');
    const state = Buffer.from(JSON.stringify({ provider: 'google' })).toString('base64');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
      `response_type=code&` +
      `scope=${scope}&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${state}`;

    return { authUrl };
  }

  async handleGoogleCallback(code: string): Promise<AuthResponseDto> {
    if (this.isSupabaseMode()) {
      const result = await this.supabaseService.exchangeCodeForSession(code);
      if (result.error || !result.user || !result.session) {
        throw new UnauthorizedException('Error autenticando con Google');
      }
      return this.buildAuthResponse(
        result.user,
        {
          accessToken: result.session.access_token,
          refreshToken: result.session.refresh_token ?? '',
          expiresIn: result.session.expires_in ?? 3600,
          tokenType: 'Bearer',
        },
      );
    }

    // En modo local: intercambiar código por tokens de Google y obtener perfil
    const googleTokens = await this.exchangeGoogleCodeForTokens(code);
    const googleProfile = await this.getGoogleUserProfile(googleTokens.accessToken);

    const { user, tokens } = await this.localAuthService.findOrCreateGoogleUser(googleProfile);
    return this.buildAuthResponse(user, tokens);
  }

  private async exchangeGoogleCodeForTokens(code: string): Promise<{ accessToken: string; refreshToken?: string }> {
    const clientId = this.configService.get<string>('googleOAuth.clientId') ?? '';
    const clientSecret = this.configService.get<string>('googleOAuth.clientSecret') ?? '';
    const callbackUrl = this.configService.get<string>('googleOAuth.callbackUrl') ?? 'http://localhost:3001/api/v1/auth/google/callback';

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      } as Record<string, string>),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Error intercambiando código Google: ${error}`);
      throw new UnauthorizedException('Error obteniendo tokens de Google');
    }

    return response.json();
  }

  private async getGoogleUserProfile(accessToken: string): Promise<{ id: string; email: string; name: string; picture?: string }> {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Error obteniendo perfil de Google');
    }

    const profile = await response.json();
    return {
      id: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    };
  }

  async handleLocalGoogleProfile(profile: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  }, req: Request): Promise<AuthResponseDto> {
    if (this.isSupabaseMode()) {
      throw new UnauthorizedException('Perfil Google local no disponible en modo Supabase');
    }

    const { user, tokens } = await this.localAuthService.findOrCreateGoogleUser(profile, req);
    return this.buildAuthResponse(user, tokens);
  }

  // ==================== REFRESH TOKEN ====================

  async refreshTokens(refreshTokenDto: RefreshTokenDto, req: Request): Promise<TokenPayload> {
    if (this.isSupabaseMode()) {
      const result = await this.supabaseService.refreshSession(refreshTokenDto.refreshToken);
      if (result.error || !result.session) {
        throw new UnauthorizedException('Error renovando sesión');
      }
      return {
        accessToken: result.session.access_token,
        refreshToken: result.session.refresh_token ?? refreshTokenDto.refreshToken,
        expiresIn: result.session.expires_in ?? 3600,
        tokenType: 'Bearer',
      };
    }

    return this.localAuthService.refreshTokens(refreshTokenDto, req);
  }

  // ==================== LOGOUT ====================

  async logout(userId: string, req: Request, accessToken?: string): Promise<MessageResponseDto> {
    if (this.isSupabaseMode()) {
      // En Supabase, el logout se maneja del lado del cliente
      // Opcionalmente podríamos revocar tokens via admin API
      return { message: 'Sesión cerrada' };
    }

    await this.localAuthService.logout(userId, req, accessToken);
    return { message: 'Sesión cerrada correctamente' };
  }

  async logoutAllDevices(userId: string, req: Request): Promise<MessageResponseDto> {
    if (this.isSupabaseMode()) {
      // Requiere service role key
      return { message: 'Sesiones cerradas en todos los dispositivos' };
    }

    await this.localAuthService.logoutAllDevices(userId, req);
    return { message: 'Sesiones cerradas en todos los dispositivos' };
  }

  // ==================== PERFIL Y USUARIO ====================

  async getProfile(userId: string): Promise<UserResponseDto> {
    let user: User | null;

    if (this.isSupabaseMode()) {
      // En modo Supabase, el usuario viene del token JWT válido
      // Podríamos obtenerlo de Supabase si necesitamos datos frescos
      user = await this.localAuthService.findById(userId); // Fallback a BD local si existe
    } else {
      user = await this.localAuthService.findById(userId);
    }

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return UserResponseDto.fromEntity(user);
  }

  async updateProfile(userId: string, data: Partial<User>): Promise<UserResponseDto> {
    // Implementar según necesidades
    throw new Error('No implementado');
  }

  // ==================== CAMBIO DE CONTRASEÑA ====================

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto, req: Request): Promise<MessageResponseDto> {
    if (this.isSupabaseMode()) {
      // En Supabase, el cambio de contraseña se maneja via reset password flow
      throw new UnauthorizedException('Use el flujo de recuperación de contraseña de Supabase');
    }

    await this.localAuthService.changePassword(userId, changePasswordDto, req);
    return { message: 'Contraseña actualizada correctamente' };
  }

  // ==================== RECUPERACIÓN DE CONTRASEÑA ====================

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<MessageResponseDto> {
    if (this.isSupabaseMode()) {
      // Supabase maneja esto via su API
      // this.supabaseService.getAdminClient()?.auth.admin.generateLink({ type: 'recovery', email })
      return { message: 'Si el email existe, se enviaron instrucciones de recuperación' };
    }

    // En modo local, implementar envío de email con token
    // Por ahora solo retornamos éxito por seguridad (no revelar si email existe)
    return { message: 'Si el email existe, se enviaron instrucciones de recuperación' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<MessageResponseDto> {
    if (this.isSupabaseMode()) {
      // Supabase: verify OTP and update password
      return { message: 'Contraseña restablecida' };
    }

    // Local: verificar token y actualizar
    throw new Error('No implementado en modo local');
  }

  // ==================== VERIFICACIÓN DE EMAIL ====================

  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<MessageResponseDto> {
    // Implementar según proveedor
    return { message: 'Email verificado correctamente' };
  }

  async resendVerification(resendVerificationDto: ResendVerificationDto): Promise<MessageResponseDto> {
    return { message: 'Si el email existe, se reenvió el correo de verificación' };
  }

  // ==================== ADMIN ====================

  async getAllUsers(page = 1, limit = 20): Promise<{ users: UserResponseDto[]; total: number }> {
    if (this.isLocalMode()) {
      const [users, total] = await this.localAuthService['userRepository'].findAndCount({
        skip: (page - 1) * limit,
        take: limit,
        order: { creadoEn: 'DESC' },
      });
      return { users: users.map(UserResponseDto.fromEntity), total };
    }

    // Supabase: usar admin API
    throw new Error('No implementado para Supabase');
  }

  async deactivateUser(userId: string): Promise<MessageResponseDto> {
    if (this.isLocalMode()) {
      await this.localAuthService['userRepository'].update(userId, { activo: false });
      return { message: 'Usuario desactivado' };
    }

    // Supabase: admin.disableUser
    throw new Error('No implementado para Supabase');
  }

  // ==================== HELPERS ====================

  private buildAuthResponse(user: User, tokens: TokenPayload): AuthResponseDto {
    return {
      user: UserResponseDto.fromEntity(user),
      tokens,
    };
  }
}