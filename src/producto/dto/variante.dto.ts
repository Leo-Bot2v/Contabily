import { IsOptional, IsString, IsNumber, IsBoolean, IsEnum, IsArray, ValidateNested, IsUUID, Min, Max, IsUrl, MinLength, MaxLength, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CrearVarianteDto {
  @ApiProperty({ description: 'SKU único de la variante', example: 'CAM-001-R-M' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sku: string;

  @ApiPropertyOptional({ description: 'Código de barras específico' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  codigoBarras?: string;

  @ApiPropertyOptional({ description: 'Nombre de la variante', example: 'Rojo / M' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nombre?: string;

  @ApiProperty({ description: 'Opciones seleccionadas', example: { color: 'Rojo', talla: 'M' } })
  @IsObject()
  opciones: Record<string, string>;

  @ApiProperty({ description: 'Precio de venta', example: 29.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precio: number;

  @ApiPropertyOptional({ description: 'Precio de costo', example: 15.00 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costo?: number;

  @ApiPropertyOptional({ description: 'Precio de comparación', example: 39.99 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioComparacion?: number;

  @IsOptional()
  @IsBoolean()
  rastrearInventario?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stockMinimo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stockMaximo?: number;

  @IsOptional()
  @IsBoolean()
  permitirBackorder?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  peso?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  largo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ancho?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  alto?: number;

  @IsOptional()
  @IsUrl()
  imagen?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mpn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  gtin?: string;

  @IsOptional()
  configuracion?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarVarianteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  codigoBarras?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nombre?: string;

  @IsOptional()
  @IsObject()
  opciones?: Record<string, string>;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precio?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioComparacion?: number;

  @IsOptional()
  @IsBoolean()
  rastrearInventario?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stockMinimo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stockMaximo?: number;

  @IsOptional()
  @IsBoolean()
  permitirBackorder?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  peso?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  largo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ancho?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  alto?: number;

  @IsOptional()
  @IsUrl()
  imagen?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mpn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  gtin?: string;

  @IsOptional()
  configuracion?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class AjusteStockVarianteDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock: number;

  @IsOptional()
  @IsString()
  motivo?: string;
}

export class GenerarVariantesDto {
  @ApiProperty({ description: 'Opciones para generar combinaciones', example: { color: ['Rojo', 'Azul'], talla: ['S', 'M', 'L'] } })
  @IsObject()
  opciones: Record<string, string[]>;

  @ApiPropertyOptional({ description: 'Prefijo para SKU', example: 'CAM-001' })
  @IsOptional()
  @IsString()
  prefijoSku?: string;

  @ApiPropertyOptional({ description: 'Precio base para todas las variantes', example: 29.99 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioBase?: number;

  @ApiPropertyOptional({ description: 'Costo base', example: 15.00 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costoBase?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stockBase?: number;
}