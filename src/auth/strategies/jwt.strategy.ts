import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Usuario as User } from '../entities/user.entity.js';
import { LocalAuthService } from '../services/local-auth.service.js';
import { JwtRsaService } from '../../security/services/jwt-rsa.service.js';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly localAuthService: LocalAuthService,
    private readonly jwtRsa: JwtRsaService,
  ) {
    const useRsa = jwtRsa.hasKeys();
    const jwtSecret = configService.get<string>('jwt.secret') ?? 'default-secret';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: useRsa ? jwtRsa.getPublicKey() : jwtSecret,
      algorithms: useRsa ? ['RS256'] : ['HS256'],
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<User> {
    const user = await this.localAuthService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!user.activo) {
      throw new UnauthorizedException('Cuenta desactivada');
    }

    (req as any).user = user;
    (req as any).tokenPayload = payload;

    return user;
  }
}

// ==================== REFRESH TOKEN STRATEGY ====================

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly configService: ConfigService,
    private readonly localAuthService: LocalAuthService,
    private readonly jwtRsa: JwtRsaService,
  ) {
    const useRsa = jwtRsa.hasKeys();
    const refreshSecret = configService.get<string>('jwt.refreshSecret') ?? 'default-refresh-secret';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: useRsa ? jwtRsa.getPublicKey() : refreshSecret,
      algorithms: useRsa ? ['RS256'] : ['HS256'],
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload & { type: string }): Promise<User> {
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Token inválido');
    }

    const user = await this.localAuthService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!user.activo) {
      throw new UnauthorizedException('Cuenta desactivada');
    }

    (req as any).user = user;
    (req as any).tokenPayload = payload;

    return user;
  }
}

// ==================== GOOGLE STRATEGY (Solo si hay credenciales) ====================

import { Strategy as GoogleStrategyBase } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(GoogleStrategyBase, 'google') {
  constructor(private readonly configService: ConfigService) {
    const clientId = configService.get<string>('googleOAuth.clientId');
    const clientSecret = configService.get<string>('googleOAuth.clientSecret');
    const callbackUrl = configService.get<string>('googleOAuth.callbackUrl') ?? 'http://localhost:3001/api/v1/auth/google/callback';

    if (!clientId || !clientSecret) {
      // No registrar la estrategia si no hay credenciales
      super({
        clientID: 'disabled',
        clientSecret: 'disabled',
        callbackURL: callbackUrl,
        scope: ['email', 'profile'],
        passReqToCallback: true,
      });
      return;
    }

    super({
      clientID: clientId,
      clientSecret: clientSecret,
      callbackURL: callbackUrl,
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<{ profile: any; accessToken: string; refreshToken: string }> {
    const { id, name, emails, photos } = profile;

    return {
      profile: {
        id,
        email: emails[0]?.value,
        name: name?.givenName + ' ' + name?.familyName,
        picture: photos[0]?.value,
      },
      accessToken,
      refreshToken,
    };
  }
}