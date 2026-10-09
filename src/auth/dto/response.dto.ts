import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Usuario as User, UserRole } from '../entities/user.entity.js';

export class TokenPayload {
  @ApiProperty({ description: 'Access token JWT', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ description: 'Refresh token para renovar access token', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;

  @ApiProperty({ description: 'Tiempo de expiración del access token en segundos', example: 86400 })
  expiresIn: number;

  @ApiProperty({ description: 'Tipo de token', example: 'Bearer' })
  tokenType: string;
}

export class UserResponseDto {
  @ApiProperty({ description: 'ID del usuario', example: 'uuid-v4' })
  id: string;

  @ApiProperty({ description: 'Correo del usuario', example: 'usuario@ejemplo.com' })
  correo: string;

  @ApiPropertyOptional({ description: 'Nombre completo', example: 'Juan Pérez' })
  nombreCompleto: string | null;

  @ApiPropertyOptional({ description: 'URL del avatar', example: 'https://...' })
  urlAvatar: string | null;

  @ApiProperty({ description: 'Proveedor de autenticación', enum: ['local', 'google', 'supabase'] })
  proveedor: string;

  @ApiProperty({ description: 'Roles del usuario', enum: UserRole, isArray: true })
  roles: UserRole[];

  @ApiProperty({ description: 'Si el usuario está activo' })
  activo: boolean;

  @ApiProperty({ description: 'Si el correo está verificado' })
  correoVerificado: boolean;

  @ApiProperty({ description: 'Último login' })
  ultimoLogin: Date | null;

  @ApiProperty({ description: 'Fecha de creación' })
  creadoEn: Date;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.correo = user.correo;
    dto.nombreCompleto = user.nombreCompleto;
    dto.urlAvatar = user.urlAvatar;
    dto.proveedor = user.proveedor;
    dto.roles = user.roles;
    dto.activo = user.activo;
    dto.correoVerificado = user.correoVerificado;
    dto.ultimoLogin = user.ultimoLogin;
    dto.creadoEn = user.creadoEn;
    return dto;
  }
}

export class AuthResponseDto {
  @ApiProperty({ type: () => UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ type: () => TokenPayload })
  tokens: TokenPayload;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Operación exitosa' })
  message: string;
}

export class GoogleAuthUrlDto {
  @ApiProperty({ description: 'URL para redirigir a Google OAuth', example: 'https://accounts.google.com/o/oauth2/v2/auth?...' })
  authUrl: string;
}