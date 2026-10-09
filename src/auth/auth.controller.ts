import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { AuthService } from './services/auth.service.js';
import { LocalAuthService } from './services/local-auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard.js';
import { GoogleAuthGuard } from './guards/google-auth.guard.js';

import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
} from './dto/auth.dto.js';
import {
  AuthResponseDto,
  UserResponseDto,
  TokenPayload,
  GoogleAuthUrlDto,
  MessageResponseDto,
} from './dto/response.dto.js';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly localAuthService: LocalAuthService,
  ) {}

  // ==================== REGISTRO ====================

  @Post('register')
  @ApiOperation({ summary: 'Registrar nuevo usuario (solo modo local)' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  async register(@Body() registerDto: RegisterDto, @Req() req: Request): Promise<AuthResponseDto> {
    return this.authService.register(registerDto, req);
  }

  // ==================== LOGIN LOCAL ====================

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión con email y contraseña (solo modo local)' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    return this.authService.login(loginDto, req);
  }

  // ==================== GOOGLE OAUTH ====================

  @Get('google')
  @ApiOperation({ summary: 'Obtener URL para autenticación con Google' })
  @ApiResponse({ status: 200, type: GoogleAuthUrlDto })
  async getGoogleAuthUrl(): Promise<GoogleAuthUrlDto> {
    return this.authService.getGoogleAuthUrl();
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Callback de Google OAuth' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Error en autenticación Google' })
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    // El guard GoogleAuthGuard maneja la autenticación y adjunta el usuario a req.user
    // En modo local, redirigimos al frontend con tokens
    // En modo Supabase, Supabase maneja la redirección

    const user = req.user as any;
    const tokens = (req as any).tokens;

    if (this.authService.isLocalMode()) {
      // Redirigir al frontend con tokens en query params (o usar cookies)
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
      const redirectUrl = `${frontendUrl}/auth/callback?` +
        `access_token=${tokens.accessToken}&` +
        `refresh_token=${tokens.refreshToken}&` +
        `expires_in=${tokens.expiresIn}`;

      return res.redirect(redirectUrl);
    }

    // Modo Supabase: ya redirigió Supabase
    res.json({ message: 'Autenticado con Supabase' });
    return;
  }

  // Callback alternativo para modo local sin Passport (usando código directamente)
  @Post('google/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Callback de Google OAuth con código de autorización (modo local)' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async googleCallbackWithCode(@Body('code') code: string): Promise<AuthResponseDto> {
    if (!code) {
      throw new Error('Código de autorización requerido');
    }
    return this.authService.handleGoogleCallback(code);
  }

  // ==================== REFRESH TOKEN ====================

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token usando refresh token' })
  @ApiBearerAuth('refresh-token')
  @ApiResponse({ status: 200, type: TokenPayload })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o expirado' })
  async refreshTokens(@Req() req: Request, @Body() refreshTokenDto: RefreshTokenDto): Promise<TokenPayload> {
    return this.authService.refreshTokens(refreshTokenDto, req);
  }

  // Alternativa sin guard para más control
  @Post('refresh/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar tokens (body con refresh token)' })
  @ApiResponse({ status: 200, type: TokenPayload })
  async refreshTokensBody(@Body() refreshTokenDto: RefreshTokenDto, @Req() req: Request): Promise<TokenPayload> {
    return this.authService.refreshTokens(refreshTokenDto, req);
  }

  // ==================== LOGOUT ====================

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cerrar sesión actual' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async logout(@Req() req: Request): Promise<MessageResponseDto> {
    const user = req.user as any;
    const authHeader = req.headers.authorization?.replace('Bearer ', '');
    return this.authService.logout(user.id, req, authHeader);
  }

  @Post('logout/all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cerrar sesión en todos los dispositivos' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async logoutAllDevices(@Req() req: Request): Promise<MessageResponseDto> {
    const user = req.user as any;
    return this.authService.logoutAllDevices(user.id, req);
  }

  // ==================== PERFIL ====================

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async getProfile(@Req() req: Request): Promise<UserResponseDto> {
    const user = req.user as any;
    return this.authService.getProfile(user.id);
  }

  // ==================== CAMBIO DE CONTRASEÑA ====================

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cambiar contraseña (solo cuentas locales)' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  @ApiResponse({ status: 401, description: 'Contraseña actual incorrecta o cuenta OAuth' })
  async changePassword(
    @Req() req: Request,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<MessageResponseDto> {
    const user = req.user as any;
    return this.authService.changePassword(user.id, changePasswordDto, req);
  }

  // ==================== RECUPERACIÓN DE CONTRASEÑA ====================

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar recuperación de contraseña' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto): Promise<MessageResponseDto> {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restablecer contraseña con token' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.authService.resetPassword(resetPasswordDto);
  }

  // ==================== VERIFICACIÓN DE EMAIL ====================

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar email con token' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto): Promise<MessageResponseDto> {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenviar email de verificación' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async resendVerification(@Body() resendVerificationDto: ResendVerificationDto): Promise<MessageResponseDto> {
    return this.authService.resendVerification(resendVerificationDto);
  }

  // ==================== INFORMACIÓN DE MODO ====================

  @Get('mode')
  @ApiOperation({ summary: 'Obtener modo de autenticación actual' })
  @ApiResponse({ status: 200, schema: { example: { mode: 'local', supabaseConfigured: false } } })
  getAuthMode(): { mode: string; supabaseConfigured: boolean } {
    return {
      mode: this.authService.getMode(),
      supabaseConfigured: this.authService.isSupabaseMode(),
    };
  }
}