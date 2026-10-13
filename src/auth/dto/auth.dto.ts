import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'Email del usuario', example: 'usuario@ejemplo.com' })
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  email: string;

  @ApiProperty({ description: 'Contraseña (mín 8 chars, 1 mayúscula, 1 minúscula, 1 número)' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(50, { message: 'La contraseña no puede exceder 50 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe contener al menos una mayúscula, una minúscula y un número',
  })
  password: string;

  @ApiPropertyOptional({ description: 'Nombre completo', example: 'Juan Pérez' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string;
}

/**
 * Campos editables del perfil vía PATCH /auth/me.
 *
 * Es una lista blanca, no un `Partial<User>`: con `whitelist: true` y
 * `forbidNonWhitelisted` del ValidationPipe global, cualquier intento de tocar
 * `correo`, `roles`, `hashContrasena` o `activo` devuelve 400 en vez de
 * pasarle esos campos al repositorio.
 */
export class ActualizarPerfilDto {
  @ApiPropertyOptional({ description: 'Nombre completo', example: 'Juan Pérez' })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(255, { message: 'El nombre no puede exceder 255 caracteres' })
  nombreCompleto?: string;

  @ApiPropertyOptional({ description: 'Teléfono de contacto', example: '+58 412 1234567' })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @MaxLength(50, { message: 'El teléfono no puede exceder 50 caracteres' })
  telefono?: string;

  @ApiPropertyOptional({ description: 'URL del avatar', example: 'https://cdn.ejemplo.com/foto.png' })
  @IsOptional()
  @IsString({ message: 'La URL del avatar debe ser una cadena de texto' })
  @MaxLength(2048, { message: 'La URL del avatar no puede exceder 2048 caracteres' })
  urlAvatar?: string;
}

export class LoginDto {
  @ApiProperty({ description: 'Email del usuario', example: 'usuario@ejemplo.com' })
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  email: string;

  @ApiProperty({ description: 'Contraseña' })
  @IsString()
  @MinLength(1)
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token' })
  @IsString()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Email para recuperación', example: 'usuario@ejemplo.com' })
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token de recuperación' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'Nueva contraseña' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(50)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe contener al menos una mayúscula, una minúscula y un número',
  })
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Contraseña actual' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ description: 'Nueva contraseña' })
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe contener al menos una mayúscula, una minúscula y un número',
  })
  newPassword: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'Token de verificación' })
  @IsString()
  token: string;
}

export class ResendVerificationDto {
  @ApiProperty({ description: 'Email para reenviar verificación' })
  @IsEmail()
  email: string;
}