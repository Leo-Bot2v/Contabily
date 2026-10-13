import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TipoNegocio, Moneda } from '../entities/empresa.entity.js';

export class CrearEmpresaDto {
  @ApiProperty({ description: 'Nombre comercial de la empresa', example: 'Mi Tienda C.A.' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(255, { message: 'El nombre no puede exceder 255 caracteres' })
  nombre: string;

  @ApiPropertyOptional({ description: 'Razón social legal', example: 'Mi Tienda C.A.' })
  @IsOptional()
  @IsString({ message: 'La razón social debe ser una cadena de texto' })
  @MaxLength(255, { message: 'La razón social no puede exceder 255 caracteres' })
  razonSocial?: string;

  @ApiProperty({ description: 'RIF / NIT / identificación fiscal', example: 'J-12345678-9' })
  @IsString({ message: 'El rif debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El rif es obligatorio' })
  @MaxLength(50, { message: 'El rif no puede exceder 50 caracteres' })
  rif: string;

  @ApiPropertyOptional({ description: 'Dirección fiscal', example: 'Av. Principal, Caracas' })
  @IsOptional()
  @IsString({ message: 'La dirección fiscal debe ser una cadena de texto' })
  direccionFiscal?: string;

  @ApiPropertyOptional({ description: 'Teléfono de contacto', example: '+58 212 5550000' })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @MaxLength(50, { message: 'El teléfono no puede exceder 50 caracteres' })
  telefono?: string;

  @ApiPropertyOptional({ description: 'Email de contacto', example: 'contacto@mitienda.com' })
  @IsOptional()
  @IsEmail({}, { message: 'El email debe ser válido' })
  @MaxLength(255, { message: 'El email no puede exceder 255 caracteres' })
  email?: string;

  @ApiPropertyOptional({ description: 'Sitio web', example: 'https://mitienda.com' })
  @IsOptional()
  @IsString({ message: 'El sitio web debe ser una cadena de texto' })
  @MaxLength(255, { message: 'El sitio web no puede exceder 255 caracteres' })
  sitioWeb?: string;

  @ApiPropertyOptional({ description: 'URL del logo', example: 'https://cdn.mitienda.com/logo.png' })
  @IsOptional()
  @IsString({ message: 'La URL del logo debe ser una cadena de texto' })
  logoUrl?: string;

  @ApiPropertyOptional({
    description: 'Tipo de negocio',
    enum: TipoNegocio,
    default: TipoNegocio.FISICO,
  })
  @IsOptional()
  @IsEnum(TipoNegocio, { message: 'El tipo debe ser fisico, digital, servicios o hibrido' })
  tipo?: TipoNegocio;

  @ApiPropertyOptional({ description: 'Moneda base', enum: Moneda, default: Moneda.USD })
  @IsOptional()
  @IsEnum(Moneda, { message: 'La moneda debe ser una de las permitidas (USD, EUR, MXN, …)' })
  moneda?: Moneda;

  @ApiPropertyOptional({ description: 'Zona horaria', example: 'America/Caracas', default: 'UTC' })
  @IsOptional()
  @IsString({ message: 'La zona horaria debe ser una cadena de texto' })
  @MaxLength(50, { message: 'La zona horaria no puede exceder 50 caracteres' })
  zonaHoraria?: string;

  @ApiPropertyOptional({ description: 'Localización', example: 'es', default: 'es' })
  @IsOptional()
  @IsString({ message: 'El locale debe ser una cadena de texto' })
  @MaxLength(10, { message: 'El locale no puede exceder 10 caracteres' })
  locale?: string;

  @ApiPropertyOptional({ description: 'Configuración JSON flexible' })
  @IsOptional()
  @IsObject({ message: 'La configuración debe ser un objeto JSON' })
  configuracion?: Record<string, any>;
}

export class ActualizarEmpresaDto extends PartialType(CrearEmpresaDto) {
  @ApiPropertyOptional({ description: 'Si la empresa está activa', default: true })
  @IsOptional()
  @IsBoolean({ message: 'activo debe ser un booleano' })
  activo?: boolean;
}
