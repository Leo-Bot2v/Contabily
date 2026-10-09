import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  private readonly logger = new Logger(GoogleAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authService = request.app.get('AuthService');

    // Verificar si estamos en modo local o Supabase
    const isLocalMode = authService?.isLocalMode?.() ?? true;

    if (isLocalMode) {
      // En modo local, usamos estrategia personalizada con código en body o query
      const code = request.query.code || request.body?.code;

      if (!code) {
        // No hay código, iniciar flujo OAuth
        return this.initiateGoogleOAuth(request);
      }

      try {
        // Intercambiar código por perfil
        const result = await authService.handleGoogleCallback(code);
        request.user = result.user;
        (request as any).tokens = result.tokens;
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        this.logger.error(`Error en Google OAuth callback: ${errorMessage}`);
        throw new UnauthorizedException('Error autenticando con Google');
      }
    }

    // Modo Supabase: dejar que Passport maneje el flujo
    return super.canActivate(context) as Promise<boolean>;
  }

  private async initiateGoogleOAuth(request: any): Promise<boolean> {
    const authService = request.app.get('AuthService');
    const { authUrl } = await authService.getGoogleAuthUrl();

    // Redirigir a Google
    const response = request.res;
    if (response) {
      return response.redirect(authUrl);
    }

    throw new UnauthorizedException('Inicie sesión con Google: ' + authUrl);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Error en autenticación Google');
    }
    return user;
  }
}