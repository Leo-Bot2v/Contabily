import { IsOptional, IsString, IsNumber, IsBoolean, IsEnum, IsArray, ValidateNested, IsUUID, Min, Max, IsUrl, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoColeccion, CondicionColeccion } from '../entities/coleccion.entity.js';

export class CrearCategoriaDto {
  @ApiProperty({ description: 'Nombre de la categoría', example: 'Ropa' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @IsOptional()
  @IsUrl()
  imagen?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  icono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  color?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @IsOptional()
  @IsBoolean()
  visibleEnMenu?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  tituloSeo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcionSeo?: string;

  @IsOptional()
  @IsUUID()
  padreId?: string | null;

  @IsOptional()
  configuracion?: Record<string, any>;
}

export class ActualizarCategoriaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @IsOptional()
  @IsUrl()
  imagen?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  icono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  color?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @IsOptional()
  @IsBoolean()
  visibleEnMenu?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  tituloSeo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcionSeo?: string;

  @IsOptional()
  @IsUUID()
  padreId?: string | null;

  @IsOptional()
  configuracion?: Record<string, any>;
}

export class CrearColeccionDto {
  @ApiProperty({ description: 'Nombre de la colección', example: 'Verano 2024' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiProperty({ description: 'Tipo de colección', enum: TipoColeccion })
  @IsEnum(TipoColeccion)
  tipo: TipoColeccion;

  @IsOptional()
  @IsUrl()
  imagen?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  condiciones?: any;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @IsOptional()
  @IsBoolean()
  visibleEnTienda?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  tituloSeo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcionSeo?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productoIds?: string[];

  @IsOptional()
  configuracion?: Record<string, any>;
}

export class ActualizarColeccionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @IsOptional()
  @IsEnum(TipoColeccion)
  tipo?: TipoColeccion;

  @IsOptional()
  @IsUrl()
  imagen?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  condiciones?: any;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @IsOptional()
  @IsBoolean()
  visibleEnTienda?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  tituloSeo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcionSeo?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productoIds?: string[];

  @IsOptional()
  configuracion?: Record<string, any>;
}

export class AgregarProductoColeccionDto {
  @IsArray()
  @IsUUID('4', { each: true })
  productoIds: string[];
}

export class RemoverProductoColeccionDto {
  @IsArray()
  @IsUUID('4', { each: true })
  productoIds: string[];
}